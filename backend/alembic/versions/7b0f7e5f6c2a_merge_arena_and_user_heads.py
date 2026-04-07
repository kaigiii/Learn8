"""merge arena and user heads

Revision ID: 7b0f7e5f6c2a
Revises: 9d3c1a4b7ef2, cd34ef56ab78
Create Date: 2026-04-02 18:30:00.000000

"""

from typing import Sequence, Union


revision: str = "7b0f7e5f6c2a"
down_revision: Union[str, Sequence[str], None] = ("9d3c1a4b7ef2", "cd34ef56ab78")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
