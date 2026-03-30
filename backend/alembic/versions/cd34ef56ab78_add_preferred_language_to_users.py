"""add preferred language to users

Revision ID: cd34ef56ab78
Revises: ab12cd34ef56
Create Date: 2026-03-30 16:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cd34ef56ab78"
down_revision: Union[str, Sequence[str], None] = "ab12cd34ef56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("preferred_language", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
