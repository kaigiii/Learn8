"""Initial PostgreSQL Schema

Revision ID: 1940275bc1e9
Revises: 
Create Date: 2026-03-11 23:03:44.107417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1940275bc1e9'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('hashed_password', sa.String(), nullable=True),
    sa.Column('credits', sa.Integer(), nullable=True),
    sa.Column('full_name', sa.String(), nullable=True),
    sa.Column('phone_number', sa.String(), nullable=True),
    sa.Column('avatar_url', sa.String(), nullable=True),
    sa.Column('job_title', sa.String(), nullable=True),
    sa.Column('education_level', sa.String(), nullable=True),
    sa.Column('daily_learning_goal_minutes', sa.Integer(), nullable=True),
    sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_table('lesson_attempts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('stage_id', sa.String(), nullable=True),
    sa.Column('user_input', sa.String(), nullable=True),
    sa.Column('is_correct', sa.String(), nullable=True),
    sa.Column('timestamp', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lesson_attempts_id'), 'lesson_attempts', ['id'], unique=False)
    op.create_index(op.f('ix_lesson_attempts_stage_id'), 'lesson_attempts', ['stage_id'], unique=False)
    op.create_table('courses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('topic', sa.String(), nullable=True),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('folder_name', sa.String(), nullable=True),
    sa.Column('profile_json', sa.JSON(), nullable=True),
    sa.Column('draft_json', sa.JSON(), nullable=True),
    sa.Column('syllabus_json', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('folder_name')
    )
    op.create_index(op.f('ix_courses_id'), 'courses', ['id'], unique=False)
    op.create_index(op.f('ix_courses_status'), 'courses', ['status'], unique=False)
    op.create_index(op.f('ix_courses_topic'), 'courses', ['topic'], unique=False)
    op.create_table('generation_jobs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('job_type', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=True),
    sa.Column('message', sa.String(length=255), nullable=True),
    sa.Column('result_data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('lessons',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('node_id', sa.String(), nullable=True),
    sa.Column('course_topic', sa.String(), nullable=True),
    sa.Column('stage_json', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lessons_course_topic'), 'lessons', ['course_topic'], unique=False)
    op.create_index(op.f('ix_lessons_id'), 'lessons', ['id'], unique=False)
    op.create_index(op.f('ix_lessons_node_id'), 'lessons', ['node_id'], unique=False)
    op.create_table('lesson_remedials',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('node_id', sa.String(), nullable=True),
    sa.Column('course_topic', sa.String(), nullable=True),
    sa.Column('stage_json', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lesson_remedials_id'), 'lesson_remedials', ['id'], unique=False)
    op.create_index(op.f('ix_lesson_remedials_node_id'), 'lesson_remedials', ['node_id'], unique=False)
    op.create_index(op.f('ix_lesson_remedials_course_topic'), 'lesson_remedials', ['course_topic'], unique=False)
    op.create_table('nodes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('node_id', sa.String(), nullable=True),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('data', sa.JSON(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nodes_id'), 'nodes', ['id'], unique=False)
    op.create_index(op.f('ix_nodes_node_id'), 'nodes', ['node_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_nodes_node_id'), table_name='nodes')
    op.drop_index(op.f('ix_nodes_id'), table_name='nodes')
    op.drop_table('nodes')
    op.drop_index(op.f('ix_lesson_remedials_course_topic'), table_name='lesson_remedials')
    op.drop_index(op.f('ix_lesson_remedials_node_id'), table_name='lesson_remedials')
    op.drop_index(op.f('ix_lesson_remedials_id'), table_name='lesson_remedials')
    op.drop_table('lesson_remedials')
    op.drop_index(op.f('ix_lessons_node_id'), table_name='lessons')
    op.drop_index(op.f('ix_lessons_id'), table_name='lessons')
    op.drop_index(op.f('ix_lessons_course_topic'), table_name='lessons')
    op.drop_table('lessons')
    op.drop_table('generation_jobs')
    op.drop_index(op.f('ix_courses_topic'), table_name='courses')
    op.drop_index(op.f('ix_courses_status'), table_name='courses')
    op.drop_index(op.f('ix_courses_id'), table_name='courses')
    op.drop_table('courses')
    op.drop_index(op.f('ix_lesson_attempts_stage_id'), table_name='lesson_attempts')
    op.drop_index(op.f('ix_lesson_attempts_id'), table_name='lesson_attempts')
    op.drop_table('lesson_attempts')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
