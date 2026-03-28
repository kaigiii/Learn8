"""add lesson cache lookup index

Revision ID: e8a9f2b6c4d1
Revises: c5b7c67d8a11
Create Date: 2026-03-28 16:20:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e8a9f2b6c4d1"
down_revision: Union[str, Sequence[str], None] = "c5b7c67d8a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_lessons_user_project_node_topic",
        "lessons",
        ["user_id", "project_id", "node_id", "course_topic"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_lessons_user_project_node_topic", table_name="lessons")
