"""add reward eligible to lesson sessions

Revision ID: f2b4a7e91c0d
Revises: e8a9f2b6c4d1
Create Date: 2026-03-28 17:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2b4a7e91c0d"
down_revision: Union[str, Sequence[str], None] = "e8a9f2b6c4d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lesson_sessions",
        sa.Column("reward_eligible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("lesson_sessions", "reward_eligible", server_default=None)


def downgrade() -> None:
    op.drop_column("lesson_sessions", "reward_eligible")
