import random

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.models.public_course import PublicCourseModel


class QuestionPoolService:
    def build_round_questions(
        self,
        db: Session,
        public_course: PublicCourseModel,
        *,
        round_count: int,
    ) -> list[dict]:
        pool_items = self._load_active_pool_items(db, public_course.id)
        if pool_items:
            normalized = [self._normalize_pool_item(item) for item in pool_items]
        else:
            normalized = self._load_legacy_metadata_questions(public_course)

        if len(normalized) < round_count:
            raise HTTPException(
                status_code=409,
                detail="Arena question pool does not have enough questions for the requested round count",
            )

        shuffled = list(normalized)
        random.shuffle(shuffled)
        return shuffled[:round_count]

    def _load_active_pool_items(
        self,
        db: Session,
        public_course_id: int,
    ) -> list[ArenaQuestionPoolItemModel]:
        return (
            db.query(ArenaQuestionPoolItemModel)
            .join(ArenaQuestionPoolModel, ArenaQuestionPoolModel.id == ArenaQuestionPoolItemModel.pool_id)
            .filter(
                ArenaQuestionPoolModel.public_course_id == public_course_id,
                ArenaQuestionPoolModel.is_active.is_(True),
                ArenaQuestionPoolItemModel.is_active.is_(True),
            )
            .order_by(ArenaQuestionPoolItemModel.id.asc())
            .all()
        )

    def _load_legacy_metadata_questions(self, public_course: PublicCourseModel) -> list[dict]:
        metadata = public_course.metadata_json if isinstance(public_course.metadata_json, dict) else {}
        raw_questions = metadata.get("arena_questions")
        if not isinstance(raw_questions, list) or not raw_questions:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Arena question pool is not configured for this public course. "
                    "Expected active ArenaQuestionPool entries or metadata_json.arena_questions."
                ),
            )

        normalized = [self._normalize_question_payload(item, index) for index, item in enumerate(raw_questions)]
        return normalized

    def _normalize_pool_item(self, item: ArenaQuestionPoolItemModel) -> dict:
        options = item.options_json if isinstance(item.options_json, list) else []
        return {
            "question_id": item.question_key,
            "prompt": item.prompt,
            "options": options,
            "correct_option_id": item.correct_option_id,
            "difficulty": item.difficulty,
            "knowledge_tags": list(item.knowledge_tags_json or []),
            "explanation": item.explanation or "",
            "source_unit_id": item.source_unit_id,
            "source_node_id": item.source_node_id,
        }

    def _normalize_question_payload(self, payload: dict, index: int) -> dict:
        if not isinstance(payload, dict):
            raise HTTPException(status_code=500, detail="Arena question pool contains invalid question entries")

        question_id = str(payload.get("question_id") or payload.get("id") or f"arena-q-{index}")
        prompt = str(payload.get("prompt") or payload.get("question") or "").strip()
        correct_option_id = str(payload.get("correct_option_id") or payload.get("correctOptionId") or "").strip()
        raw_options = payload.get("options")
        if not prompt or not correct_option_id or not isinstance(raw_options, list) or len(raw_options) < 2:
            raise HTTPException(status_code=500, detail=f"Arena question `{question_id}` is malformed")

        options = []
        seen_ids: set[str] = set()
        for option_index, option in enumerate(raw_options):
            if isinstance(option, dict):
                option_id = str(option.get("id") or f"option-{option_index}")
                option_text = str(option.get("text") or "").strip()
            else:
                option_id = f"option-{option_index}"
                option_text = str(option).strip()
            if not option_text or option_id in seen_ids:
                raise HTTPException(status_code=500, detail=f"Arena question `{question_id}` has invalid options")
            seen_ids.add(option_id)
            options.append({"id": option_id, "text": option_text})

        if correct_option_id not in seen_ids:
            raise HTTPException(status_code=500, detail=f"Arena question `{question_id}` references an unknown correct option")

        return {
            "question_id": question_id,
            "prompt": prompt,
            "options": options,
            "correct_option_id": correct_option_id,
            "difficulty": str(payload.get("difficulty") or "normal"),
            "knowledge_tags": [str(tag) for tag in list(payload.get("knowledge_tags") or payload.get("knowledgeTags") or [])],
            "explanation": str(payload.get("explanation") or "").strip(),
        }
