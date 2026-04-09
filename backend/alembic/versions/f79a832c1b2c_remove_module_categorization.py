"""remove module categorization

Revision ID: f79a832c1b2c
Revises: f6c4b2a9d1e3
Create Date: 2026-04-08 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f79a832c1b2c'
down_revision: Union[str, None] = '4b6e1d2f8a9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We use batch_alter_table inside in case SQLite is used, but PostgreSQL handles drop column fine.
    # lesson_stages
    op.drop_index('ix_lesson_stages_module', table_name='lesson_stages', if_exists=True)
    with op.batch_alter_table('lesson_stages') as batch_op:
        batch_op.drop_column('module')
        
    # lesson_session_stages
    op.drop_index('ix_lesson_session_stages_module', table_name='lesson_session_stages', if_exists=True)
    with op.batch_alter_table('lesson_session_stages') as batch_op:
        batch_op.drop_column('module')
        
    # lesson_failed_stages
    op.drop_index('ix_lesson_failed_stages_module', table_name='lesson_failed_stages', if_exists=True)
    with op.batch_alter_table('lesson_failed_stages') as batch_op:
        batch_op.drop_column('module')
        
    # lesson_remedial_stages
    op.drop_index('ix_lesson_remedial_stages_module', table_name='lesson_remedial_stages', if_exists=True)
    with op.batch_alter_table('lesson_remedial_stages') as batch_op:
        batch_op.drop_column('module')


def downgrade() -> None:
    with op.batch_alter_table('lesson_stages') as batch_op:
        batch_op.add_column(sa.Column('module', sa.String(), nullable=True))
    op.create_index('ix_lesson_stages_module', 'lesson_stages', ['module'], unique=False)
    
    with op.batch_alter_table('lesson_session_stages') as batch_op:
        batch_op.add_column(sa.Column('module', sa.String(), nullable=True))
    op.create_index('ix_lesson_session_stages_module', 'lesson_session_stages', ['module'], unique=False)
    
    with op.batch_alter_table('lesson_failed_stages') as batch_op:
        batch_op.add_column(sa.Column('module', sa.String(), nullable=True))
    op.create_index('ix_lesson_failed_stages_module', 'lesson_failed_stages', ['module'], unique=False)
    
    with op.batch_alter_table('lesson_remedial_stages') as batch_op:
        batch_op.add_column(sa.Column('module', sa.String(), nullable=True))
    op.create_index('ix_lesson_remedial_stages_module', 'lesson_remedial_stages', ['module'], unique=False)

