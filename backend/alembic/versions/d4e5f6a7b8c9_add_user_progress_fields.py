"""add user progress fields

Revision ID: d4e5f6a7b8c9
Revises: c8d9ef1a2b34
Create Date: 2026-03-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c8d9ef1a2b34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("xp", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("level", sa.Integer(), nullable=False, server_default="1"))
    op.add_column(
        "users",
        sa.Column("xp_to_next_level", sa.Integer(), nullable=False, server_default="100"),
    )

    op.alter_column("users", "xp", server_default=None)
    op.alter_column("users", "level", server_default=None)
    op.alter_column("users", "xp_to_next_level", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "xp_to_next_level")
    op.drop_column("users", "level")
    op.drop_column("users", "xp")
