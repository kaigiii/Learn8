"""Add lesson sessions and failed-stage persistence

Revision ID: 8f3a9d7b21c4
Revises: 1940275bc1e9
Create Date: 2026-03-27 13:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f3a9d7b21c4"
down_revision: Union[str, Sequence[str], None] = "1940275bc1e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("lesson_id", sa.Integer(), nullable=True),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("course_topic", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("active_phase", sa.String(), nullable=False),
        sa.Column("primary_stages_json", sa.JSON(), nullable=False),
        sa.Column("remedial_stages_json", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_sessions_id"), "lesson_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_user_id"), "lesson_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_project_id"), "lesson_sessions", ["project_id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_course_id"), "lesson_sessions", ["course_id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_lesson_id"), "lesson_sessions", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_node_id"), "lesson_sessions", ["node_id"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_course_topic"), "lesson_sessions", ["course_topic"], unique=False)
    op.create_index(op.f("ix_lesson_sessions_status"), "lesson_sessions", ["status"], unique=False)

    op.create_table(
        "lesson_failed_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("course_topic", sa.String(), nullable=False),
        sa.Column("stage_id", sa.String(), nullable=False),
        sa.Column("component", sa.String(), nullable=True),
        sa.Column("source_phase", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("stage_snapshot_json", sa.JSON(), nullable=False),
        sa.Column("user_input_json", sa.JSON(), nullable=True),
        sa.Column("evaluation_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["lesson_session_id"], ["lesson_sessions.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_failed_stages_id"), "lesson_failed_stages", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_lesson_session_id"), "lesson_failed_stages", ["lesson_session_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_user_id"), "lesson_failed_stages", ["user_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_project_id"), "lesson_failed_stages", ["project_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_course_id"), "lesson_failed_stages", ["course_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_node_id"), "lesson_failed_stages", ["node_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_course_topic"), "lesson_failed_stages", ["course_topic"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_stage_id"), "lesson_failed_stages", ["stage_id"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_status"), "lesson_failed_stages", ["status"], unique=False)

    op.add_column("lesson_attempts", sa.Column("lesson_session_id", sa.Integer(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("project_id", sa.Integer(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("course_id", sa.Integer(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("node_id", sa.String(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("course_topic", sa.String(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("component", sa.String(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("phase", sa.String(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("user_input_json", sa.JSON(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("evaluation_json", sa.JSON(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("stage_snapshot_json", sa.JSON(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("is_correct_bool", sa.Boolean(), nullable=True))
    op.create_foreign_key(
        "fk_lesson_attempts_lesson_session_id",
        "lesson_attempts",
        "lesson_sessions",
        ["lesson_session_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_lesson_attempts_project_id",
        "lesson_attempts",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_lesson_attempts_course_id",
        "lesson_attempts",
        "courses",
        ["course_id"],
        ["id"],
    )
    op.create_index(op.f("ix_lesson_attempts_lesson_session_id"), "lesson_attempts", ["lesson_session_id"], unique=False)
    op.create_index(op.f("ix_lesson_attempts_node_id"), "lesson_attempts", ["node_id"], unique=False)
    op.create_index(op.f("ix_lesson_attempts_course_topic"), "lesson_attempts", ["course_topic"], unique=False)

    op.add_column("lesson_remedials", sa.Column("lesson_session_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_lesson_remedials_lesson_session_id",
        "lesson_remedials",
        "lesson_sessions",
        ["lesson_session_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_lesson_remedials_lesson_session_id", "lesson_remedials", type_="foreignkey")
    op.drop_column("lesson_remedials", "lesson_session_id")

    op.drop_index(op.f("ix_lesson_attempts_course_topic"), table_name="lesson_attempts")
    op.drop_index(op.f("ix_lesson_attempts_node_id"), table_name="lesson_attempts")
    op.drop_index(op.f("ix_lesson_attempts_lesson_session_id"), table_name="lesson_attempts")
    op.drop_constraint("fk_lesson_attempts_course_id", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_project_id", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_lesson_session_id", "lesson_attempts", type_="foreignkey")
    op.drop_column("lesson_attempts", "is_correct_bool")
    op.drop_column("lesson_attempts", "stage_snapshot_json")
    op.drop_column("lesson_attempts", "evaluation_json")
    op.drop_column("lesson_attempts", "user_input_json")
    op.drop_column("lesson_attempts", "phase")
    op.drop_column("lesson_attempts", "component")
    op.drop_column("lesson_attempts", "course_topic")
    op.drop_column("lesson_attempts", "node_id")
    op.drop_column("lesson_attempts", "course_id")
    op.drop_column("lesson_attempts", "project_id")
    op.drop_column("lesson_attempts", "lesson_session_id")

    op.drop_index(op.f("ix_lesson_failed_stages_status"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_stage_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_course_topic"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_node_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_course_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_project_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_user_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_lesson_session_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_id"), table_name="lesson_failed_stages")
    op.drop_table("lesson_failed_stages")

    op.drop_index(op.f("ix_lesson_sessions_status"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_course_topic"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_node_id"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_lesson_id"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_course_id"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_project_id"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_user_id"), table_name="lesson_sessions")
    op.drop_index(op.f("ix_lesson_sessions_id"), table_name="lesson_sessions")
    op.drop_table("lesson_sessions")
