"""add_user_snapshot_json_to_arena_room_players

Revision ID: 7a2d3e5f6c8d
Revises: 31e2d1f0c4d8
Create Date: 2026-04-20 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a2d3e5f6c8d'
down_revision: Union[str, Sequence[str], None] = '31e2d1f0c4d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('arena_room_players', sa.Column('user_snapshot_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('arena_room_players', 'user_snapshot_json')
