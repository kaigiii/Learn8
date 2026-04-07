from sqlalchemy.orm import Session

from app.models.public_course import PublicCourseModel


class TopicCatalogService:
    def list_enabled_public_courses(self, db: Session) -> list[PublicCourseModel]:
        return (
            db.query(PublicCourseModel)
            .filter(
                PublicCourseModel.is_published.is_(True),
                PublicCourseModel.is_arena_enabled.is_(True),
            )
            .order_by(PublicCourseModel.title.asc())
            .all()
        )

    def get_enabled_public_course(self, db: Session, public_course_id: int) -> PublicCourseModel | None:
        return (
            db.query(PublicCourseModel)
            .filter(
                PublicCourseModel.id == public_course_id,
                PublicCourseModel.is_published.is_(True),
                PublicCourseModel.is_arena_enabled.is_(True),
            )
            .first()
        )

