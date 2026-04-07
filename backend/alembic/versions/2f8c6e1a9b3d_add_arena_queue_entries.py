"""add arena queue entries

Revision ID: 2f8c6e1a9b3d
Revises: 7b0f7e5f6c2a
Create Date: 2026-04-07 11:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f8c6e1a9b3d"
down_revision: Union[str, Sequence[str], None] = "7b0f7e5f6c2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "arena_queue_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("public_course_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False, server_default="competitive"),
        sa.Column("status", sa.String(), nullable=False, server_default="waiting"),
        sa.Column("matched_user_id", sa.Integer(), nullable=True),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["public_course_id"], ["public_courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["matched_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_arena_queue_entries_id", "arena_queue_entries", ["id"])
    op.create_index("ix_arena_queue_entries_user_id", "arena_queue_entries", ["user_id"])
    op.create_index("ix_arena_queue_entries_public_course_id", "arena_queue_entries", ["public_course_id"])
    op.create_index("ix_arena_queue_entries_mode", "arena_queue_entries", ["mode"])
    op.create_index("ix_arena_queue_entries_status", "arena_queue_entries", ["status"])
    op.create_index("ix_arena_queue_entries_matched_user_id", "arena_queue_entries", ["matched_user_id"])
    op.create_index("ix_arena_queue_entries_match_id", "arena_queue_entries", ["match_id"])
    op.create_index(
        "ix_arena_queue_entries_status_created",
        "arena_queue_entries",
        ["status", "created_at"],
    )
    op.create_index(
        "ix_arena_queue_entries_course_status_created",
        "arena_queue_entries",
        ["public_course_id", "status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_arena_queue_entries_course_status_created", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_status_created", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_match_id", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_matched_user_id", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_status", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_mode", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_public_course_id", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_user_id", table_name="arena_queue_entries")
    op.drop_index("ix_arena_queue_entries_id", table_name="arena_queue_entries")
    op.drop_table("arena_queue_entries")
