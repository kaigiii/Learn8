"""add lesson generation metadata

Revision ID: ab12cd34ef56
Revises: f6c4b2a9d1e3
Create Date: 2026-03-30 16:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ab12cd34ef56"
down_revision: Union[str, Sequence[str], None] = "f6c4b2a9d1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("generation_metadata_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lessons", "generation_metadata_json")
