from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.time import utc_now, to_iso_utc
from app.arena.domain.arena_statuses import ArenaMatchStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.arena.models.arena_round import ArenaRoundModel
from app.arena.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.models.lesson import LessonModel, LessonStageModel


class AdminService:
    def list_public_courses(self, db: Session) -> list[PublicCourseModel]:
        return db.query(PublicCourseModel).order_by(PublicCourseModel.is_published.desc(), PublicCourseModel.created_at.desc()).all()

    def toggle_public_course_status(self, db: Session, course_id: int, is_published: bool) -> PublicCourseModel:
        public_course = db.query(PublicCourseModel).filter(PublicCourseModel.id == course_id).first()
        if not public_course:
            raise HTTPException(status_code=404, detail="Public course not found")
        
        public_course.is_published = is_published
        public_course.updated_at = utc_now()
        
        # 1. Sync to the Original Creator's Course
        if public_course.source_course_id:
            from app.models.course import CourseModel
            original_course = db.query(CourseModel).filter(CourseModel.id == public_course.source_course_id).first()
            if original_course:
                original_course.is_published = is_published

        # 2. Sync to the system-owned CourseModel (Learning Catalog)
        from app.api.v1.endpoints.courses import SYSTEM_USER_EMAIL
        system_user = db.query(UserModel).filter(UserModel.email == SYSTEM_USER_EMAIL).first()
        if system_user:
            from app.models.course import CourseModel
            system_course = db.query(CourseModel).filter(
                CourseModel.user_id == system_user.id,
                CourseModel.topic == public_course.topic
            ).first()
            if system_course:
                from app.domain.statuses import CourseStatus
                system_course.is_published = is_published
                system_course.status = CourseStatus.READY if is_published else CourseStatus.ARCHIVED
        
        db.commit()
        db.refresh(public_course)
        return public_course


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
                "startedAt": to_iso_utc(match.started_at),
                "endedAt": to_iso_utc(match.ended_at),
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

        pool.public_course_id = payload["publicCourseId"]
        pool.slug = payload["slug"].strip()
        pool.title = payload["title"].strip()
        pool.description = payload.get("description")
        pool.is_active = bool(payload.get("isActive"))
        pool.version = int(payload.get("version") or 1)
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
            
            qtype = raw_item.get("questionType")
            if not qtype:
                raise ValueError(f"Missing questionType for item {question_key}")
            item.question_type = str(qtype)
            
            item.prompt = raw_item["prompt"].strip()
            
            # Persist Feynman fields in options_json to avoid DB migration
            if item.question_type == "FeynmanMirror":
                item.options_json = [{
                    "sampleAnswer": raw_item.get("sampleAnswer"),
                    "maxRounds": raw_item.get("maxRounds")
                }]
            else:
                item.options_json = list(raw_item.get("options") or [])
                
            item.correct_option_id = str(raw_item.get("correctOptionId", "")).strip() if raw_item.get("correctOptionId") else None
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

    def delete_question_pool(self, db: Session, pool_id: int) -> bool:
        pool = db.query(ArenaQuestionPoolModel).filter(ArenaQuestionPoolModel.id == pool_id).first()
        if not pool:
            return False
        db.delete(pool)
        db.commit()
        return True

    def extract_questions_from_syllabus(
        self,
        db: Session,
        public_course_id: int,
    ) -> list[dict]:
        course = db.query(PublicCourseModel).filter(PublicCourseModel.id == public_course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Public course not found")

        syllabus = course.syllabus_json
        if not syllabus or not isinstance(syllabus, dict) or "units" not in syllabus:
            return []

        extracted = []
        for unit in syllabus.get("units") or []:
            u_id = unit.get("unitId", "U")
            u_title = unit.get("unitTitle", "Untitled Unit")
            for node in unit.get("nodes") or []:
                n_id = node.get("id", "N")
                n_title = node.get("title", "Untitled Node")
                
                context = {
                    "unitId": u_id,
                    "unitTitle": u_title,
                    "nodeId": n_id,
                    "nodeTitle": n_title,
                }
                
                for stage_idx, stage in enumerate(node.get("stages") or []):
                    # stage is a dict from syllabus_json
                    component = stage.get("component")
                    if component in ["MultipleChoice", "Ordering", "MatchingPairs", "FeynmanMirror", "ExplainerMedia"]:
                        item = self._map_stage_to_syllabus_question(stage, context, len(extracted))
                        if item:
                            extracted.append(item)

        return extracted

    def _map_stage_to_syllabus_question(self, stage: dict, context: dict, index: int) -> dict:
        component = stage.get("component", "Unknown")
        data = stage.get("data", {})
        
        difficulty = stage.get("difficulty") or data.get("difficulty") or "normal"
        explanation = data.get("explanation") or ""
        
        question_id = stage.get("stageId") or f"{context['nodeId']}-{index}"

        item = {
            "unitId": context["unitId"],
            "unitTitle": context["unitTitle"],
            "nodeId": context["nodeId"],
            "nodeTitle": context["nodeTitle"],
            "questionKey": question_id,
            "questionType": component,
            "difficulty": difficulty,
            "explanation": explanation,
            "sourceUnitId": context["unitId"],
            "sourceNodeId": context["nodeId"],
            "isActive": True,
        }

        if component == "MultipleChoice":
            item["prompt"] = data.get("question", "")
            item["options"] = data.get("options") or []
            item["correctOptionId"] = data.get("correctOptionId") or ""
        elif component == "MatchingPairs":
            item["prompt"] = data.get("question") or context["nodeTitle"]
            # Robustly extract pairs using synonyms
            pairs = data.get("pairs") or []
            standardized_pairs = []
            for i, p in enumerate(pairs):
                if not isinstance(p, dict): continue
                left = p.get("left") or p.get("term") or p.get("text") or p.get("label") or "Side A"
                right = p.get("right") or p.get("definition") or p.get("match") or p.get("answer") or "Side B"
                standardized_pairs.append({
                    "id": str(p.get("id") or i),
                    "left": str(left),
                    "right": str(right)
                })
            item["options"] = standardized_pairs
            item["correctOptionId"] = None
        elif component == "Ordering":
            item["prompt"] = data.get("question") or context["nodeTitle"]
            # Convert steps list to the generic options format (id: step)
            steps = data.get("steps") or []
            item["options"] = [{"id": f"step-{i}", "text": step} if isinstance(step, str) else step for i, step in enumerate(steps)]
            item["correctOptionId"] = None
        elif component == "FeynmanMirror":
            item["prompt"] = data.get("prompt") or context["nodeTitle"]
            item["options"] = []
            item["correctOptionId"] = None
            item["sampleAnswer"] = data.get("sampleAnswer")
            item["maxRounds"] = data.get("maxRounds")
        elif component == "ExplainerMedia":
            item["prompt"] = data.get("title") or context["nodeTitle"]
            item["options"] = []
            item["correctOptionId"] = None
        else:
            return {}

        return item


    def serialize_public_course(self, course: PublicCourseModel) -> dict:
        syllabus = dict(course.syllabus_json or {})
        
        # Unify stages into components for frontend preview
        if "units" in syllabus:
            for unit in syllabus["units"]:
                for node in unit.get("nodes", []):
                    # For YAML-sourced courses, flatten 'stages' into 'components'
                    if "stages" in node and not node.get("components"):
                        flattened = []
                        for stage in node["stages"]:
                            # Merge stage top-level into data for easier frontend access
                            comp = dict(stage.get("data", {}))
                            comp["type"] = stage.get("component")
                            flattened.append(comp)
                        node["components"] = flattened
                        
        return {
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "topic": course.topic,
            "description": course.description,
            "isPublished": bool(course.is_published),
            "isFeatured": bool(course.is_featured_arena),
            "sourceCourseId": course.source_course_id,
            "tags": list(course.tags_json or []),
            "syllabus_json": syllabus,
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
                    "questionType": item.question_type,
                    "prompt": item.prompt,
                    "options": list(item.options_json or []),
                    "correctOptionId": item.correct_option_id,
                    "difficulty": item.difficulty,
                    "knowledgeTags": list(item.knowledge_tags_json or []),
                    "explanation": item.explanation,
                    "sampleAnswer": item.options_json[0].get("sampleAnswer") if item.question_type == "FeynmanMirror" and item.options_json and isinstance(item.options_json[0], dict) else None,
                    "maxRounds": item.options_json[0].get("maxRounds") if item.question_type == "FeynmanMirror" and item.options_json and isinstance(item.options_json[0], dict) else None,
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
            "startedAt": to_iso_utc(season.started_at),
            "endedAt": to_iso_utc(season.ended_at),
            "leaderboardConfig": dict(season.leaderboard_config_json or {}),
            "rewardConfig": dict(season.reward_config_json or {}),
        }

    def _serialize_match_review(self, match: ArenaMatchModel, rounds: list[ArenaRoundModel]) -> dict:
        player_count = int(match.player_count or len(match.players))
        round_count = int(match.round_count or len(rounds))
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
            if int(match_player.suspicious_low_latency_count or 0) > 0:
                suspicious_latency_present = True
            if int(match_player.disconnect_count or 0) >= 2 or bool(match_player.suspected_abandonment):
                repeated_disconnect_present = True

        if (
            match.status == ArenaMatchStatus.IN_PROGRESS
            and match.started_at
            and (utc_now() - match.started_at.replace(tzinfo=timezone.utc)).total_seconds() > 1800
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
            "startedAt": to_iso_utc(match.started_at),
            "endedAt": to_iso_utc(match.ended_at),
        }

    def _parse_optional_datetime(self, value: str | None) -> datetime | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        try:
            return datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid datetime value: {value}") from exc
