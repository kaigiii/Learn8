from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.time import utc_now_naive
from app.domain.arena_statuses import ArenaMatchStatus
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.models.arena_round import ArenaRoundModel
from app.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel


class AdminService:
    def list_public_courses(self, db: Session) -> list[PublicCourseModel]:
        return db.query(PublicCourseModel).order_by(PublicCourseModel.created_at.desc()).all()

    def upsert_public_course(
        self,
        db: Session,
        *,
        public_course_id: int | None,
        payload: dict,
    ) -> PublicCourseModel:
        if public_course_id is not None:
            course = db.query(PublicCourseModel).filter(PublicCourseModel.id == public_course_id).first()
        else:
            course = None

        if course is None:
            course = PublicCourseModel()
            db.add(course)

        course.slug = payload["slug"].strip()
        course.title = payload["title"].strip()
        course.topic = payload["topic"].strip()
        course.description = payload.get("description")
        course.difficulty = payload.get("difficulty") or "intermediate"
        course.is_published = bool(payload.get("isPublished"))
        course.is_arena_enabled = bool(payload.get("isArenaEnabled"))
        course.tags_json = list(payload.get("tags") or [])
        db.commit()
        db.refresh(course)
        return course

    def list_question_pools(
        self,
        db: Session,
        *,
        public_course_id: int | None = None,
    ) -> list[ArenaQuestionPoolModel]:
        query = db.query(ArenaQuestionPoolModel).options(selectinload(ArenaQuestionPoolModel.items))
        if public_course_id is not None:
            query = query.filter(ArenaQuestionPoolModel.public_course_id == public_course_id)
        return query.order_by(ArenaQuestionPoolModel.updated_at.desc()).all()

    def list_seasons(self, db: Session) -> list[ArenaSeasonModel]:
        return (
            db.query(ArenaSeasonModel)
            .order_by(ArenaSeasonModel.is_active.desc(), ArenaSeasonModel.created_at.desc())
            .all()
        )

    def list_player_match_records(
        self,
        db: Session,
        *,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        query = (
            db.query(ArenaMatchPlayerModel, ArenaMatchModel, UserModel, PublicCourseModel)
            .join(ArenaMatchModel, ArenaMatchModel.id == ArenaMatchPlayerModel.match_id)
            .join(UserModel, UserModel.id == ArenaMatchPlayerModel.user_id)
            .join(PublicCourseModel, PublicCourseModel.id == ArenaMatchModel.public_course_id)
        )
        normalized_search = (search or "").strip().lower()
        if normalized_search:
            like = f"%{normalized_search}%"
            query = query.filter(
                (UserModel.email.ilike(like)) | (UserModel.full_name.ilike(like))
            )

        rows = (
            query.order_by(
                ArenaMatchModel.started_at.desc(),
                ArenaMatchModel.id.desc(),
                ArenaMatchPlayerModel.id.desc(),
            )
            .limit(min(max(limit, 1), 200))
            .all()
        )
        return [
            {
                "matchId": match.id,
                "userId": user.id,
                "displayName": user.full_name or user.email.split("@")[0],
                "email": user.email,
                "publicCourseTitle": public_course.title,
                "mode": match.mode,
                "status": match.status,
                "finalRank": match_player.final_rank,
                "score": match_player.score,
                "correctCount": match_player.correct_count,
                "incorrectCount": match_player.incorrect_count,
                "ratingDelta": match_player.rating_delta,
                "startedAt": match.started_at.isoformat() if match.started_at else None,
                "endedAt": match.ended_at.isoformat() if match.ended_at else None,
            }
            for match_player, match, user, public_course in rows
        ]

    def list_match_reviews(self, db: Session, *, limit: int = 25) -> list[dict]:
        matches = (
            db.query(ArenaMatchModel)
            .options(
                selectinload(ArenaMatchModel.players).selectinload(ArenaMatchPlayerModel.user),
                selectinload(ArenaMatchModel.public_course),
                selectinload(ArenaMatchModel.players),
            )
            .order_by(ArenaMatchModel.started_at.desc(), ArenaMatchModel.id.desc())
            .limit(min(max(limit, 1), 100))
            .all()
        )
        rounds_by_match_id: dict[int, list[ArenaRoundModel]] = {}
        if matches:
            match_ids = [match.id for match in matches]
            rounds = (
                db.query(ArenaRoundModel)
                .filter(ArenaRoundModel.match_id.in_(match_ids))
                .options(selectinload(ArenaRoundModel.answers))
                .all()
            )
            for round_model in rounds:
                rounds_by_match_id.setdefault(round_model.match_id, []).append(round_model)

        return [self._serialize_match_review(match, rounds_by_match_id.get(match.id, [])) for match in matches]

    def upsert_season(
        self,
        db: Session,
        *,
        season_id: int | None,
        payload: dict,
    ) -> ArenaSeasonModel:
        if season_id is not None:
            season = db.query(ArenaSeasonModel).filter(ArenaSeasonModel.id == season_id).first()
        else:
            season = None

        if season is None:
            season = ArenaSeasonModel()
            db.add(season)

        started_at = self._parse_optional_datetime(payload.get("startedAt"))
        ended_at = self._parse_optional_datetime(payload.get("endedAt"))
        if started_at and ended_at and ended_at < started_at:
            raise HTTPException(status_code=422, detail="Season end time must be after the start time")

        season.name = str(payload["name"]).strip()
        season.status = str(payload.get("status") or "upcoming").strip()
        season.is_active = bool(payload.get("isActive"))
        season.started_at = started_at
        season.ended_at = ended_at
        season.leaderboard_config_json = dict(payload.get("leaderboardConfig") or {})
        season.reward_config_json = dict(payload.get("rewardConfig") or {})
        db.add(season)
        db.flush()

        if season.is_active:
            (
                db.query(ArenaSeasonModel)
                .filter(ArenaSeasonModel.id != season.id, ArenaSeasonModel.is_active.is_(True))
                .update({"is_active": False}, synchronize_session=False)
            )

        db.commit()
        db.refresh(season)
        return season

    def upsert_question_pool(
        self,
        db: Session,
        *,
        pool_id: int | None,
        payload: dict,
    ) -> ArenaQuestionPoolModel:
        public_course = (
            db.query(PublicCourseModel)
            .filter(PublicCourseModel.id == payload["publicCourseId"])
            .first()
        )
        if public_course is None:
            raise HTTPException(status_code=404, detail="Public course not found")

        if pool_id is not None:
            pool = (
                db.query(ArenaQuestionPoolModel)
                .options(selectinload(ArenaQuestionPoolModel.items))
                .filter(ArenaQuestionPoolModel.id == pool_id)
                .first()
            )
        else:
            pool = None

        if pool is None:
            pool = ArenaQuestionPoolModel(public_course_id=payload["publicCourseId"])
            db.add(pool)
            db.flush()

        pool.public_course_id = payload["publicCourseId"]
        pool.slug = payload["slug"].strip()
        pool.title = payload["title"].strip()
        pool.description = payload.get("description")
        pool.is_active = bool(payload.get("isActive"))
        pool.version = int(payload.get("version") or 1)
        db.add(pool)
        db.flush()

        existing_by_key = {item.question_key: item for item in list(pool.items)}
        incoming_keys: set[str] = set()
        for raw_item in list(payload.get("items") or []):
            question_key = str(raw_item["questionKey"]).strip()
            incoming_keys.add(question_key)
            item = existing_by_key.get(question_key)
            if item is None:
                item = ArenaQuestionPoolItemModel(pool_id=pool.id, question_key=question_key)
                db.add(item)

            item.question_key = question_key
            item.prompt = raw_item["prompt"].strip()
            item.options_json = list(raw_item.get("options") or [])
            item.correct_option_id = str(raw_item["correctOptionId"]).strip()
            item.difficulty = raw_item.get("difficulty") or "normal"
            item.knowledge_tags_json = list(raw_item.get("knowledgeTags") or [])
            item.explanation = raw_item.get("explanation")
            item.source_unit_id = raw_item.get("sourceUnitId")
            item.source_node_id = raw_item.get("sourceNodeId")
            item.is_active = bool(raw_item.get("isActive", True))
            db.add(item)

        for existing_item in list(pool.items):
            if existing_item.question_key not in incoming_keys:
                db.delete(existing_item)

        db.commit()
        return (
            db.query(ArenaQuestionPoolModel)
            .options(selectinload(ArenaQuestionPoolModel.items))
            .filter(ArenaQuestionPoolModel.id == pool.id)
            .first()
        )

    def serialize_public_course(self, course: PublicCourseModel) -> dict:
        return {
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "topic": course.topic,
            "description": course.description,
            "difficulty": course.difficulty,
            "isPublished": bool(course.is_published),
            "isArenaEnabled": bool(course.is_arena_enabled),
            "tags": list(course.tags_json or []),
        }

    def serialize_question_pool(self, pool: ArenaQuestionPoolModel) -> dict:
        sorted_items = sorted(pool.items, key=lambda item: item.id)
        return {
            "id": pool.id,
            "publicCourseId": pool.public_course_id,
            "slug": pool.slug,
            "title": pool.title,
            "description": pool.description,
            "isActive": bool(pool.is_active),
            "version": pool.version,
            "items": [
                {
                    "id": item.id,
                    "questionKey": item.question_key,
                    "prompt": item.prompt,
                    "options": list(item.options_json or []),
                    "correctOptionId": item.correct_option_id,
                    "difficulty": item.difficulty,
                    "knowledgeTags": list(item.knowledge_tags_json or []),
                    "explanation": item.explanation,
                    "sourceUnitId": item.source_unit_id,
                    "sourceNodeId": item.source_node_id,
                    "isActive": bool(item.is_active),
                }
                for item in sorted_items
            ],
        }

    def serialize_season(self, season: ArenaSeasonModel) -> dict:
        return {
            "id": season.id,
            "name": season.name,
            "status": season.status,
            "isActive": bool(season.is_active),
            "startedAt": season.started_at.isoformat() if season.started_at else None,
            "endedAt": season.ended_at.isoformat() if season.ended_at else None,
            "leaderboardConfig": dict(season.leaderboard_config_json or {}),
            "rewardConfig": dict(season.reward_config_json or {}),
        }

    def _serialize_match_review(self, match: ArenaMatchModel, rounds: list[ArenaRoundModel]) -> dict:
        player_count = len(match.players)
        round_count = len(rounds)
        answer_count = sum(len(round_model.answers) for round_model in rounds)
        timed_out_count = sum(
            1
            for round_model in rounds
            for answer in round_model.answers
            if isinstance(answer.answer_payload_json, dict) and answer.answer_payload_json.get("timedOut")
        )
        anomaly_flags: list[str] = []
        expected_max_answers = player_count * round_count
        standings = match.standings_json if isinstance(match.standings_json, list) else []
        low_completion_present = False
        abandonment_penalty_present = False
        suspicious_latency_present = False
        repeated_disconnect_present = False

        for standing in standings:
            completion_ratio = standing.get("completionRatio")
            answered_count = standing.get("answeredCount")
            abandonment_penalty = standing.get("abandonmentPenalty")

            if isinstance(abandonment_penalty, int) and abandonment_penalty > 0:
                abandonment_penalty_present = True

            if isinstance(completion_ratio, (int, float)):
                if float(completion_ratio) < 0.6:
                    low_completion_present = True
            elif round_count > 0 and isinstance(answered_count, int):
                if (answered_count / round_count) < 0.6:
                    low_completion_present = True

        for match_player in match.players:
            metadata = match_player.metadata_json if isinstance(match_player.metadata_json, dict) else {}
            if int(metadata.get("suspicious_low_latency_count") or 0) > 0:
                suspicious_latency_present = True
            if int(metadata.get("disconnect_count") or 0) >= 2 or bool(metadata.get("suspected_abandonment")):
                repeated_disconnect_present = True

        if (
            match.status == ArenaMatchStatus.IN_PROGRESS
            and match.started_at
            and (utc_now_naive() - match.started_at).total_seconds() > 1800
        ):
            anomaly_flags.append("stalled_match")
        if match.status == ArenaMatchStatus.FINISHED and not isinstance(match.standings_json, list):
            anomaly_flags.append("missing_standings")
        if expected_max_answers and answer_count > expected_max_answers:
            anomaly_flags.append("answer_overflow")
        if player_count > 0 and timed_out_count >= max(2, player_count):
            anomaly_flags.append("high_timeout_rate")
        if low_completion_present:
            anomaly_flags.append("low_completion_rate")
        if abandonment_penalty_present:
            anomaly_flags.append("abandonment_penalty_applied")
        if suspicious_latency_present:
            anomaly_flags.append("suspicious_latency_pattern")
        if repeated_disconnect_present:
            anomaly_flags.append("reconnect_instability")

        return {
            "matchId": match.id,
            "publicCourseTitle": match.public_course.title if match.public_course else "Unknown",
            "mode": match.mode,
            "status": match.status,
            "playerCount": player_count,
            "roundCount": round_count,
            "answerCount": answer_count,
            "timedOutCount": timed_out_count,
            "anomalyFlags": anomaly_flags,
            "startedAt": match.started_at.isoformat() if match.started_at else None,
            "endedAt": match.ended_at.isoformat() if match.ended_at else None,
        }

    def _parse_optional_datetime(self, value: str | None) -> datetime | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        try:
            return datetime.fromisoformat(normalized.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid datetime value: {value}") from exc
