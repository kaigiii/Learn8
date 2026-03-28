"""add hints used count to lesson sessions

Revision ID: c5b7c67d8a11
Revises: b71d3f4c2aa1
Create Date: 2026-03-28 15:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c5b7c67d8a11"
down_revision: Union[str, Sequence[str], None] = "b71d3f4c2aa1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lesson_sessions",
        sa.Column("hints_used_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("lesson_sessions", "hints_used_count", server_default=None)


def downgrade() -> None:
    op.drop_column("lesson_sessions", "hints_used_count")
