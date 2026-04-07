"""normalize lesson and arena schema

Revision ID: 3c1d9e7a4b2f
Revises: 2f8c6e1a9b3d
Create Date: 2026-04-07 20:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c1d9e7a4b2f"
down_revision: Union[str, Sequence[str], None] = "2f8c6e1a9b3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("status", sa.String(), nullable=False, server_default="generated"),
    )
    op.add_column(
        "lessons",
        sa.Column("stage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lessons",
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lessons",
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "lessons",
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column("lessons", sa.Column("generator_provider", sa.String(), nullable=True))
    op.add_column("lessons", sa.Column("generator_model", sa.String(), nullable=True))
    op.add_column("lessons", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_lessons_status"), "lessons", ["status"], unique=False)

    op.create_table(
        "lesson_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "stage_order", name="uq_lesson_stages_lesson_stage_order"),
        sa.UniqueConstraint("lesson_id", "stage_uid", name="uq_lesson_stages_lesson_stage_uid"),
    )
    op.create_index(op.f("ix_lesson_stages_id"), "lesson_stages", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_stages_lesson_id"), "lesson_stages", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_lesson_stages_stage_uid"), "lesson_stages", ["stage_uid"], unique=False)
    op.create_index(op.f("ix_lesson_stages_component"), "lesson_stages", ["component"], unique=False)
    op.create_index(op.f("ix_lesson_stages_difficulty"), "lesson_stages", ["difficulty"], unique=False)
    op.create_index("ix_lesson_stages_lesson_component", "lesson_stages", ["lesson_id", "component"], unique=False)
    op.create_index("ix_lesson_stages_lesson_difficulty", "lesson_stages", ["lesson_id", "difficulty"], unique=False)

    op.add_column(
        "lesson_sessions",
        sa.Column("active_stage_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_sessions",
        sa.Column("total_stage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_sessions",
        sa.Column("primary_stage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_sessions",
        sa.Column("remedial_stage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_sessions",
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="2"),
    )

    op.create_table(
        "lesson_session_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_session_id", sa.Integer(), nullable=False),
        sa.Column("lesson_stage_id", sa.Integer(), nullable=True),
        sa.Column("stage_uid", sa.String(), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(), nullable=False, server_default="primary"),
        sa.Column("source_stage_uid", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
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
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["lesson_session_id"], ["lesson_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_stage_id"], ["lesson_stages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lesson_session_id",
            "stage_order",
            name="uq_lesson_session_stages_session_stage_order",
        ),
        sa.UniqueConstraint(
            "lesson_session_id",
            "stage_uid",
            name="uq_lesson_session_stages_session_stage_uid",
        ),
    )
    op.create_index(op.f("ix_lesson_session_stages_id"), "lesson_session_stages", ["id"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_lesson_session_id"), "lesson_session_stages", ["lesson_session_id"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_lesson_stage_id"), "lesson_session_stages", ["lesson_stage_id"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_stage_uid"), "lesson_session_stages", ["stage_uid"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_phase"), "lesson_session_stages", ["phase"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_status"), "lesson_session_stages", ["status"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_component"), "lesson_session_stages", ["component"], unique=False)
    op.create_index(op.f("ix_lesson_session_stages_difficulty"), "lesson_session_stages", ["difficulty"], unique=False)
    op.create_index("ix_lesson_session_stages_session_phase", "lesson_session_stages", ["lesson_session_id", "phase"], unique=False)
    op.create_index("ix_lesson_session_stages_session_status", "lesson_session_stages", ["lesson_session_id", "status"], unique=False)

    op.add_column("lesson_attempts", sa.Column("lesson_session_stage_id", sa.Integer(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("lesson_stage_id", sa.Integer(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("stage_order", sa.Integer(), nullable=True))
    op.add_column(
        "lesson_attempts",
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("lesson_attempts", sa.Column("result", sa.String(), nullable=True))
    op.add_column("lesson_attempts", sa.Column("response_time_ms", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_lesson_attempts_lesson_session_stage_id",
        "lesson_attempts",
        "lesson_session_stages",
        ["lesson_session_stage_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_lesson_attempts_lesson_stage_id",
        "lesson_attempts",
        "lesson_stages",
        ["lesson_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_lesson_attempts_lesson_session_stage_id"),
        "lesson_attempts",
        ["lesson_session_stage_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_attempts_lesson_stage_id"),
        "lesson_attempts",
        ["lesson_stage_id"],
        unique=False,
    )
    op.create_index(op.f("ix_lesson_attempts_stage_order"), "lesson_attempts", ["stage_order"], unique=False)
    op.create_index(op.f("ix_lesson_attempts_result"), "lesson_attempts", ["result"], unique=False)

    op.add_column("lesson_failed_stages", sa.Column("lesson_session_stage_id", sa.Integer(), nullable=True))
    op.add_column("lesson_failed_stages", sa.Column("lesson_stage_id", sa.Integer(), nullable=True))
    op.add_column("lesson_failed_stages", sa.Column("stage_order", sa.Integer(), nullable=True))
    op.add_column("lesson_failed_stages", sa.Column("module", sa.String(), nullable=True))
    op.add_column("lesson_failed_stages", sa.Column("difficulty", sa.String(), nullable=True))
    op.add_column("lesson_failed_stages", sa.Column("recommended_duration_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "lesson_failed_stages",
        sa.Column("item_count", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_foreign_key(
        "fk_lesson_failed_stages_lesson_session_stage_id",
        "lesson_failed_stages",
        "lesson_session_stages",
        ["lesson_session_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_lesson_failed_stages_lesson_stage_id",
        "lesson_failed_stages",
        "lesson_stages",
        ["lesson_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_lesson_failed_stages_lesson_session_stage_id"),
        "lesson_failed_stages",
        ["lesson_session_stage_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_failed_stages_lesson_stage_id"),
        "lesson_failed_stages",
        ["lesson_stage_id"],
        unique=False,
    )
    op.create_index(op.f("ix_lesson_failed_stages_stage_order"), "lesson_failed_stages", ["stage_order"], unique=False)
    op.create_index(op.f("ix_lesson_failed_stages_difficulty"), "lesson_failed_stages", ["difficulty"], unique=False)

    op.add_column(
        "lesson_remedials",
        sa.Column("stage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_remedials",
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "lesson_remedials",
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "lesson_remedials",
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="2"),
    )

    op.add_column("arena_rooms", sa.Column("season_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_arena_rooms_season_id",
        "arena_rooms",
        "arena_seasons",
        ["season_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_arena_rooms_season_id"), "arena_rooms", ["season_id"], unique=False)

    op.add_column(
        "arena_room_players",
        sa.Column("connection_state", sa.String(), nullable=False, server_default="connected"),
    )
    op.add_column(
        "arena_room_players",
        sa.Column("disconnect_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("arena_room_players", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    op.add_column("arena_room_players", sa.Column("disconnected_at", sa.DateTime(), nullable=True))
    op.add_column("arena_room_players", sa.Column("reconnected_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_arena_room_players_connection_state"), "arena_room_players", ["connection_state"], unique=False)
    op.create_index("ix_arena_room_players_room_connection", "arena_room_players", ["room_id", "connection_state"], unique=False)

    op.add_column("arena_matches", sa.Column("season_id", sa.Integer(), nullable=True))
    op.add_column("arena_matches", sa.Column("winner_user_id", sa.Integer(), nullable=True))
    op.add_column("arena_matches", sa.Column("player_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("arena_matches", sa.Column("round_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("arena_matches", sa.Column("completed_round_count", sa.Integer(), nullable=False, server_default="0"))
    op.create_foreign_key(
        "fk_arena_matches_season_id",
        "arena_matches",
        "arena_seasons",
        ["season_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_arena_matches_winner_user_id",
        "arena_matches",
        "users",
        ["winner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_arena_matches_season_id"), "arena_matches", ["season_id"], unique=False)
    op.create_index(op.f("ix_arena_matches_winner_user_id"), "arena_matches", ["winner_user_id"], unique=False)

    op.add_column(
        "arena_match_players",
        sa.Column("connection_state", sa.String(), nullable=False, server_default="connected"),
    )
    op.add_column(
        "arena_match_players",
        sa.Column("disconnect_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("arena_match_players", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    op.add_column("arena_match_players", sa.Column("disconnected_at", sa.DateTime(), nullable=True))
    op.add_column("arena_match_players", sa.Column("reconnected_at", sa.DateTime(), nullable=True))
    op.add_column(
        "arena_match_players",
        sa.Column("suspected_abandonment", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "arena_match_players",
        sa.Column("suspicious_low_latency_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "arena_match_players",
        sa.Column("low_latency_streak", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("arena_match_players", sa.Column("last_answer_response_ms", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_arena_match_players_connection_state"), "arena_match_players", ["connection_state"], unique=False)
    op.create_index(op.f("ix_arena_match_players_suspected_abandonment"), "arena_match_players", ["suspected_abandonment"], unique=False)

    op.add_column("arena_rounds", sa.Column("question_pool_item_id", sa.Integer(), nullable=True))
    op.add_column("arena_rounds", sa.Column("question_key", sa.String(), nullable=True))
    op.add_column("arena_rounds", sa.Column("difficulty", sa.String(), nullable=True))
    op.add_column("arena_rounds", sa.Column("question_count", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("arena_rounds", sa.Column("answered_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("arena_rounds", sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"))
    op.create_foreign_key(
        "fk_arena_rounds_question_pool_item_id",
        "arena_rounds",
        "arena_question_pool_items",
        ["question_pool_item_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_arena_rounds_question_pool_item_id"), "arena_rounds", ["question_pool_item_id"], unique=False)
    op.create_index(op.f("ix_arena_rounds_question_key"), "arena_rounds", ["question_key"], unique=False)
    op.create_index(op.f("ix_arena_rounds_difficulty"), "arena_rounds", ["difficulty"], unique=False)

    op.add_column("arena_answers", sa.Column("selected_option_id", sa.String(), nullable=True))
    op.create_index(op.f("ix_arena_answers_selected_option_id"), "arena_answers", ["selected_option_id"], unique=False)

    op.add_column("arena_queue_entries", sa.Column("season_id", sa.Integer(), nullable=True))
    op.add_column("arena_queue_entries", sa.Column("match_found_at", sa.DateTime(), nullable=True))
    op.add_column("arena_queue_entries", sa.Column("closed_at", sa.DateTime(), nullable=True))
    op.create_foreign_key(
        "fk_arena_queue_entries_season_id",
        "arena_queue_entries",
        "arena_seasons",
        ["season_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_arena_queue_entries_season_id"), "arena_queue_entries", ["season_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_arena_queue_entries_season_id"), table_name="arena_queue_entries")
    op.drop_constraint("fk_arena_queue_entries_season_id", "arena_queue_entries", type_="foreignkey")
    op.drop_column("arena_queue_entries", "closed_at")
    op.drop_column("arena_queue_entries", "match_found_at")
    op.drop_column("arena_queue_entries", "season_id")

    op.drop_index(op.f("ix_arena_answers_selected_option_id"), table_name="arena_answers")
    op.drop_column("arena_answers", "selected_option_id")

    op.drop_index(op.f("ix_arena_rounds_difficulty"), table_name="arena_rounds")
    op.drop_index(op.f("ix_arena_rounds_question_key"), table_name="arena_rounds")
    op.drop_index(op.f("ix_arena_rounds_question_pool_item_id"), table_name="arena_rounds")
    op.drop_constraint("fk_arena_rounds_question_pool_item_id", "arena_rounds", type_="foreignkey")
    op.drop_column("arena_rounds", "correct_count")
    op.drop_column("arena_rounds", "answered_count")
    op.drop_column("arena_rounds", "question_count")
    op.drop_column("arena_rounds", "difficulty")
    op.drop_column("arena_rounds", "question_key")
    op.drop_column("arena_rounds", "question_pool_item_id")

    op.drop_index(op.f("ix_arena_match_players_suspected_abandonment"), table_name="arena_match_players")
    op.drop_index(op.f("ix_arena_match_players_connection_state"), table_name="arena_match_players")
    op.drop_column("arena_match_players", "last_answer_response_ms")
    op.drop_column("arena_match_players", "low_latency_streak")
    op.drop_column("arena_match_players", "suspicious_low_latency_count")
    op.drop_column("arena_match_players", "suspected_abandonment")
    op.drop_column("arena_match_players", "reconnected_at")
    op.drop_column("arena_match_players", "disconnected_at")
    op.drop_column("arena_match_players", "last_seen_at")
    op.drop_column("arena_match_players", "disconnect_count")
    op.drop_column("arena_match_players", "connection_state")

    op.drop_index(op.f("ix_arena_matches_winner_user_id"), table_name="arena_matches")
    op.drop_index(op.f("ix_arena_matches_season_id"), table_name="arena_matches")
    op.drop_constraint("fk_arena_matches_winner_user_id", "arena_matches", type_="foreignkey")
    op.drop_constraint("fk_arena_matches_season_id", "arena_matches", type_="foreignkey")
    op.drop_column("arena_matches", "completed_round_count")
    op.drop_column("arena_matches", "round_count")
    op.drop_column("arena_matches", "player_count")
    op.drop_column("arena_matches", "winner_user_id")
    op.drop_column("arena_matches", "season_id")

    op.drop_index("ix_arena_room_players_room_connection", table_name="arena_room_players")
    op.drop_index(op.f("ix_arena_room_players_connection_state"), table_name="arena_room_players")
    op.drop_column("arena_room_players", "reconnected_at")
    op.drop_column("arena_room_players", "disconnected_at")
    op.drop_column("arena_room_players", "last_seen_at")
    op.drop_column("arena_room_players", "disconnect_count")
    op.drop_column("arena_room_players", "connection_state")

    op.drop_index(op.f("ix_arena_rooms_season_id"), table_name="arena_rooms")
    op.drop_constraint("fk_arena_rooms_season_id", "arena_rooms", type_="foreignkey")
    op.drop_column("arena_rooms", "season_id")

    op.drop_column("lesson_remedials", "schema_version")
    op.drop_column("lesson_remedials", "estimated_duration_minutes")
    op.drop_column("lesson_remedials", "question_count")
    op.drop_column("lesson_remedials", "stage_count")

    op.drop_index(op.f("ix_lesson_failed_stages_difficulty"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_stage_order"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_lesson_stage_id"), table_name="lesson_failed_stages")
    op.drop_index(op.f("ix_lesson_failed_stages_lesson_session_stage_id"), table_name="lesson_failed_stages")
    op.drop_constraint("fk_lesson_failed_stages_lesson_stage_id", "lesson_failed_stages", type_="foreignkey")
    op.drop_constraint("fk_lesson_failed_stages_lesson_session_stage_id", "lesson_failed_stages", type_="foreignkey")
    op.drop_column("lesson_failed_stages", "item_count")
    op.drop_column("lesson_failed_stages", "recommended_duration_minutes")
    op.drop_column("lesson_failed_stages", "difficulty")
    op.drop_column("lesson_failed_stages", "module")
    op.drop_column("lesson_failed_stages", "stage_order")
    op.drop_column("lesson_failed_stages", "lesson_stage_id")
    op.drop_column("lesson_failed_stages", "lesson_session_stage_id")

    op.drop_index(op.f("ix_lesson_attempts_result"), table_name="lesson_attempts")
    op.drop_index(op.f("ix_lesson_attempts_stage_order"), table_name="lesson_attempts")
    op.drop_index(op.f("ix_lesson_attempts_lesson_stage_id"), table_name="lesson_attempts")
    op.drop_index(op.f("ix_lesson_attempts_lesson_session_stage_id"), table_name="lesson_attempts")
    op.drop_constraint("fk_lesson_attempts_lesson_stage_id", "lesson_attempts", type_="foreignkey")
    op.drop_constraint("fk_lesson_attempts_lesson_session_stage_id", "lesson_attempts", type_="foreignkey")
    op.drop_column("lesson_attempts", "response_time_ms")
    op.drop_column("lesson_attempts", "result")
    op.drop_column("lesson_attempts", "attempt_number")
    op.drop_column("lesson_attempts", "stage_order")
    op.drop_column("lesson_attempts", "lesson_stage_id")
    op.drop_column("lesson_attempts", "lesson_session_stage_id")

    op.drop_index("ix_lesson_session_stages_session_status", table_name="lesson_session_stages")
    op.drop_index("ix_lesson_session_stages_session_phase", table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_difficulty"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_component"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_status"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_phase"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_stage_uid"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_lesson_stage_id"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_lesson_session_id"), table_name="lesson_session_stages")
    op.drop_index(op.f("ix_lesson_session_stages_id"), table_name="lesson_session_stages")
    op.drop_table("lesson_session_stages")

    op.drop_column("lesson_sessions", "schema_version")
    op.drop_column("lesson_sessions", "remedial_stage_count")
    op.drop_column("lesson_sessions", "primary_stage_count")
    op.drop_column("lesson_sessions", "total_stage_count")
    op.drop_column("lesson_sessions", "active_stage_order")

    op.drop_index("ix_lesson_stages_lesson_difficulty", table_name="lesson_stages")
    op.drop_index("ix_lesson_stages_lesson_component", table_name="lesson_stages")
    op.drop_index(op.f("ix_lesson_stages_difficulty"), table_name="lesson_stages")
    op.drop_index(op.f("ix_lesson_stages_component"), table_name="lesson_stages")
    op.drop_index(op.f("ix_lesson_stages_stage_uid"), table_name="lesson_stages")
    op.drop_index(op.f("ix_lesson_stages_lesson_id"), table_name="lesson_stages")
    op.drop_index(op.f("ix_lesson_stages_id"), table_name="lesson_stages")
    op.drop_table("lesson_stages")

    op.drop_index(op.f("ix_lessons_status"), table_name="lessons")
    op.drop_column("lessons", "updated_at")
    op.drop_column("lessons", "generator_model")
    op.drop_column("lessons", "generator_provider")
    op.drop_column("lessons", "schema_version")
    op.drop_column("lessons", "estimated_duration_minutes")
    op.drop_column("lessons", "question_count")
    op.drop_column("lessons", "stage_count")
    op.drop_column("lessons", "status")
