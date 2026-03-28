"""add auth security fields to users

Revision ID: c8d9ef1a2b34
Revises: a1c9b6d4e2f3
Create Date: 2026-03-29 11:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d9ef1a2b34"
down_revision: Union[str, Sequence[str], None] = "a1c9b6d4e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "failed_login_attempts" not in columns:
        op.add_column(
            "users",
            sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        )
    if "locked_until" not in columns:
        op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    if "last_login_at" not in columns:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    if "password_changed_at" not in columns:
        op.add_column(
            "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
