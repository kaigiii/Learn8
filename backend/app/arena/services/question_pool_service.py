import random

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.arena.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.models.public_course import PublicCourseModel


class QuestionPoolService:
    def build_round_questions(
        self,
        db: Session,
        public_course: PublicCourseModel,
        *,
        pool_id: int | None = None,
        round_count: int,
    ) -> list[dict]:
        """
        Builds a set of questions for an Arena match.
        STRICTLY requires an active ArenaQuestionPool defined via the Admin Pool Builder.
        """
        pool_items = self._load_active_pool_items(db, public_course.id, pool_id=pool_id)
        
        if not pool_items:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Arena match for '{public_course.title}' cannot start. "
                    "No active question pool found in the Admin Pool Builder. "
                    "Please create and ACTIVATE a pool first."
                ),
            )

        normalized = [self._normalize_pool_item(item) for item in pool_items]

        if len(normalized) < round_count:
            raise HTTPException(
                status_code=409,
                detail="The active question pool does not have enough questions for the requested round count",
            )

        shuffled = list(normalized)
        random.shuffle(shuffled)
        return shuffled[:round_count]
    def _load_active_pool_items(
        self,
        db: Session,
        public_course_id: int,
        set_active_only: bool = True,
        pool_id: int | None = None,
    ) -> list[ArenaQuestionPoolItemModel]:
        query = db.query(ArenaQuestionPoolItemModel).join(ArenaQuestionPoolModel, ArenaQuestionPoolModel.id == ArenaQuestionPoolItemModel.pool_id)
        
        if pool_id:
            query = query.filter(ArenaQuestionPoolModel.id == pool_id)
        else:
            query = query.filter(ArenaQuestionPoolModel.public_course_id == public_course_id)
            
        if set_active_only:
            query = query.filter(ArenaQuestionPoolModel.is_active.is_(True))
            
        return (
            query
            .filter(ArenaQuestionPoolItemModel.is_active.is_(True))
            .order_by(ArenaQuestionPoolItemModel.id.asc())
            .all()
        )

    def _normalize_pool_item(self, item: ArenaQuestionPoolItemModel) -> dict:
        options = item.options_json if isinstance(item.options_json, list) else []
        return {
            "question_id": item.question_key,
            "question_type": item.question_type,
            "prompt": item.prompt,
            "options": options,
            "correct_option_id": item.correct_option_id,
            "difficulty": item.difficulty,
            "knowledge_tags": list(item.knowledge_tags_json or []),
            "explanation": item.explanation or "",
            "source_unit_id": item.source_unit_id,
            "source_node_id": item.source_node_id,
        }
