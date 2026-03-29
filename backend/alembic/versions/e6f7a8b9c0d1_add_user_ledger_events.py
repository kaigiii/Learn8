"""add user ledger events

Revision ID: e6f7a8b9c0d1
Revises: d4e5f6a7b8c9
Create Date: 2026-03-29 00:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_ledger_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("event_key", sa.String(), nullable=True),
        sa.Column("credits_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("xp_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits_balance_after", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("xp_balance_after", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level_after", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_key", name="uq_user_ledger_events_event_key"),
    )
    op.create_index(op.f("ix_user_ledger_events_id"), "user_ledger_events", ["id"], unique=False)
    op.create_index(
        "ix_user_ledger_events_user_created_at",
        "user_ledger_events",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_user_ledger_events_user_event_type",
        "user_ledger_events",
        ["user_id", "event_type"],
        unique=False,
    )
    op.create_index(op.f("ix_user_ledger_events_user_id"), "user_ledger_events", ["user_id"], unique=False)

    op.alter_column("user_ledger_events", "credits_delta", server_default=None)
    op.alter_column("user_ledger_events", "xp_delta", server_default=None)
    op.alter_column("user_ledger_events", "credits_balance_after", server_default=None)
    op.alter_column("user_ledger_events", "xp_balance_after", server_default=None)
    op.alter_column("user_ledger_events", "level_after", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_ledger_events_user_id"), table_name="user_ledger_events")
    op.drop_index("ix_user_ledger_events_user_event_type", table_name="user_ledger_events")
    op.drop_index("ix_user_ledger_events_user_created_at", table_name="user_ledger_events")
    op.drop_index(op.f("ix_user_ledger_events_id"), table_name="user_ledger_events")
    op.drop_table("user_ledger_events")
