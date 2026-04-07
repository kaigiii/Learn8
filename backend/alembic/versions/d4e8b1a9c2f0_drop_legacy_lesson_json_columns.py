"""drop legacy lesson json columns

Revision ID: d4e8b1a9c2f0
Revises: 8a4f2c1d6b7e
Create Date: 2026-04-07 23:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e8b1a9c2f0"
down_revision: Union[str, Sequence[str], None] = "8a4f2c1d6b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("lesson_remedials", "stage_json")
    op.drop_column("lesson_sessions", "remedial_stages_json")
    op.drop_column("lesson_sessions", "primary_stages_json")
    op.drop_column("lessons", "stage_json")


def downgrade() -> None:
    op.add_column("lessons", sa.Column("stage_json", sa.JSON(), nullable=True))
    op.add_column(
        "lesson_sessions",
        sa.Column("primary_stages_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column(
        "lesson_sessions",
        sa.Column("remedial_stages_json", sa.JSON(), nullable=True),
    )
    op.add_column("lesson_remedials", sa.Column("stage_json", sa.JSON(), nullable=True))
