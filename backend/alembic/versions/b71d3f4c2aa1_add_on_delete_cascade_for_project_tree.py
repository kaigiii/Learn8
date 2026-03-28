"""No-op: initial schema now includes final course-only cascades

Revision ID: b71d3f4c2aa1
Revises: 8f3a9d7b21c4
Create Date: 2026-03-27 20:05:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b71d3f4c2aa1"
down_revision: Union[str, Sequence[str], None] = "8f3a9d7b21c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
