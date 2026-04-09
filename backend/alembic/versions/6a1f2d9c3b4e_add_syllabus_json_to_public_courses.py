"""add syllabus_json to public_courses

Revision ID: 6a1f2d9c3b4e
Revises: 2d0b6286bac2
Create Date: 2026-04-10 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6a1f2d9c3b4e"
down_revision: Union[str, Sequence[str], None] = "2d0b6286bac2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("public_courses", "syllabus_json"):
        op.add_column("public_courses", sa.Column("syllabus_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_column("public_courses", "syllabus_json"):
        op.drop_column("public_courses", "syllabus_json")
