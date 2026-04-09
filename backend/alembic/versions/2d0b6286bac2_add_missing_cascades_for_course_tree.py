"""add missing cascades for course tree

Revision ID: 2d0b6286bac2
Revises: c1e5a9f4b2d7
Create Date: 2026-04-09 23:23:14.529940

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d0b6286bac2'
down_revision: Union[str, Sequence[str], None] = 'c1e5a9f4b2d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. nodes -> courses
    op.drop_constraint('nodes_course_id_fkey', 'nodes', type_='foreignkey')
    op.create_foreign_key(
        'nodes_course_id_fkey', 'nodes', 'courses',
        ['course_id'], ['id'], ondelete='CASCADE'
    )
    
    # 2. lessons -> courses
    op.drop_constraint('lessons_course_id_fkey', 'lessons', type_='foreignkey')
    op.create_foreign_key(
        'lessons_course_id_fkey', 'lessons', 'courses',
        ['course_id'], ['id'], ondelete='CASCADE'
    )
    
    # 3. lesson_sessions -> courses
    op.drop_constraint('lesson_sessions_course_id_fkey', 'lesson_sessions', type_='foreignkey')
    op.create_foreign_key(
        'lesson_sessions_course_id_fkey', 'lesson_sessions', 'courses',
        ['course_id'], ['id'], ondelete='CASCADE'
    )
    
    # 4. lesson_attempts -> courses
    op.drop_constraint('fk_lesson_attempts_course_id', 'lesson_attempts', type_='foreignkey')
    op.create_foreign_key(
        'fk_lesson_attempts_course_id', 'lesson_attempts', 'courses',
        ['course_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    # Revert to default restrict/set null if needed
    op.drop_constraint('nodes_course_id_fkey', 'nodes', type_='foreignkey')
    op.create_foreign_key('nodes_course_id_fkey', 'nodes', 'courses', ['course_id'], ['id'])
    
    op.drop_constraint('lessons_course_id_fkey', 'lessons', type_='foreignkey')
    op.create_foreign_key('lessons_course_id_fkey', 'lessons', 'courses', ['course_id'], ['id'])
    
    op.drop_constraint('lesson_sessions_course_id_fkey', 'lesson_sessions', type_='foreignkey')
    op.create_foreign_key('lesson_sessions_course_id_fkey', 'lesson_sessions', 'courses', ['course_id'], ['id'])
    
    op.drop_constraint('fk_lesson_attempts_course_id', 'lesson_attempts', type_='foreignkey')
    op.create_foreign_key('fk_lesson_attempts_course_id', 'lesson_attempts', 'courses', ['course_id'], ['id'])
