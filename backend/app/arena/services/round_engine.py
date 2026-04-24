from __future__ import annotations

from statistics import mean

from fastapi import HTTPException, BackgroundTasks
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.arena.config import arena_settings
from app.core.time import utc_now, to_iso_utc, ensure_aware
from app.arena.domain.arena_modes import ArenaMode
from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaRoundStatus, ArenaRoomStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_round import ArenaAnswerModel, ArenaRoundModel
from app.arena.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.arena.services.presence_service import PresenceService
from app.arena.services.realtime_gateway import RealtimeGateway
from app.arena.services.question_pool_service import QuestionPoolService
from app.arena.services.rating_service import RatingService
from app.arena.services.scoring_service import ScoringService
from app.arena.services.reward_service import ArenaRewardService


class RoundEngine:
    STALE_MATCH_FINALIZE_SECONDS = arena_settings.ARENA_MATCH_STALE_FINALIZE_SECONDS
    MATCH_ACCEPT_SECONDS = arena_settings.ARENA_MATCH_ACCEPT_SECONDS

    def __init__(
        self,
        question_pool_service: QuestionPoolService | None = None,
        scoring_service: ScoringService | None = None,
        rating_service: RatingService | None = None,
        background_tasks: BackgroundTasks | None = None,
    ):
        self.question_pool_service = question_pool_service or QuestionPoolService()
        self.scoring_service = scoring_service or ScoringService()
        self.rating_service = rating_service or RatingService()
        self.reward_service = ArenaRewardService()
        self.background_tasks = background_tasks
        self.realtime_gateway = RealtimeGateway()
        self.presence_service = PresenceService(self.realtime_gateway)

    def _base_match_query(self, db: Session):
        return db.query(ArenaMatchModel).options(
            selectinload(ArenaMatchModel.players).selectinload(ArenaMatchPlayerModel.user),
            selectinload(ArenaMatchModel.public_course),
        )

    def _base_round_query(self, db: Session):
        return db.query(ArenaRoundModel).options(selectinload(ArenaRoundModel.answers))

    def get_match(self, db: Session, match_id: int) -> ArenaMatchModel | None:
        return self._base_match_query(db).filter(ArenaMatchModel.id == match_id).first()

    def get_active_match_for_user(self, db: Session, user_id: int) -> ArenaMatchModel | None:
        row = (
            db.query(ArenaMatchPlayerModel.match_id)
            .join(ArenaMatchModel, ArenaMatchModel.id == ArenaMatchPlayerModel.match_id)
            .filter(
                ArenaMatchPlayerModel.user_id == user_id,
                ArenaMatchModel.status.in_((ArenaMatchStatus.IN_PROGRESS, ArenaMatchStatus.PENDING)),
            )
            .order_by(ArenaMatchModel.started_at.desc(), ArenaMatchModel.id.desc())
            .first()
        )
        if not row:
            return None
        return self.get_match(db, row[0])

    def initialize_match_rounds(self, db: Session, match_id: int) -> None:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")

        existing_round = db.query(ArenaRoundModel.id).filter(ArenaRoundModel.match_id == match.id).first()
        if existing_round:
            return

        public_course = (
            db.query(PublicCourseModel)
            .filter(PublicCourseModel.id == match.public_course_id)
            .first()
        )
        if not public_course:
            raise HTTPException(status_code=404, detail="Arena public course not found")

        rules = match.rules_snapshot_json if isinstance(match.rules_snapshot_json, dict) else {}
        round_count = int(rules.get("round_count") or 5)
        timer_seconds = int(rules.get("round_time_seconds") or arena_settings.ARENA_DEFAULT_ROUND_TIME_SECONDS)
        questions = self.question_pool_service.build_round_questions(
            db,
            public_course,
            pool_id=match.question_pool_id,
            question_type=(match.room_snapshot_json or {}).get("question_type") if isinstance(match.room_snapshot_json, dict) else None,
            round_count=round_count,
        )
        effective_rules = {**rules, "round_count": len(questions)}
        match.round_count = len(questions)
        match.rules_snapshot_json = effective_rules
        match.player_count = len(match.players)
        match.completed_round_count = 0
        db.add(match)

        for index, question in enumerate(questions):
            round_model = ArenaRoundModel(
                match_id=match.id,
                round_index=index,
                status=ArenaRoundStatus.PENDING,
                question_key=str(question.get("question_id") or ""),
                difficulty=str(question.get("difficulty") or "") or None,
                question_count=max(1, len(list(question.get("options") or []))),
                question_snapshot_json=question,
                timer_seconds=timer_seconds,
            )
            db.add(round_model)

        db.commit()
        pending_round = (
            self._base_round_query(db)
            .filter(ArenaRoundModel.match_id == match.id, ArenaRoundModel.round_index == 0)
            .first()
        )
        if pending_round:
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.waiting",
                payload={
                    "matchId": match.id,
                    "roundId": pending_round.id,
                    "roundIndex": pending_round.round_index,
                    "timerSeconds": pending_round.timer_seconds,
                    "activeRound": self._build_active_round_payload(pending_round),
                },
            )

    def _seconds_delta(self, seconds: int):
        from datetime import timedelta

        return timedelta(seconds=seconds)

    def _get_participant(self, match: ArenaMatchModel, user_id: int) -> ArenaMatchPlayerModel | None:
        return next((player for player in match.players if player.user_id == user_id), None)

    def _ensure_participant(self, match: ArenaMatchModel, current_user: UserModel) -> None:
        if not self._get_participant(match, current_user.id):
            raise HTTPException(status_code=403, detail="You are not part of this Arena match")

    def _start_match_acceptance_window_if_ready(self, db: Session, match: ArenaMatchModel) -> bool:
        if match.status != ArenaMatchStatus.PENDING or match.deadline_at is not None:
            return False

        players = (
            db.query(ArenaMatchPlayerModel)
            .filter(ArenaMatchPlayerModel.match_id == match.id)
            .all()
        )
        if not players:
            return False

        all_connected = all((player.connection_state or "") == "connected" for player in players)
        if not all_connected:
            return False

        match.deadline_at = utc_now() + self._seconds_delta(self.MATCH_ACCEPT_SECONDS)
        db.add(match)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="match.accept_window_started",
            payload={
                "matchId": match.id,
                "deadlineAt": to_iso_utc(match.deadline_at),
            },
        )
        return True

    def _get_rounds(self, db: Session, match_id: int) -> list[ArenaRoundModel]:
        return (
            self._base_round_query(db)
            .filter(ArenaRoundModel.match_id == match_id)
            .order_by(ArenaRoundModel.round_index.asc())
            .all()
        )

    def _get_active_round(self, rounds: list[ArenaRoundModel]) -> ArenaRoundModel | None:
        return next((round_item for round_item in rounds if round_item.status == ArenaRoundStatus.ACTIVE), None)

    def _get_pending_round(self, rounds: list[ArenaRoundModel]) -> ArenaRoundModel | None:
        return next((round_item for round_item in rounds if round_item.status == ArenaRoundStatus.PENDING), None)

    def _get_current_round(self, rounds: list[ArenaRoundModel]) -> ArenaRoundModel | None:
        return self._get_active_round(rounds) or self._get_pending_round(rounds)

    def _get_player_ready_round_index(self, player: ArenaMatchPlayerModel) -> int | None:
        metadata = player.metadata_json if isinstance(player.metadata_json, dict) else {}
        ready_index = metadata.get("questionReadyRoundIndex")
        if ready_index is None:
            return None
        try:
            return int(ready_index)
        except (TypeError, ValueError):
            return None

    def _set_player_ready_round_index(self, db: Session, match: ArenaMatchModel, user_id: int, round_index: int) -> None:
        player = self._get_participant(match, user_id)
        if not player:
            return
        metadata = player.metadata_json if isinstance(player.metadata_json, dict) else {}
        if metadata.get("questionReadyRoundIndex") == round_index:
            return
        metadata = {**metadata, "questionReadyRoundIndex": round_index, "questionReadyAt": to_iso_utc(utc_now())}
        player.metadata_json = metadata
        db.add(player)

    def _all_players_ready_for_round(self, match: ArenaMatchModel, round_index: int) -> bool:
        return bool(match.players) and all(self._get_player_ready_round_index(player) == round_index for player in match.players)

    def mark_question_ready(self, db: Session, match_id: int, round_id: int, current_user: UserModel) -> dict:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")
        self._ensure_participant(match, current_user)
        match = self._ensure_round_progress(db, match)
        db.flush()

        round_model = (
            self._base_round_query(db)
            .filter(ArenaRoundModel.id == round_id, ArenaRoundModel.match_id == match.id)
            .first()
        )
        if not round_model:
            raise HTTPException(status_code=404, detail="Arena round not found")

        self._set_player_ready_round_index(db, match, current_user.id, round_model.round_index)
        db.flush()

        # Refresh match to get updated player data
        match = self.get_match(db, match.id)
        if match and self._all_players_ready_for_round(match, round_model.round_index):
            self._activate_round_if_ready(db, match, round_model)
            db.commit()
            refreshed_match = self.get_match(db, match.id)
            if refreshed_match:
                return {
                    "accepted": True,
                    "activated": True,
                    "state": self.get_match_state(db, refreshed_match.id, current_user),
                }

        db.commit()
        return {
            "accepted": True,
            "activated": False,
            "state": self.get_match_state(db, match.id, current_user),
        }

    def _activate_round_if_ready(self, db: Session, match: ArenaMatchModel, round_model: ArenaRoundModel) -> bool:
        locked_round = (
            db.query(ArenaRoundModel)
            .filter(ArenaRoundModel.id == round_model.id)
            .with_for_update()
            .first()
        )
        if not locked_round or locked_round.status != ArenaRoundStatus.PENDING:
            return False

        match = self.get_match(db, match.id) or match
        if not self._all_players_ready_for_round(match, locked_round.round_index):
            return False

        now = utc_now()
        if locked_round.started_at and ensure_aware(locked_round.started_at) > now:
            return False
        if not locked_round.started_at:
            locked_round.started_at = now
        if not locked_round.deadline_at:
            locked_round.deadline_at = ensure_aware(locked_round.started_at) + self._seconds_delta(locked_round.timer_seconds)
        locked_round.status = ArenaRoundStatus.ACTIVE
        db.add(locked_round)
        db.flush()
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="round.started",
            payload={
                "matchId": match.id,
                "roundId": locked_round.id,
                "roundIndex": locked_round.round_index,
                "timerSeconds": locked_round.timer_seconds,
                "deadlineAt": to_iso_utc(locked_round.deadline_at),
                "startsAt": to_iso_utc(locked_round.started_at),
                "activeRound": self._build_active_round_payload(locked_round),
            },
        )
        self._schedule_proactive_settle(match.id, locked_round.id, locked_round.timer_seconds + 0.5)
        return True

    def _ensure_round_progress(self, db: Session, match: ArenaMatchModel) -> ArenaMatchModel:
        # Check for player forfeits/abandonment first
        if match.status == ArenaMatchStatus.IN_PROGRESS:
            match = self._check_forfeits(db, match)
            if match.status == ArenaMatchStatus.FINISHED:
                return match

        rounds = self._get_rounds(db, match.id)
        active_round = self._get_active_round(rounds)
        pending_round = self._get_pending_round(rounds)
        if active_round and active_round.deadline_at and ensure_aware(active_round.deadline_at) <= utc_now():
            self._close_round(db, match, active_round)
            db.commit()
            return self.get_match(db, match.id)
        if pending_round and self._activate_round_if_ready(db, match, pending_round):
            db.commit()
            return self.get_match(db, match.id)
        if match.status == ArenaMatchStatus.IN_PROGRESS and not active_round and not pending_round:
            if rounds and all(round_item.status == ArenaRoundStatus.CLOSED for round_item in rounds):
                self._finalize_match_if_needed(db, match, rounds)
                db.commit()
                return self.get_match(db, match.id)
            if match.started_at and (utc_now() - ensure_aware(match.started_at)).total_seconds() > self.STALE_MATCH_FINALIZE_SECONDS:
                self._finalize_match_if_needed(db, match, rounds)
                db.commit()
                return self.get_match(db, match.id)
        return match

    def sweep_stale_matches(self, db: Session) -> int:
        """
        Global maintenance: finds all in_progress matches that should be finished.
        Returns the number of matches finalized.
        """
        now = utc_now()
        stale_threshold = self._seconds_delta(self.STALE_MATCH_FINALIZE_SECONDS)
        
        # 1. Handle in_progress matches (stale rounds)
        stale_matches = (
            db.query(ArenaMatchModel)
            .filter(
                ArenaMatchModel.status == ArenaMatchStatus.IN_PROGRESS,
                ArenaMatchModel.started_at < now - stale_threshold
            )
            .all()
        )
        
        count = 0
        for match in stale_matches:
            rounds = self._get_rounds(db, match.id)
            active_round = self._get_active_round(rounds)
            if active_round:
                self._close_round(db, match, active_round)
            
            self._finalize_match_if_needed(db, match, rounds)
            self._deactivate_match_queue_entries(db, match.id)
            count += 1
            
        # 2. Handle pending matches (expired acceptance deadline)
        expired_pending = (
            db.query(ArenaMatchModel)
            .filter(
                ArenaMatchModel.status == ArenaMatchStatus.PENDING,
                ArenaMatchModel.deadline_at < now
            )
            .all()
        )
        for match in expired_pending:
            match.status = ArenaMatchStatus.CANCELLED
            match.ended_at = now
            db.add(match)
            self._deactivate_match_queue_entries(db, match.id)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                match_id=match.id,
                event_type="match.cancelled",
                payload={"reason": "acceptance_timeout"},
            )
            count += 1

        if count > 0:
            db.commit()
        return count

    def confirm_match(self, db: Session, match_id: int, current_user: UserModel) -> dict:
        # Use with_for_update to handle simultaneous acceptance correctly
        match = (
            self._base_match_query(db)
            .filter(ArenaMatchModel.id == match_id)
            .with_for_update()
            .first()
        )
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        if match.status != ArenaMatchStatus.PENDING:
            # If already in_progress, just return current state
            if match.status == ArenaMatchStatus.IN_PROGRESS:
                return self.get_match_state(db, match.id, current_user)
            raise HTTPException(status_code=400, detail="Match is not in confirmation state")
        
        player = next((p for p in match.players if p.user_id == current_user.id), None)
        if not player:
            raise HTTPException(status_code=403, detail="You are not part of this match")

        self._start_match_acceptance_window_if_ready(db, match)
        if match.deadline_at is None:
            raise HTTPException(status_code=409, detail="Waiting for both players to connect")
        if ensure_aware(match.deadline_at) <= utc_now():
            raise HTTPException(status_code=409, detail="Acceptance window expired")
        
        if player.accepted_at:
            return self.get_match_state(db, match.id, current_user)

        player.accepted_at = utc_now()
        db.add(player)
        db.flush()

        # Check if all players have accepted
        all_accepted = all(p.accepted_at is not None for p in match.players)
        if all_accepted:
            match.status = ArenaMatchStatus.IN_PROGRESS
            match.started_at = utc_now()
            db.add(match)
            self.initialize_match_rounds(db, match.id)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                match_id=match.id,
                event_type="match.confirmed",
                payload={"matchId": match.id, "status": match.status},
            )
        else:
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                match_id=match.id,
                event_type="match.player_accepted",
                payload={"userId": current_user.id},
            )

        db.commit()
        return self.get_match_state(db, match.id, current_user)

    def forfeit_active_match(self, db: Session, user_id: int) -> None:
        """
        Forcefully settle any active matches for a user. Used when joining a new queue.
        """
        match = self.get_active_match_for_user(db, user_id)
        if match:
            # Quick settle: set status to finished immediately so player can re-match.
            # Rating and rewards are handled by background task.
            self._finalize_match_if_needed(db, match, self._get_rounds(db, match.id))
            db.commit()

    def _check_forfeits(self, db: Session, match: ArenaMatchModel) -> ArenaMatchModel:
        self.presence_service.sweep_match_presence(db, match)
        
        abandoned_players = [p for p in match.players if p.suspected_abandonment]
        if not abandoned_players:
            return match
            
        # For competitive matches (usually 1v1), if at least one is abandoned, the match ends
        if match.mode == ArenaMode.COMPETITIVE and len(match.players) == 2:
            # If all players are abandoned/offline, end it too
            self._finalize_match_if_needed(db, match, self._get_rounds(db, match.id))
            db.commit()
            return self.get_match(db, match.id)
            
        # For other modes, if EVERYONE is gone, end it
        all_gone = all(p.suspected_abandonment or p.connection_state == "disconnected" for p in match.players)
        if all_gone:
            self._finalize_match_if_needed(db, match, self._get_rounds(db, match.id))
            db.commit()
            return self.get_match(db, match.id)

        return match

    def _finalize_match_if_needed(
        self,
        db: Session,
        match: ArenaMatchModel,
        rounds: list[ArenaRoundModel],
    ) -> None:
        if match.status == ArenaMatchStatus.FINISHED or match.winner_user_id is not None:
            return

        standings = self._build_standings(match, rounds)
        match.completed_round_count = max(int(match.completed_round_count or 0), len(rounds))
        match.status = ArenaMatchStatus.FINISHED
        match.ended_at = match.ended_at or utc_now()
        db.add(match)
        self._deactivate_match_queue_entries(db, match.id)
        
        # Immediate event broadcast for UI feedback
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="match.finished",
            payload={
                "matchId": match.id,
                "standings": standings,
                "recovered": True,
            },
        )
        
        # Rating settlement and rewards
        if self.INTERMISSION_SECONDS <= 0.1:
            # Synchronous settlement for tests or low-latency modes
            match.standings_json = self.rating_service.settle_match(db, match, standings)
            if match.standings_json:
                top_row = match.standings_json[0]
                top_user_id = top_row.get("userId")
                match.winner_user_id = int(top_user_id) if top_user_id is not None else None
            db.add(match)
            # Process rewards synchronously
            self.reward_service.process_match_rewards(db, match.id)
            db.commit()
            return

        # Heavy lifting moved to background for production
        def _settle_in_background(target_match_id: int, final_standings: list[dict]):
            from app.db.session import SessionLocal
            with SessionLocal() as bg_db:
                bg_match = bg_db.get(ArenaMatchModel, target_match_id)
                if not bg_match:
                    return
                # Settle ratings (heavy IO)
                bg_match.standings_json = self.rating_service.settle_match(bg_db, bg_match, final_standings)
                if bg_match.standings_json:
                    top_row = bg_match.standings_json[0]
                    top_user_id = top_row.get("userId")
                    bg_match.winner_user_id = int(top_user_id) if top_user_id is not None else None
                bg_db.add(bg_match)
                bg_db.commit()
                # Process rewards (heavy IO)
                self.reward_service.process_match_rewards(bg_db, target_match_id)

        if self.background_tasks:
            self.background_tasks.add_task(_settle_in_background, match.id, standings)
        else:
            # Fallback for sync contexts or testing
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                loop.create_task(asyncio.to_thread(_settle_in_background, match.id, standings))
            except RuntimeError:
                import threading
                threading.Thread(target=_settle_in_background, args=(match.id, standings), daemon=True).start()

    def _deactivate_match_queue_entries(self, db: Session, match_id: int):
        from app.arena.models.arena_queue import ArenaQueueEntryModel
        from app.arena.domain.arena_statuses import ArenaQueueStatus
        entries = db.query(ArenaQueueEntryModel).filter(ArenaQueueEntryModel.match_id == match_id).all()
        for entry in entries:
            if entry.status == ArenaQueueStatus.MATCHED:
                entry.status = ArenaQueueStatus.CANCELLED
                entry.closed_at = utc_now()
                db.add(entry)
        
        # CLEANUP: Remove match player presence records to keep DB lean
        db.query(ArenaMatchPlayerModel).filter(ArenaMatchPlayerModel.match_id == match_id).update({
            "connection_state": "disconnected",
            "last_seen_at": utc_now()
        })

    @property
    def INTERMISSION_SECONDS(self) -> int:
        return arena_settings.ARENA_INTERMISSION_SECONDS

    def _close_round(self, db: Session, match: ArenaMatchModel, round_model: ArenaRoundModel) -> None:
        # 1. LOCK the round row to prevent multiple threads from closing it simultaneously
        # We need to re-fetch or refresh it with a lock
        locked_round = (
            db.query(ArenaRoundModel)
            .filter(ArenaRoundModel.id == round_model.id)
            .with_for_update()
            .first()
        )
        
        if not locked_round or locked_round.status != ArenaRoundStatus.ACTIVE:
            # Round is already closed or being closed by another process
            return
        
        # Sync the reference for the rest of the function
        round_model = locked_round

        answered_user_ids = {
            row[0]
            for row in db.query(ArenaAnswerModel.user_id)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .all()
        }
        for player in match.players:
            if player.user_id in answered_user_ids:
                continue
            db.add(
                ArenaAnswerModel(
                    match_id=match.id,
                    round_id=round_model.id,
                    user_id=player.user_id,
                    selected_option_id=None,
                    answer_payload_json={"selectedOptionId": None, "timedOut": True},
                    is_correct=False,
                    score_awarded=0,
                    response_time_ms=None,
                    submitted_at=utc_now(),
                )
            )
        db.flush()

        question = round_model.question_snapshot_json if isinstance(round_model.question_snapshot_json, dict) else {}
        round_model.answered_count = (
            db.query(ArenaAnswerModel)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .count()
        )
        round_model.correct_count = (
            db.query(ArenaAnswerModel)
            .filter(
                ArenaAnswerModel.round_id == round_model.id,
                ArenaAnswerModel.is_correct.is_(True),
            )
            .count()
        )
        round_model.status = ArenaRoundStatus.CLOSED
        round_model.closed_at = utc_now()
        round_model.revealed_answer_json = {
            "questionType": question.get("questionType") or question.get("question_type") or question.get("component") or "Unknown",
            "prompt": question.get("prompt") or question.get("question") or "",
            "options": question.get("options") or question.get("pairs") or question.get("steps") or [],
            "correctOptionId": question.get("correct_option_id"),
            "explanation": question.get("explanation") or "",
        }
        db.add(round_model)
        db.flush() # Ensure status is available for remaining_rounds query in submit_answer

        match.completed_round_count = max(int(match.completed_round_count or 0), round_model.round_index + 1)
        db.add(match)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="round.revealed",
            payload={
                "matchId": match.id,
                "roundId": round_model.id,
                "roundIndex": round_model.round_index,
                "revealedAnswer": round_model.revealed_answer_json,
            },
        )

        all_rounds = self._get_rounds(db, match.id)
        next_round = next(
            (
                item
                for item in all_rounds
                if item.round_index == round_model.round_index + 1 and item.status == ArenaRoundStatus.PENDING
            ),
            None,
        )
        if next_round:
            reveal_started_at = utc_now()
            next_round.started_at = reveal_started_at + self._seconds_delta(self.INTERMISSION_SECONDS)
            next_round.deadline_at = next_round.started_at + self._seconds_delta(next_round.timer_seconds)
            db.add(next_round)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.waiting",
                payload={
                    "matchId": match.id,
                    "roundId": next_round.id,
                    "roundIndex": next_round.round_index,
                    "timerSeconds": next_round.timer_seconds,
                    "activeRound": self._build_active_round_payload(next_round),
                },
            )
        else:
            # Last round finished - delay finalization by 5 seconds so users can see the answer
            self._schedule_proactive_finalize(db, match.id, self.INTERMISSION_SECONDS)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="standings.updated",
            payload={
                "matchId": match.id,
                "standings": self._build_standings(match, self._get_rounds(db, match.id)),
            },
        )

    def _build_revealed_answer_payload(self, question: dict) -> dict:
        return {
            "questionType": question.get("questionType") or question.get("question_type") or question.get("component") or "Unknown",
            "prompt": question.get("prompt") or question.get("question") or "",
            "options": question.get("options") or question.get("pairs") or question.get("steps") or [],
            "correctOptionId": question.get("correct_option_id"),
            "explanation": question.get("explanation") or "",
        }

    def _build_standings(self, match: ArenaMatchModel, rounds: list[ArenaRoundModel]) -> list[dict]:
        answer_map: dict[int, list[ArenaAnswerModel]] = {player.user_id: [] for player in match.players}
        for round_item in rounds:
            for answer in round_item.answers:
                answer_map.setdefault(answer.user_id, []).append(answer)

        rows = []
        for player in match.players:
            answers = answer_map.get(player.user_id, [])
            score = sum(answer.score_awarded for answer in answers)
            correct_count = sum(1 for answer in answers if answer.is_correct)
            answered_count = len(answers)
            incorrect_count = answered_count - correct_count
            response_times = [answer.response_time_ms for answer in answers if answer.response_time_ms is not None]
            average_response_ms = int(mean(response_times)) if response_times else None
            rows.append(
                {
                    "userId": player.user_id,
                    "displayName": (player.user_snapshot_json or {}).get("displayName") 
                        or player.user.full_name 
                        or player.user.email.split("@")[0],
                    "avatarUrl": (player.user_snapshot_json or {}).get("avatarUrl") or player.user.avatar_url,
                    "level": (player.user_snapshot_json or {}).get("level") or player.user.level,
                    "score": score,
                    "correctCount": correct_count,
                    "incorrectCount": incorrect_count,
                    "answeredCount": answered_count,
                    "averageResponseMs": average_response_ms,
                }
            )

        rows.sort(key=lambda item: (-item["score"], -item["correctCount"], item["averageResponseMs"] or 10**9, item["displayName"]))
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        return rows

    def _build_active_round_payload(self, active_round: ArenaRoundModel, current_user_id: int | None = None) -> dict:
        question = active_round.question_snapshot_json if isinstance(active_round.question_snapshot_json, dict) else {}
        return {
            "roundId": active_round.id,
            "roundIndex": active_round.round_index,
            "status": active_round.status,
            "timerSeconds": active_round.timer_seconds,
            "startedAt": to_iso_utc(active_round.started_at),
            "deadlineAt": to_iso_utc(active_round.deadline_at),
            "revealedAnswer": active_round.revealed_answer_json,
            "question": {
                "questionId": str(question.get("question_id") or active_round.id),
                "questionType": str(question.get("question_type") or "Unknown"),
                "prompt": str(question.get("prompt") or ""),
                "options": list(question.get("options") or []),
                "difficulty": question.get("difficulty"),
                "knowledgeTags": list(question.get("knowledge_tags") or []),
            },
            "submittedPlayerIds": [answer.user_id for answer in active_round.answers],
            "hasSubmitted": any(answer.user_id == current_user_id for answer in active_round.answers) if current_user_id else False,
        }

    def _build_match_sync_payload(
        self, 
        db: Session, 
        match: ArenaMatchModel, 
        rounds: list[ArenaRoundModel], 
        current_user_id: int | None = None
    ) -> dict:
        active_round = self._get_active_round(rounds)
        standings = (
            match.standings_json 
            if isinstance(match.standings_json, list) and match.status == ArenaMatchStatus.FINISHED 
            else self._build_standings(match, rounds)
        )
        current_player_result = None
        if current_user_id:
            current_player_result = next(
                (row for row in standings if int(row.get("userId", 0)) == current_user_id),
                None,
            )

        # Return the current round even while it is pending so the client can
        # show a loading buffer before the round becomes active.
        remaining_rounds_count = db.query(ArenaRoundModel).filter(
            ArenaRoundModel.match_id == match.id,
            ArenaRoundModel.status.in_((ArenaRoundStatus.ACTIVE, ArenaRoundStatus.PENDING))
        ).count()

        current_round = self._get_current_round(rounds)
        active_round_payload = None
        if current_round and match.status == ArenaMatchStatus.IN_PROGRESS and remaining_rounds_count > 0:
            active_round_payload = self._build_active_round_payload(current_round, current_user_id)

        current_round_index = current_round.round_index if current_round else max((round_item.round_index for round_item in rounds), default=0)

        match_state = {
            "matchId": match.id,
            "roomCode": match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            "status": match.status,
            "mode": match.mode,
            "publicCourseId": match.public_course_id,
            "publicCourseTitle": match.public_course.title if match.public_course else "Unknown",
            "totalRounds": len(rounds),
            "currentRoundIndex": current_round_index,
            "activeRound": active_round_payload,
            "standings": standings,
            "currentPlayerResult": current_player_result,
            "presenceStates": self.presence_service.build_match_presence_states(match),
            "startedAt": to_iso_utc(match.started_at),
            "deadlineAt": to_iso_utc(match.deadline_at),
            "endedAt": to_iso_utc(match.ended_at),
        }
        return match_state

    def get_match_state(self, db: Session, match_id: int, current_user: UserModel) -> dict:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")
        self._ensure_participant(match, current_user)

        match = self._ensure_round_progress(db, match)
        # Presence touch is only needed while a match is still active.
        # Skipping writes for finalized states prevents lock storms during post-match polling.
        if match.status in (ArenaMatchStatus.PENDING, ArenaMatchStatus.IN_PROGRESS):
            self.presence_service.touch_match_presence(db, match, current_user)
            self._start_match_acceptance_window_if_ready(db, match)
        db.flush()
        rounds = self._get_rounds(db, match.id)
        payload = self._build_match_sync_payload(db, match, rounds, current_user.id)
        db.commit()
        return payload

    def submit_answer(
        self,
        db: Session,
        *,
        match_id: int,
        round_id: int,
        current_user: UserModel,
        selected_option_id: str | None = None,
        answer_payload: dict | None = None,
    ) -> dict:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")
        self._ensure_participant(match, current_user)
        match = self._ensure_round_progress(db, match)
        self.presence_service.touch_match_presence(db, match, current_user)
        db.flush()
        if match.status != ArenaMatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Arena match is not accepting answers")

        round_model = (
            self._base_round_query(db)
            .filter(ArenaRoundModel.id == round_id, ArenaRoundModel.match_id == match.id)
            .first()
        )
        if not round_model:
            raise HTTPException(status_code=404, detail="Arena round not found")
        if round_model.status != ArenaRoundStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="Arena round is not active")

        existing = (
            db.query(ArenaAnswerModel)
            .filter(
                ArenaAnswerModel.round_id == round_model.id,
                ArenaAnswerModel.user_id == current_user.id,
            )
            .first()
        )
        if existing:
            state = self.get_match_state(db, match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": True,
                "roundClosed": round_model.status == ArenaRoundStatus.CLOSED,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }

        if round_model.deadline_at and ensure_aware(round_model.deadline_at) <= utc_now():
            self._close_round(db, match, round_model)
            db.commit()
            state = self.get_match_state(db, match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": False,
                "roundClosed": True,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }

        # Reject early submissions during intermission (startedAt is in the future)
        if round_model.started_at and ensure_aware(round_model.started_at) > utc_now():
            state = self.get_match_state(db, match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": False,
                "roundClosed": False,
                "matchFinished": False,
                "earlySubmission": True,
                "state": state,
            }

        question = round_model.question_snapshot_json if isinstance(round_model.question_snapshot_json, dict) else {}
        revealed_answer = self._build_revealed_answer_payload(question)
        correct_option_id = str(question.get("correct_option_id") or "")
        is_correct = selected_option_id == correct_option_id
        response_time_ms = None
        if round_model.started_at:
            response_time_ms = max(0, int((utc_now() - ensure_aware(round_model.started_at)).total_seconds() * 1000))
        self.presence_service.record_answer_submission(
            db,
            match=match,
            user_id=current_user.id,
            response_time_ms=response_time_ms,
        )
        score_awarded = self.scoring_service.score_answer(
            is_correct=is_correct,
            response_time_ms=response_time_ms,
            timer_seconds=round_model.timer_seconds,
        )
        try:
            db.add(
                ArenaAnswerModel(
                    match_id=match.id,
                    round_id=round_model.id,
                    user_id=current_user.id,
                    answer_payload_json=answer_payload or {"selectedOptionId": selected_option_id},
                    selected_option_id=selected_option_id,
                    is_correct=is_correct,
                    score_awarded=score_awarded,
                    response_time_ms=response_time_ms,
                    submitted_at=utc_now(),
                )
            )
            db.flush()
            round_model.answered_count = (
                db.query(ArenaAnswerModel)
                .filter(ArenaAnswerModel.round_id == round_model.id)
                .count()
            )
            round_model.correct_count = (
                db.query(ArenaAnswerModel)
                .filter(
                    ArenaAnswerModel.round_id == round_model.id,
                    ArenaAnswerModel.is_correct.is_(True),
                )
                .count()
            )
            db.add(round_model)
        except IntegrityError:
            db.rollback()
            refreshed_match = self.get_match(db, match.id)
            if not refreshed_match:
                raise HTTPException(status_code=404, detail="Arena match not found")
            state = self.get_match_state(db, refreshed_match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": True,
                "roundClosed": round_model.status == ArenaRoundStatus.CLOSED,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="round.answer_received",
            payload={
                "matchId": match.id,
                "roundId": round_model.id,
                "userId": current_user.id,
                "selectedOptionId": selected_option_id,
                "answerPayload": answer_payload,
                "isCorrect": is_correct,
                "scoreAwarded": score_awarded,
                "activeRound": self._build_active_round_payload(round_model),
            },
        )

        # Push a standings refresh immediately so both players see score changes
        # as soon as either side submits, instead of waiting for round closure.
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="standings.updated",
            payload={
                "matchId": match.id,
                "standings": self._build_standings(match, self._get_rounds(db, match.id)),
            },
        )

        answer_count = (
            db.query(ArenaAnswerModel)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .count()
        )
        round_closed = False
        if answer_count >= len(match.players):
            round_closed = True
            refreshed_round = self._base_round_query(db).filter(ArenaRoundModel.id == round_model.id).first()
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.answer_locked",
                payload={
                    "matchId": match.id,
                    "roundId": refreshed_round.id,
                    "roundIndex": refreshed_round.round_index,
                },
            )
            self._close_round(db, match, refreshed_round)

        db.commit()
        
        # match_actually_finished is true if there are no more active or pending rounds
        remaining_rounds_count = db.query(ArenaRoundModel).filter(
            ArenaRoundModel.match_id == match.id,
            ArenaRoundModel.status.in_((ArenaRoundStatus.ACTIVE, ArenaRoundStatus.PENDING))
        ).count()
        
        match_actually_finished = (remaining_rounds_count == 0)

        state = self.get_match_state(db, match.id, current_user)
        return {
            "accepted": True,
            "alreadySubmitted": False,
            "isCorrect": is_correct,
            "scoreAwarded": score_awarded,
            "responseTimeMs": response_time_ms,
            "selectedOptionId": selected_option_id,
            "revealedAnswer": revealed_answer,
            "roundClosed": round_closed,
            "matchFinished": match_actually_finished,
            "state": state,
        }

    def _schedule_proactive_settle(self, match_id: int, round_id: int, delay_seconds: float):
        """
        Schedules a background settlement task to ensure the round closes even if no one polls.
        """
        def _proactive_task():
            import time
            from app.db.session import SessionLocal
            
            time.sleep(delay_seconds)
            
            with SessionLocal() as db:
                match = self.get_match(db, match_id)
                if not match or match.status != ArenaMatchStatus.IN_PROGRESS:
                    return
                
                # This check internally handles dead-line closing
                self._ensure_round_progress(db, match)
                db.commit()

        # We can use threading because it's a simple sleep-and-call,
        # making it compatible with any FastAPI deployment.
        import threading
        threading.Thread(target=_proactive_task, daemon=True).start()

    def _schedule_proactive_finalize(self, db: Session, match_id: int, delay_seconds: float):
        """
        Schedules the final match settlement after a delay (e.g., after the last round's reveal).
        For tests (delay_seconds <= 0), it runs synchronously to avoid session isolation issues.
        """
        if delay_seconds <= 0.1:
            # Use the existing session for synchronous finalization
            match = self.get_match(db, match_id)
            if match and match.status == ArenaMatchStatus.IN_PROGRESS:
                all_rounds = self._get_rounds(db, match_id)
                self._finalize_match_if_needed(db, match, all_rounds)
            return

        def _finalize_task():
            import time
            from app.db.session import SessionLocal
            
            time.sleep(delay_seconds)
            
            with SessionLocal() as db:
                match = self.get_match(db, match_id)
                if not match or match.status != ArenaMatchStatus.IN_PROGRESS:
                    return
                
                all_rounds = self._get_rounds(db, match.id)
                self._finalize_match_if_needed(db, match, all_rounds)
                
                # If it's a room match, return the room to LOBBY
                if match.room_id:
                    from app.arena.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
                    from app.arena.domain.arena_statuses import ArenaRoomStatus
                    
                    room = db.query(ArenaRoomModel).filter(ArenaRoomModel.id == match.room_id).first()
                    if room:
                        room.status = ArenaRoomStatus.LOBBY
                        room.latest_match_id = match.id
                        players = (
                            db.query(ArenaRoomPlayerModel)
                            .filter(ArenaRoomPlayerModel.room_id == room.id)
                            .all()
                        )
                        for player in players:
                            player.is_ready = False
                            db.add(player)
                        db.add(room)
                
                db.commit()

        import threading
        threading.Thread(target=_finalize_task, daemon=True).start()
