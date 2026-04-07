"""add arena foundation

Revision ID: 9d3c1a4b7ef2
Revises: f2b4a7e91c0d
Create Date: 2026-04-02 16:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d3c1a4b7ef2"
down_revision: Union[str, Sequence[str], None] = "f2b4a7e91c0d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "public_courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="intermediate"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_arena_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("tags_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_public_courses_id", "public_courses", ["id"])
    op.create_index("ix_public_courses_slug", "public_courses", ["slug"], unique=True)
    op.create_index("ix_public_courses_title", "public_courses", ["title"])
    op.create_index("ix_public_courses_topic", "public_courses", ["topic"])
    op.create_index("ix_public_courses_is_published", "public_courses", ["is_published"])
    op.create_index("ix_public_courses_is_arena_enabled", "public_courses", ["is_arena_enabled"])

    op.create_table(
        "arena_seasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="upcoming"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("leaderboard_config_json", sa.JSON(), nullable=True),
        sa.Column("reward_config_json", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_arena_seasons_id", "arena_seasons", ["id"])
    op.create_index("ix_arena_seasons_name", "arena_seasons", ["name"], unique=True)
    op.create_index("ix_arena_seasons_status", "arena_seasons", ["status"])
    op.create_index("ix_arena_seasons_is_active", "arena_seasons", ["is_active"])

    op.create_table(
        "arena_matches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), nullable=True),
        sa.Column("public_course_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("room_snapshot_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("rules_snapshot_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("standings_json", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["public_course_id"], ["public_courses.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_arena_matches_id", "arena_matches", ["id"])
    op.create_index("ix_arena_matches_room_id", "arena_matches", ["room_id"])
    op.create_index("ix_arena_matches_public_course_id", "arena_matches", ["public_course_id"])
    op.create_index("ix_arena_matches_mode", "arena_matches", ["mode"])
    op.create_index("ix_arena_matches_status", "arena_matches", ["status"])
    op.create_index(
        "ix_arena_matches_public_course_status",
        "arena_matches",
        ["public_course_id", "status"],
    )

    op.create_table(
        "arena_rooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_code", sa.String(length=12), nullable=False),
        sa.Column("host_user_id", sa.Integer(), nullable=False),
        sa.Column("public_course_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False, server_default="private_room"),
        sa.Column("visibility", sa.String(), nullable=False, server_default="private"),
        sa.Column("status", sa.String(), nullable=False, server_default="lobby"),
        sa.Column("max_players", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("round_count", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("round_time_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("allow_rematch", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("room_settings_json", sa.JSON(), nullable=True),
        sa.Column("latest_match_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["public_course_id"], ["public_courses.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("room_code", name="uq_arena_rooms_room_code"),
    )
    op.create_index("ix_arena_rooms_id", "arena_rooms", ["id"])
    op.create_index("ix_arena_rooms_room_code", "arena_rooms", ["room_code"])
    op.create_index("ix_arena_rooms_host_user_id", "arena_rooms", ["host_user_id"])
    op.create_index("ix_arena_rooms_public_course_id", "arena_rooms", ["public_course_id"])
    op.create_index("ix_arena_rooms_mode", "arena_rooms", ["mode"])
    op.create_index("ix_arena_rooms_status", "arena_rooms", ["status"])

    op.create_index("ix_arena_rooms_latest_match_id", "arena_rooms", ["latest_match_id"])
    op.create_table(
        "arena_room_players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["arena_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("room_id", "user_id", name="uq_arena_room_players_room_user"),
    )
    op.create_index("ix_arena_room_players_id", "arena_room_players", ["id"])
    op.create_index("ix_arena_room_players_room_id", "arena_room_players", ["room_id"])
    op.create_index("ix_arena_room_players_user_id", "arena_room_players", ["user_id"])
    op.create_index(
        "ix_arena_room_players_room_ready",
        "arena_room_players",
        ["room_id", "is_ready"],
    )

    op.create_table(
        "arena_invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invite_token", sa.String(length=36), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("inviter_user_id", sa.Integer(), nullable=False),
        sa.Column("invitee_user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["arena_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inviter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invitee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("invite_token", name="uq_arena_invites_invite_token"),
    )
    op.create_index("ix_arena_invites_id", "arena_invites", ["id"])
    op.create_index("ix_arena_invites_room_id", "arena_invites", ["room_id"])
    op.create_index("ix_arena_invites_inviter_user_id", "arena_invites", ["inviter_user_id"])
    op.create_index("ix_arena_invites_invitee_user_id", "arena_invites", ["invitee_user_id"])
    op.create_index("ix_arena_invites_status", "arena_invites", ["status"])

    op.create_table(
        "arena_match_players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("final_rank", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("incorrect_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_response_ms", sa.Integer(), nullable=True),
        sa.Column("rating_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("match_id", "user_id", name="uq_arena_match_players_match_user"),
    )
    op.create_index("ix_arena_match_players_id", "arena_match_players", ["id"])
    op.create_index("ix_arena_match_players_match_id", "arena_match_players", ["match_id"])
    op.create_index("ix_arena_match_players_user_id", "arena_match_players", ["user_id"])

    op.create_table(
        "arena_rounds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("round_index", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("question_snapshot_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("timer_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("revealed_answer_json", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("deadline_at", sa.DateTime(), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("match_id", "round_index", name="uq_arena_rounds_match_round"),
    )
    op.create_index("ix_arena_rounds_id", "arena_rounds", ["id"])
    op.create_index("ix_arena_rounds_match_id", "arena_rounds", ["match_id"])
    op.create_index("ix_arena_rounds_status", "arena_rounds", ["status"])
    op.create_index("ix_arena_rounds_match_status", "arena_rounds", ["match_id", "status"])

    op.create_table(
        "arena_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("round_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("answer_payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("score_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["round_id"], ["arena_rounds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("round_id", "user_id", name="uq_arena_answers_round_user"),
    )
    op.create_index("ix_arena_answers_id", "arena_answers", ["id"])
    op.create_index("ix_arena_answers_match_id", "arena_answers", ["match_id"])
    op.create_index("ix_arena_answers_round_id", "arena_answers", ["round_id"])
    op.create_index("ix_arena_answers_user_id", "arena_answers", ["user_id"])
    op.create_index("ix_arena_answers_match_user", "arena_answers", ["match_id", "user_id"])

    op.create_table(
        "arena_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.String(length=36), nullable=False),
        sa.Column("stream_type", sa.String(), nullable=False),
        sa.Column("room_code", sa.String(length=12), nullable=True),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("event_id", name="uq_arena_events_event_id"),
    )
    op.create_index("ix_arena_events_id", "arena_events", ["id"])
    op.create_index("ix_arena_events_event_id", "arena_events", ["event_id"])
    op.create_index("ix_arena_events_stream_type", "arena_events", ["stream_type"])
    op.create_index("ix_arena_events_room_code", "arena_events", ["room_code"])
    op.create_index("ix_arena_events_match_id", "arena_events", ["match_id"])
    op.create_index("ix_arena_events_event_type", "arena_events", ["event_type"])
    op.create_index("ix_arena_events_room_cursor", "arena_events", ["room_code", "id"])
    op.create_index("ix_arena_events_match_cursor", "arena_events", ["match_id", "id"])

    op.create_table(
        "arena_question_pools",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_course_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["public_course_id"], ["public_courses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("public_course_id", "slug", name="uq_arena_question_pools_course_slug"),
    )
    op.create_index("ix_arena_question_pools_id", "arena_question_pools", ["id"])
    op.create_index("ix_arena_question_pools_public_course_id", "arena_question_pools", ["public_course_id"])
    op.create_index("ix_arena_question_pools_slug", "arena_question_pools", ["slug"])
    op.create_index("ix_arena_question_pools_is_active", "arena_question_pools", ["is_active"])

    op.create_table(
        "arena_question_pool_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pool_id", sa.Integer(), nullable=False),
        sa.Column("question_key", sa.String(), nullable=False),
        sa.Column("prompt", sa.String(), nullable=False),
        sa.Column("options_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("correct_option_id", sa.String(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False, server_default="normal"),
        sa.Column("knowledge_tags_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("explanation", sa.String(), nullable=True),
        sa.Column("source_unit_id", sa.String(), nullable=True),
        sa.Column("source_node_id", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["pool_id"], ["arena_question_pools.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("pool_id", "question_key", name="uq_arena_question_pool_items_pool_question"),
    )
    op.create_index("ix_arena_question_pool_items_id", "arena_question_pool_items", ["id"])
    op.create_index("ix_arena_question_pool_items_pool_id", "arena_question_pool_items", ["pool_id"])
    op.create_index("ix_arena_question_pool_items_question_key", "arena_question_pool_items", ["question_key"])
    op.create_index("ix_arena_question_pool_items_difficulty", "arena_question_pool_items", ["difficulty"])
    op.create_index("ix_arena_question_pool_items_is_active", "arena_question_pool_items", ["is_active"])
    op.create_index(
        "ix_arena_question_pool_items_pool_difficulty",
        "arena_question_pool_items",
        ["pool_id", "difficulty"],
    )

    op.create_table(
        "arena_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("rank_tier", sa.String(), nullable=False, server_default="Bronze"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ranked_matches", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_rank_tier", sa.String(), nullable=False, server_default="Bronze"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_arena_ratings_user"),
    )
    op.create_index("ix_arena_ratings_id", "arena_ratings", ["id"])
    op.create_index("ix_arena_ratings_user_id", "arena_ratings", ["user_id"])
    op.create_index("ix_arena_ratings_rank_tier", "arena_ratings", ["rank_tier"])
    op.create_index("ix_arena_ratings_rating", "arena_ratings", ["rating"])

    op.create_table(
        "arena_player_topic_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("public_course_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("rank_tier", sa.String(), nullable=False, server_default="Bronze"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["public_course_id"], ["public_courses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "user_id",
            "public_course_id",
            name="uq_arena_player_topic_ratings_user_course",
        ),
    )
    op.create_index("ix_arena_player_topic_ratings_id", "arena_player_topic_ratings", ["id"])
    op.create_index("ix_arena_player_topic_ratings_user_id", "arena_player_topic_ratings", ["user_id"])
    op.create_index("ix_arena_player_topic_ratings_public_course_id", "arena_player_topic_ratings", ["public_course_id"])

    op.create_table(
        "arena_rank_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=True),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("rating_before", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("rating_after", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("rating_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rank_tier_before", sa.String(), nullable=False, server_default="Bronze"),
        sa.Column("rank_tier_after", sa.String(), nullable=False, server_default="Bronze"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["season_id"], ["arena_seasons.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["match_id"], ["arena_matches.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_arena_rank_history_id", "arena_rank_history", ["id"])
    op.create_index("ix_arena_rank_history_user_id", "arena_rank_history", ["user_id"])
    op.create_index("ix_arena_rank_history_season_id", "arena_rank_history", ["season_id"])
    op.create_index("ix_arena_rank_history_match_id", "arena_rank_history", ["match_id"])


def downgrade() -> None:
    op.drop_index("ix_arena_question_pool_items_pool_difficulty", table_name="arena_question_pool_items")
    op.drop_index("ix_arena_question_pool_items_is_active", table_name="arena_question_pool_items")
    op.drop_index("ix_arena_question_pool_items_difficulty", table_name="arena_question_pool_items")
    op.drop_index("ix_arena_question_pool_items_question_key", table_name="arena_question_pool_items")
    op.drop_index("ix_arena_question_pool_items_pool_id", table_name="arena_question_pool_items")
    op.drop_index("ix_arena_question_pool_items_id", table_name="arena_question_pool_items")
    op.drop_table("arena_question_pool_items")

    op.drop_index("ix_arena_question_pools_is_active", table_name="arena_question_pools")
    op.drop_index("ix_arena_question_pools_slug", table_name="arena_question_pools")
    op.drop_index("ix_arena_question_pools_public_course_id", table_name="arena_question_pools")
    op.drop_index("ix_arena_question_pools_id", table_name="arena_question_pools")
    op.drop_table("arena_question_pools")

    op.drop_index("ix_arena_events_match_cursor", table_name="arena_events")
    op.drop_index("ix_arena_events_room_cursor", table_name="arena_events")
    op.drop_index("ix_arena_events_event_type", table_name="arena_events")
    op.drop_index("ix_arena_events_match_id", table_name="arena_events")
    op.drop_index("ix_arena_events_room_code", table_name="arena_events")
    op.drop_index("ix_arena_events_stream_type", table_name="arena_events")
    op.drop_index("ix_arena_events_event_id", table_name="arena_events")
    op.drop_index("ix_arena_events_id", table_name="arena_events")
    op.drop_table("arena_events")

    op.drop_index("ix_arena_answers_match_user", table_name="arena_answers")
    op.drop_index("ix_arena_answers_user_id", table_name="arena_answers")
    op.drop_index("ix_arena_answers_round_id", table_name="arena_answers")
    op.drop_index("ix_arena_answers_match_id", table_name="arena_answers")
    op.drop_index("ix_arena_answers_id", table_name="arena_answers")
    op.drop_table("arena_answers")

    op.drop_index("ix_arena_rounds_match_status", table_name="arena_rounds")
    op.drop_index("ix_arena_rounds_status", table_name="arena_rounds")
    op.drop_index("ix_arena_rounds_match_id", table_name="arena_rounds")
    op.drop_index("ix_arena_rounds_id", table_name="arena_rounds")
    op.drop_table("arena_rounds")

    op.drop_index("ix_arena_rank_history_match_id", table_name="arena_rank_history")
    op.drop_index("ix_arena_rank_history_season_id", table_name="arena_rank_history")
    op.drop_index("ix_arena_rank_history_user_id", table_name="arena_rank_history")
    op.drop_index("ix_arena_rank_history_id", table_name="arena_rank_history")
    op.drop_table("arena_rank_history")

    op.drop_index("ix_arena_player_topic_ratings_public_course_id", table_name="arena_player_topic_ratings")
    op.drop_index("ix_arena_player_topic_ratings_user_id", table_name="arena_player_topic_ratings")
    op.drop_index("ix_arena_player_topic_ratings_id", table_name="arena_player_topic_ratings")
    op.drop_table("arena_player_topic_ratings")

    op.drop_index("ix_arena_ratings_rating", table_name="arena_ratings")
    op.drop_index("ix_arena_ratings_rank_tier", table_name="arena_ratings")
    op.drop_index("ix_arena_ratings_user_id", table_name="arena_ratings")
    op.drop_index("ix_arena_ratings_id", table_name="arena_ratings")
    op.drop_table("arena_ratings")

    op.drop_index("ix_arena_match_players_user_id", table_name="arena_match_players")
    op.drop_index("ix_arena_match_players_match_id", table_name="arena_match_players")
    op.drop_index("ix_arena_match_players_id", table_name="arena_match_players")
    op.drop_table("arena_match_players")

    op.drop_index("ix_arena_invites_status", table_name="arena_invites")
    op.drop_index("ix_arena_invites_invitee_user_id", table_name="arena_invites")
    op.drop_index("ix_arena_invites_inviter_user_id", table_name="arena_invites")
    op.drop_index("ix_arena_invites_room_id", table_name="arena_invites")
    op.drop_index("ix_arena_invites_id", table_name="arena_invites")
    op.drop_table("arena_invites")

    op.drop_index("ix_arena_room_players_room_ready", table_name="arena_room_players")
    op.drop_index("ix_arena_room_players_user_id", table_name="arena_room_players")
    op.drop_index("ix_arena_room_players_room_id", table_name="arena_room_players")
    op.drop_index("ix_arena_room_players_id", table_name="arena_room_players")
    op.drop_table("arena_room_players")

    op.drop_index("ix_arena_rooms_latest_match_id", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_status", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_mode", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_public_course_id", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_host_user_id", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_room_code", table_name="arena_rooms")
    op.drop_index("ix_arena_rooms_id", table_name="arena_rooms")
    op.drop_table("arena_rooms")

    op.drop_index("ix_arena_matches_public_course_status", table_name="arena_matches")
    op.drop_index("ix_arena_matches_status", table_name="arena_matches")
    op.drop_index("ix_arena_matches_mode", table_name="arena_matches")
    op.drop_index("ix_arena_matches_public_course_id", table_name="arena_matches")
    op.drop_index("ix_arena_matches_room_id", table_name="arena_matches")
    op.drop_index("ix_arena_matches_id", table_name="arena_matches")
    op.drop_table("arena_matches")

    op.drop_index("ix_arena_seasons_is_active", table_name="arena_seasons")
    op.drop_index("ix_arena_seasons_status", table_name="arena_seasons")
    op.drop_index("ix_arena_seasons_name", table_name="arena_seasons")
    op.drop_index("ix_arena_seasons_id", table_name="arena_seasons")
    op.drop_table("arena_seasons")

    op.drop_index("ix_public_courses_is_arena_enabled", table_name="public_courses")
    op.drop_index("ix_public_courses_is_published", table_name="public_courses")
    op.drop_index("ix_public_courses_topic", table_name="public_courses")
    op.drop_index("ix_public_courses_title", table_name="public_courses")
    op.drop_index("ix_public_courses_slug", table_name="public_courses")
    op.drop_index("ix_public_courses_id", table_name="public_courses")
    op.drop_table("public_courses")
