"""add_user_snapshot_json_to_arena_match_players

Revision ID: 31e2d1f0c4d8
Revises: 061d3da02ea7
Create Date: 2026-04-20 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31e2d1f0c4d8'
down_revision: Union[str, Sequence[str], None] = '061d3da02ea7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('arena_match_players', sa.Column('user_snapshot_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('arena_match_players', 'user_snapshot_json')
