"""split lesson remedial canonical tables

Revision ID: 8a4f2c1d6b7e
Revises: 3c1d9e7a4b2f
Create Date: 2026-04-07 23:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8a4f2c1d6b7e"
down_revision: Union[str, Sequence[str], None] = "3c1d9e7a4b2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_lesson_session_stages_session_stage_order",
        "lesson_session_stages",
        type_="unique",
    )
    op.drop_constraint(
        "uq_lesson_session_stages_session_stage_uid",
        "lesson_session_stages",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_lesson_session_stages_session_stage_order",
        "lesson_session_stages",
        ["lesson_session_id", "phase", "stage_order"],
    )
    op.create_unique_constraint(
        "uq_lesson_session_stages_session_stage_uid",
        "lesson_session_stages",
        ["lesson_session_id", "phase", "stage_uid"],
    )

    op.create_table(
        "lesson_remedial_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_remedial_id", sa.Integer(), nullable=False),
        sa.Column("stage_uid", sa.String(), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("stage_type", sa.String(), nullable=False, server_default="interactive"),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("module", sa.String(), nullable=False),
        sa.Column("skin", sa.String(), nullable=False),
        sa.Column("component", sa.String(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("recommended_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("item_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("content_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("validation_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("feedback_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("stage_snapshot_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["lesson_remedial_id"], ["lesson_remedials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lesson_remedial_id",
            "stage_order",
            name="uq_lesson_remedial_stages_remedial_stage_order",
        ),
        sa.UniqueConstraint(
            "lesson_remedial_id",
            "stage_uid",
            name="uq_lesson_remedial_stages_remedial_stage_uid",
        ),
    )
    op.create_index(
        op.f("ix_lesson_remedial_stages_id"),
        "lesson_remedial_stages",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_remedial_stages_lesson_remedial_id"),
        "lesson_remedial_stages",
        ["lesson_remedial_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_remedial_stages_stage_uid"),
        "lesson_remedial_stages",
        ["stage_uid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_remedial_stages_component"),
        "lesson_remedial_stages",
        ["component"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_remedial_stages_difficulty"),
        "lesson_remedial_stages",
        ["difficulty"],
        unique=False,
    )
    op.create_index(
        "ix_lesson_remedial_stages_remedial_component",
        "lesson_remedial_stages",
        ["lesson_remedial_id", "component"],
        unique=False,
    )
    op.create_index(
        "ix_lesson_remedial_stages_remedial_difficulty",
        "lesson_remedial_stages",
        ["lesson_remedial_id", "difficulty"],
        unique=False,
    )

    op.add_column(
        "lesson_session_stages",
        sa.Column("lesson_remedial_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_lesson_session_stages_lesson_remedial_stage_id",
        "lesson_session_stages",
        "lesson_remedial_stages",
        ["lesson_remedial_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_lesson_session_stages_lesson_remedial_stage_id"),
        "lesson_session_stages",
        ["lesson_remedial_stage_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lesson_session_stages_lesson_remedial_stage_id"),
        table_name="lesson_session_stages",
    )
    op.drop_constraint(
        "fk_lesson_session_stages_lesson_remedial_stage_id",
        "lesson_session_stages",
        type_="foreignkey",
    )
    op.drop_column("lesson_session_stages", "lesson_remedial_stage_id")

    op.drop_index("ix_lesson_remedial_stages_remedial_difficulty", table_name="lesson_remedial_stages")
    op.drop_index("ix_lesson_remedial_stages_remedial_component", table_name="lesson_remedial_stages")
    op.drop_index(op.f("ix_lesson_remedial_stages_difficulty"), table_name="lesson_remedial_stages")
    op.drop_index(op.f("ix_lesson_remedial_stages_component"), table_name="lesson_remedial_stages")
    op.drop_index(op.f("ix_lesson_remedial_stages_stage_uid"), table_name="lesson_remedial_stages")
    op.drop_index(op.f("ix_lesson_remedial_stages_lesson_remedial_id"), table_name="lesson_remedial_stages")
    op.drop_index(op.f("ix_lesson_remedial_stages_id"), table_name="lesson_remedial_stages")
    op.drop_table("lesson_remedial_stages")

    op.drop_constraint(
        "uq_lesson_session_stages_session_stage_order",
        "lesson_session_stages",
        type_="unique",
    )
    op.drop_constraint(
        "uq_lesson_session_stages_session_stage_uid",
        "lesson_session_stages",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_lesson_session_stages_session_stage_order",
        "lesson_session_stages",
        ["lesson_session_id", "stage_order"],
    )
    op.create_unique_constraint(
        "uq_lesson_session_stages_session_stage_uid",
        "lesson_session_stages",
        ["lesson_session_id", "stage_uid"],
    )
