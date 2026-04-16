"""add is_featured_arena to public_courses

Revision ID: 30b8a775256b
Revises: b1c2d3e4f5a6
Create Date: 2026-04-16 19:07:46.633597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30b8a775256b'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('public_courses', sa.Column('is_featured_arena', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.create_index(op.f('ix_public_courses_is_featured_arena'), 'public_courses', ['is_featured_arena'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_public_courses_is_featured_arena'), table_name='public_courses')
    op.drop_column('public_courses', 'is_featured_arena')
