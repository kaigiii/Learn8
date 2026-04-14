"""add reward_awarded_at to arena_matches

Revision ID: b1c2d3e4f5a6
Revises: 0a3d539eecd3
Create Date: 2026-04-14 14:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '0a3d539eecd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('arena_matches', sa.Column('reward_awarded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('arena_matches', 'reward_awarded_at')
