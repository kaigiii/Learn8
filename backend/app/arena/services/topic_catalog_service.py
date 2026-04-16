from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.models.public_course import PublicCourseModel
from app.arena.models.arena_question_pool import ArenaQuestionPoolModel


class TopicCatalogService:
    def list_active_pools(self, db: Session) -> list[ArenaQuestionPoolModel]:
        return (
            db.query(ArenaQuestionPoolModel)
            .join(PublicCourseModel)
            .filter(
                ArenaQuestionPoolModel.is_active.is_(True),
                PublicCourseModel.is_published.is_(True)
            )
            .order_by(
                PublicCourseModel.is_featured_arena.desc(),
                PublicCourseModel.title.asc(),
                ArenaQuestionPoolModel.id.asc()
            )
            .all()
        )

    def get_active_pool(self, db: Session, pool_id: int) -> ArenaQuestionPoolModel | None:
        return (
            db.query(ArenaQuestionPoolModel)
            .join(PublicCourseModel)
            .filter(
                ArenaQuestionPoolModel.id == pool_id,
                ArenaQuestionPoolModel.is_active.is_(True),
                PublicCourseModel.is_published.is_(True)
            )
            .first()
        )

