"""Add ON DELETE CASCADE for project-related foreign keys

Revision ID: b71d3f4c2aa1
Revises: 8f3a9d7b21c4
Create Date: 2026-03-27 20:05:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b71d3f4c2aa1"
down_revision: Union[str, Sequence[str], None] = "8f3a9d7b21c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("projects_user_id_fkey", "projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_user_id_fkey",
        "projects",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("courses_user_id_fkey", "courses", type_="foreignkey")
    op.drop_constraint("courses_project_id_fkey", "courses", type_="foreignkey")
    op.create_foreign_key(
        "courses_user_id_fkey",
        "courses",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "courses_project_id_fkey",
        "courses",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("nodes_course_id_fkey", "nodes", type_="foreignkey")
    op.create_foreign_key(
        "nodes_course_id_fkey",
        "nodes",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("generation_jobs_user_id_fkey", "generation_jobs", type_="foreignkey")
    op.drop_constraint("generation_jobs_project_id_fkey", "generation_jobs", type_="foreignkey")
    op.create_foreign_key(
        "generation_jobs_user_id_fkey",
        "generation_jobs",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "generation_jobs_project_id_fkey",
        "generation_jobs",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("lessons_user_id_fkey", "lessons", type_="foreignkey")
    op.drop_constraint("lessons_project_id_fkey", "lessons", type_="foreignkey")
    op.create_foreign_key(
        "lessons_user_id_fkey",
        "lessons",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lessons_project_id_fkey",
        "lessons",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("lesson_attempts_user_id_fkey", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_project_id", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_course_id", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_lesson_session_id", "lesson_attempts", type_="foreignkey")
    op.create_foreign_key(
        "lesson_attempts_user_id_fkey",
        "lesson_attempts",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_lesson_attempts_project_id",
        "lesson_attempts",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_lesson_attempts_course_id",
        "lesson_attempts",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_lesson_attempts_lesson_session_id",
        "lesson_attempts",
        "lesson_sessions",
        ["lesson_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("lesson_sessions_user_id_fkey", "lesson_sessions", type_="foreignkey")
    op.drop_constraint("lesson_sessions_project_id_fkey", "lesson_sessions", type_="foreignkey")
    op.drop_constraint("lesson_sessions_course_id_fkey", "lesson_sessions", type_="foreignkey")
    op.drop_constraint("lesson_sessions_lesson_id_fkey", "lesson_sessions", type_="foreignkey")
    op.create_foreign_key(
        "lesson_sessions_user_id_fkey",
        "lesson_sessions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_sessions_project_id_fkey",
        "lesson_sessions",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_sessions_course_id_fkey",
        "lesson_sessions",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_sessions_lesson_id_fkey",
        "lesson_sessions",
        "lessons",
        ["lesson_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint("lesson_failed_stages_user_id_fkey", "lesson_failed_stages", type_="foreignkey")
    op.drop_constraint("lesson_failed_stages_project_id_fkey", "lesson_failed_stages", type_="foreignkey")
    op.drop_constraint("lesson_failed_stages_course_id_fkey", "lesson_failed_stages", type_="foreignkey")
    op.drop_constraint("lesson_failed_stages_lesson_session_id_fkey", "lesson_failed_stages", type_="foreignkey")
    op.create_foreign_key(
        "lesson_failed_stages_user_id_fkey",
        "lesson_failed_stages",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_failed_stages_project_id_fkey",
        "lesson_failed_stages",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_failed_stages_course_id_fkey",
        "lesson_failed_stages",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_failed_stages_lesson_session_id_fkey",
        "lesson_failed_stages",
        "lesson_sessions",
        ["lesson_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("lesson_remedials_user_id_fkey", "lesson_remedials", type_="foreignkey")
    op.drop_constraint("lesson_remedials_project_id_fkey", "lesson_remedials", type_="foreignkey")
    op.drop_constraint("fk_lesson_remedials_lesson_session_id", "lesson_remedials", type_="foreignkey")
    op.create_foreign_key(
        "lesson_remedials_user_id_fkey",
        "lesson_remedials",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "lesson_remedials_project_id_fkey",
        "lesson_remedials",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_lesson_remedials_lesson_session_id",
        "lesson_remedials",
        "lesson_sessions",
        ["lesson_session_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    pass
