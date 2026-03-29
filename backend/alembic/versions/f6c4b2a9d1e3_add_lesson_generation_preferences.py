"""add lesson generation preferences

Revision ID: f6c4b2a9d1e3
Revises: f2b4a7e91c0d
Create Date: 2026-03-30 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6c4b2a9d1e3"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_generation_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=True),
        sa.Column("allowed_components_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_lesson_generation_preferences_user_course_node",
        "lesson_generation_preferences",
        ["user_id", "course_id", "node_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_lesson_generation_preferences_course_id"),
        "lesson_generation_preferences",
        ["course_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_generation_preferences_id"),
        "lesson_generation_preferences",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_generation_preferences_node_id"),
        "lesson_generation_preferences",
        ["node_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_generation_preferences_user_id"),
        "lesson_generation_preferences",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lesson_generation_preferences_user_id"),
        table_name="lesson_generation_preferences",
    )
    op.drop_index(
        op.f("ix_lesson_generation_preferences_node_id"),
        table_name="lesson_generation_preferences",
    )
    op.drop_index(
        op.f("ix_lesson_generation_preferences_id"),
        table_name="lesson_generation_preferences",
    )
    op.drop_index(
        op.f("ix_lesson_generation_preferences_course_id"),
        table_name="lesson_generation_preferences",
    )
    op.drop_index(
        "ix_lesson_generation_preferences_user_course_node",
        table_name="lesson_generation_preferences",
    )
    op.drop_table("lesson_generation_preferences")
