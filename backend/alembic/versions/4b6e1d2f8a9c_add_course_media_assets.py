"""Add course media assets table

Revision ID: 4b6e1d2f8a9c
Revises: d4e8b1a9c2f0
Create Date: 2026-04-07 16:18:00
"""

from alembic import op
import sqlalchemy as sa


revision = "4b6e1d2f8a9c"
down_revision = "d4e8b1a9c2f0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "course_media_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), index=True),
        sa.Column("source_filename", sa.String(), nullable=False, index=True),
        sa.Column("asset_type", sa.String(), nullable=False, server_default="image"),
        sa.Column("asset_filename", sa.String(), nullable=True),
        sa.Column("asset_url", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("asset_index", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_course_media_assets_course_source",
        "course_media_assets",
        ["course_id", "source_filename"],
    )


def downgrade():
    op.drop_index("ix_course_media_assets_course_source", table_name="course_media_assets")
    op.drop_table("course_media_assets")
