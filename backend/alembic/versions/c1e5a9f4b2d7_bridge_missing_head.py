"""bridge missing head

Revision ID: c1e5a9f4b2d7
Revises: f79a832c1b2c
Create Date: 2026-04-09 15:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1e5a9f4b2d7'
down_revision: Union[str, None] = 'f79a832c1b2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
