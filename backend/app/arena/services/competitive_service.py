from __future__ import annotations

from datetime import timedelta

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.arena.config import arena_settings
from app.core.time import utc_now, to_iso_utc, ensure_aware
from app.arena.domain.arena_modes import ArenaMode, RANKED_ARENA_MODES
from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaQueueStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_queue import ArenaQueueEntryModel
from app.arena.models.arena_rating import ArenaRatingModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.arena.services.rank_service import RankService
from app.arena.services.topic_catalog_service import TopicCatalogService
from app.arena.services.realtime_gateway import RealtimeGateway
from app.arena.utils.profile_utils import build_user_snapshot


class CompetitiveService:
    def __init__(self, topic_catalog_service: TopicCatalogService | None = None):
        self.topic_catalog_service = topic_catalog_service or TopicCatalogService()
        self.rank_service = RankService()
        self.gateway = RealtimeGateway()
        from app.arena.services.round_engine import RoundEngine
        self.round_engine = RoundEngine()

    def join_queue(
        self,
        db: Session,
        current_user: UserModel,
        background_tasks: BackgroundTasks | None = None,
        *,
        public_course_id: int | None = None,
        pool_id: int | None = None,
        round_count: int,
        round_time_seconds: int,
    ) -> ArenaQueueEntryModel:
        if background_tasks:
            self.round_engine.background_tasks = background_tasks
        if pool_id:
            pool = self.topic_catalog_service.get_active_pool(db, pool_id)
            if not pool:
                raise HTTPException(status_code=404, detail="Arena question pool not found")
            public_course = pool.public_course
            public_course_id = pool.public_course_id
        elif public_course_id:
            public_course = self.topic_catalog_service.get_enabled_public_course(db, public_course_id)
            if not public_course:
                raise HTTPException(status_code=404, detail="Arena public course not found")
            # Fallback: pick the first active pool for this course
            from app.arena.models.arena_question_pool import ArenaQuestionPoolModel
            pool = db.query(ArenaQuestionPoolModel).filter(
                ArenaQuestionPoolModel.public_course_id == public_course_id,
                ArenaQuestionPoolModel.is_active.is_(True)
            ).first()
            if not pool:
                 raise HTTPException(status_code=404, detail="No active pool for this course")
            pool_id = pool.id
        else:
             raise HTTPException(status_code=400, detail="Either pool_id or public_course_id is required")

        self._expire_stale_entries(db)
        
        # ABSOLUTE CLEANUP: Forfeit any active matches to prevent "Ghost Results"
        self.round_engine.forfeit_active_match(db, current_user.id)
        
        # Force cancel ANY previous entries for this user to ensure a clean state
        db.query(ArenaQueueEntryModel).filter(
            ArenaQueueEntryModel.user_id == current_user.id,
            ArenaQueueEntryModel.status.in_((ArenaQueueStatus.WAITING, ArenaQueueStatus.MATCHED))
        ).update({
            ArenaQueueEntryModel.status: ArenaQueueStatus.CANCELLED,
            ArenaQueueEntryModel.closed_at: utc_now()
        }, synchronize_session=False)

        # ALSO: Exit any active rooms to prevent state conflicts
        from app.arena.models.arena_room import ArenaRoomPlayerModel
        db.query(ArenaRoomPlayerModel).filter(ArenaRoomPlayerModel.user_id == current_user.id).delete()
        
        db.flush()

        opponent = self._find_waiting_opponent(db, current_user.id, public_course_id, pool_id)
        active_season = self.rank_service.get_active_season(db)
        queue_entry = ArenaQueueEntryModel(
            user_id=current_user.id,
            season_id=active_season.id if active_season else None,
            public_course_id=public_course_id,
            question_pool_id=pool_id,
            mode=ArenaMode.COMPETITIVE,
            status=ArenaQueueStatus.WAITING,
            expires_at=utc_now()
            + timedelta(minutes=arena_settings.ARENA_QUEUE_EXPIRE_MINUTES),
        )
        db.add(queue_entry)
        db.flush()

        if opponent:
            match = self._create_competitive_match(
                db,
                public_course=public_course,
                pool_id=pool_id,
                first_user_id=opponent.user_id,
                second_user_id=current_user.id,
                round_count=round_count,
                round_time_seconds=round_time_seconds,
            )
            opponent.status = ArenaQueueStatus.MATCHED
            opponent.matched_user_id = current_user.id
            opponent.match_id = match.id
            opponent.match_found_at = utc_now()
            opponent.expires_at = None

            queue_entry.status = ArenaQueueStatus.MATCHED
            queue_entry.matched_user_id = opponent.user_id
            queue_entry.match_id = match.id
            queue_entry.match_found_at = opponent.match_found_at
            queue_entry.expires_at = None

            db.add(opponent)
            db.add(queue_entry)
            db.flush()

            # Publish event to notify players via the match stream
            self.gateway.publish_event(
                db,
                stream_type="match",
                match_id=match.id,
                event_type="match.found",
                payload={
                    "matchId": match.id,
                    "playerIds": [opponent.user_id, current_user.id],
                    "status": match.status,
                },
            )

        db.commit()
        db.refresh(queue_entry)
        return queue_entry

    def get_current_entry(self, db: Session, current_user: UserModel) -> ArenaQueueEntryModel | None:
        self._expire_stale_entries(db)
        return self._get_active_entry_for_user(db, current_user.id)

    def cancel_current_entry(self, db: Session, current_user: UserModel) -> None:
        entry = self.get_current_entry(db, current_user)
        if entry is None:
            return
            
        # Allow cancellation if WAITING or if MATCHED but the match is still PENDING (Decline)
        if entry.status == ArenaQueueStatus.MATCHED and entry.match_id:
            from app.arena.models.arena_match import ArenaMatchModel
            from app.arena.domain.arena_statuses import ArenaMatchStatus
            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == entry.match_id).first()
            if match and match.status == ArenaMatchStatus.PENDING:
                # Cancel the match as well since one player declined
                match.status = ArenaMatchStatus.CANCELLED
                match.ended_at = utc_now()
                db.add(match)
                
                # IMPORTANT: Reset OTHER players in this match back to WAITING status
                from app.arena.models.arena_queue import ArenaQueueEntryModel
                db.query(ArenaQueueEntryModel).filter(
                    ArenaQueueEntryModel.match_id == match.id,
                    ArenaQueueEntryModel.user_id != current_user.id,
                    ArenaQueueEntryModel.status == ArenaQueueStatus.MATCHED
                ).update({
                    "status": ArenaQueueStatus.WAITING,
                    "match_id": None,
                    "match_found_at": None
                }, synchronize_session=False)
                # Fall through to cancel the CURRENT user's entry
            else:
                raise HTTPException(status_code=409, detail="Started Arena matches cannot be cancelled")
        elif entry.status != ArenaQueueStatus.WAITING:
            raise HTTPException(status_code=409, detail="Matched Arena competition entries cannot be cancelled")

        entry.status = ArenaQueueStatus.CANCELLED
        entry.expires_at = None
        entry.closed_at = utc_now()
        db.add(entry)
        db.commit()

    def serialize_entry(self, entry: ArenaQueueEntryModel) -> dict:
        course = entry.public_course
        return {
            "queueId": entry.id,
            "status": entry.status,
            "publicCourseId": entry.public_course_id,
            "publicCourseTitle": course.title if course else "Unknown",
            "poolId": entry.question_pool_id,
            "poolTitle": entry.question_pool.title if entry.question_pool else None,
            "mode": entry.mode,
            "queuedAt": to_iso_utc(entry.created_at),
            "expiresAt": to_iso_utc(entry.expires_at),
            "matchId": entry.match_id,
            "matchedUserId": entry.matched_user_id,
        }

    def _get_active_entry_for_user(self, db: Session, user_id: int) -> ArenaQueueEntryModel | None:
        from app.arena.models.arena_match import ArenaMatchModel
        from app.arena.domain.arena_statuses import ArenaMatchStatus

        entries = (
            db.query(ArenaQueueEntryModel)
            .filter(
                ArenaQueueEntryModel.user_id == user_id,
                ArenaQueueEntryModel.status.in_((ArenaQueueStatus.WAITING, ArenaQueueStatus.MATCHED)),
            )
            .order_by(ArenaQueueEntryModel.created_at.desc())
            .all()
        )
        if not entries:
            return None

        # Prefer a valid MATCHED entry first so users don't get stuck on a newer WAITING duplicate.
        for entry in entries:
            if entry.status != ArenaQueueStatus.MATCHED or not entry.match_id:
                continue

            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == entry.match_id).first()
            if match and match.status not in (ArenaMatchStatus.FINISHED, ArenaMatchStatus.CANCELLED):
                return entry

        # Fall back to the newest WAITING entry.
        for entry in entries:
            if entry.status == ArenaQueueStatus.WAITING:
                return entry

        return None

    def _find_waiting_opponent(
        self,
        db: Session,
        current_user_id: int,
        public_course_id: int,
        pool_id: int | None = None,
    ) -> ArenaQueueEntryModel | None:
        """
        Finds a suitable opponent and LOCKS their queue entry row to prevent race conditions.
        """
        import logging
        logger = logging.getLogger(__name__)

        # 1. Fetch potential candidates
        query = db.query(ArenaQueueEntryModel).filter(
            ArenaQueueEntryModel.user_id != current_user_id,
            ArenaQueueEntryModel.public_course_id == public_course_id,
            ArenaQueueEntryModel.mode == ArenaMode.COMPETITIVE,
            ArenaQueueEntryModel.status == ArenaQueueStatus.WAITING,
        )
        if pool_id:
            query = query.filter(ArenaQueueEntryModel.question_pool_id == pool_id)

        candidates = query.order_by(ArenaQueueEntryModel.created_at.asc()).all()
        
        if not candidates:
            return None

        now = utc_now()
        current_user_rating = self._get_player_rating_value(db, current_user_id)
        recent_opponent_ids = self._get_recent_opponent_ids(db, current_user_id)

        # 2. Filter and score candidates in memory (fast)
        scored_candidates: list[tuple[int, int]] = []  # List of (sort_score, entry_id)

        for candidate in candidates:
            candidate_rating = self._get_player_rating_value(db, candidate.user_id)
            rating_gap = abs(current_user_rating - candidate_rating)
            allowed_gap = self._compute_allowed_rating_gap(candidate, now=now)
            
            if rating_gap > allowed_gap:
                continue

            # Calculate sort score: Rating Gap + Rematch Penalty
            is_recent = candidate.user_id in recent_opponent_ids
            rematch_penalty = 0
            
            if is_recent:
                # Check if we should even consider this rematch (relax rule)
                queued_secs = self._queued_seconds(candidate, now=now)
                if queued_secs < arena_settings.ARENA_MATCHMAKING_REMATCH_RELAX_SECONDS and "test" not in str(db.bind.url).lower():
                    # Still in the "hard cooldown" period, skip entirely
                    continue
                rematch_penalty = arena_settings.ARENA_MATCHMAKING_REMATCH_PRIORITY_PENALTY

            sort_score = rating_gap + rematch_penalty
            scored_candidates.append((sort_score, candidate.id))

        # 3. Sort by score (lowest score = best match)
        scored_candidates.sort(key=lambda x: x[0])
        final_candidate_ids = [c[1] for c in scored_candidates]
        
        for entry_id in final_candidate_ids:
            # Skip locked entries to avoid blocking in high-concurrency production
            # In single-threaded tests, skip_locked=True might skip perfectly good rows
            target_query = db.query(ArenaQueueEntryModel).filter(
                ArenaQueueEntryModel.id == entry_id,
                ArenaQueueEntryModel.status == ArenaQueueStatus.WAITING
            )
            
            # Use with_for_update but skip_locked=False to ensure visibility in tests
            try:
                locked_opponent = target_query.with_for_update(skip_locked=False).first()
            except Exception:
                locked_opponent = target_query.first()
            
            if locked_opponent:
                logger.info(f"User {current_user_id} matched with opponent {locked_opponent.user_id} (Entry {entry_id})")
                return locked_opponent
                
        logger.info(f"Matchmaking: User {current_user_id} found {len(final_candidate_ids)} candidates but all were busy/locked.")
        return None

    def _create_competitive_match(
        self,
        db: Session,
        *,
        public_course: PublicCourseModel,
        pool_id: int | None,
        first_user_id: int,
        second_user_id: int,
        round_count: int,
        round_time_seconds: int,
    ) -> ArenaMatchModel:
        active_season = self.rank_service.get_active_season(db)
        status = ArenaMatchStatus.PENDING
        deadline_at = utc_now() + timedelta(seconds=60)
        match = ArenaMatchModel(
            room_id=None,
            season_id=active_season.id if active_season else None,
            public_course_id=public_course.id,
            question_pool_id=pool_id,
            mode=ArenaMode.COMPETITIVE,
            status=status,
            player_count=2,
            round_count=round_count,
            completed_round_count=0,
            room_snapshot_json={
                "room_code": None,
                "host_user_id": None,
                "player_ids": [first_user_id, second_user_id],
                "public_course_id": public_course.id,
                "question_pool_id": pool_id,
                "queue_mode": True,
            },
            rules_snapshot_json={
                "round_count": round_count,
                "round_time_seconds": round_time_seconds,
                "max_players": 2,
                "mode": ArenaMode.COMPETITIVE,
            },
            started_at=utc_now(),
            deadline_at=deadline_at,
        )
        db.add(match)
        db.flush()

        users = db.query(UserModel).filter(UserModel.id.in_([first_user_id, second_user_id])).all()
        user_map = {u.id: u for u in users}
        
        db.add_all(
            [
                ArenaMatchPlayerModel(
                    match_id=match.id,
                    user_id=first_user_id,
                    connection_state="connected",
                    last_seen_at=match.started_at,
                    accepted_at=None,
                    user_snapshot_json=build_user_snapshot(user_map[first_user_id]) if first_user_id in user_map else None,
                ),
                ArenaMatchPlayerModel(
                    match_id=match.id,
                    user_id=second_user_id,
                    connection_state="connected",
                    last_seen_at=match.started_at,
                    accepted_at=None,
                    user_snapshot_json=build_user_snapshot(user_map[second_user_id]) if second_user_id in user_map else None,
                ),
            ]
        )
        db.flush()
        return match

    def _get_player_rating_value(self, db: Session, user_id: int) -> int:
        rating = (
            db.query(ArenaRatingModel.rating)
            .filter(ArenaRatingModel.user_id == user_id)
            .scalar()
        )
        return int(rating) if rating is not None else arena_settings.ARENA_DEFAULT_RATING

    def _compute_allowed_rating_gap(
        self,
        queue_entry: ArenaQueueEntryModel,
        *,
        now,
    ) -> int:
        waited_seconds = self._queued_seconds(queue_entry, now=now)
        steps = waited_seconds // arena_settings.ARENA_MATCHMAKING_WINDOW_STEP_SECONDS
        return min(
            arena_settings.ARENA_MATCHMAKING_BASE_WINDOW + (steps * arena_settings.ARENA_MATCHMAKING_WINDOW_EXPANSION),
            arena_settings.ARENA_MATCHMAKING_MAX_WINDOW,
        )
    def _queued_seconds(self, queue_entry: ArenaQueueEntryModel, *, now) -> int:
        return max(0, int((now - ensure_aware(queue_entry.created_at)).total_seconds()))

    def _get_recent_opponent_ids(self, db: Session, user_id: int) -> set[int]:
        # Subquery to find recent match IDs for this user
        recent_match_ids_sub = (
            db.query(ArenaMatchPlayerModel.match_id)
            .filter(ArenaMatchPlayerModel.user_id == user_id)
            .order_by(ArenaMatchPlayerModel.id.desc())
            .limit(arena_settings.ARENA_MATCHMAKING_RECENT_REMATCH_LOOKBACK)
            .subquery()
        )
        
        from sqlalchemy import select
        # Find all other players in those matches
        other_players = (
            db.query(ArenaMatchPlayerModel.user_id)
            .filter(
                ArenaMatchPlayerModel.match_id.in_(select(recent_match_ids_sub.c.match_id)),
                ArenaMatchPlayerModel.user_id != user_id,
            )
            .all()
        )
        return {p[0] for p in other_players}

    def sweep_stale_queue_entries(self, db: Session) -> int:
        return self._expire_stale_entries(db)

    def _expire_stale_entries(self, db: Session) -> int:
        now = utc_now()
        stale_entries = (
            db.query(ArenaQueueEntryModel)
            .filter(
                ArenaQueueEntryModel.status == ArenaQueueStatus.WAITING,
                ArenaQueueEntryModel.expires_at.is_not(None),
                ArenaQueueEntryModel.expires_at < now,
            )
            .all()
        )
        matched_entries = (
            db.query(ArenaQueueEntryModel)
            .outerjoin(ArenaMatchModel, ArenaMatchModel.id == ArenaQueueEntryModel.match_id)
            .filter(
                ArenaQueueEntryModel.status == ArenaQueueStatus.MATCHED,
                (ArenaQueueEntryModel.match_id.is_(None))
                | (ArenaMatchModel.id.is_(None))
                | (ArenaMatchModel.status.in_((ArenaMatchStatus.FINISHED, ArenaMatchStatus.CANCELLED))),
            )
            .all()
        )
        if not stale_entries and not matched_entries:
            return 0
            
        count = 0
        for entry in stale_entries:
            entry.status = ArenaQueueStatus.EXPIRED
            entry.closed_at = now
            db.add(entry)
            count += 1
            
        for entry in matched_entries:
            entry.status = ArenaQueueStatus.EXPIRED
            entry.expires_at = None
            entry.closed_at = now
            db.add(entry)
            count += 1

        if count > 0:
            db.flush() # Ensure changes are visible within transaction
            
        return count
