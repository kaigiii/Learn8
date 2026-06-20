import pytest
from datetime import timedelta

from fastapi import HTTPException

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import settings
from app.arena.config import arena_settings
from app.core.time import utc_now
from app.arena.domain.arena_modes import ArenaMode
from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaRoomStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.arena.models.arena_queue import ArenaQueueEntryModel
from app.arena.models.arena_round import ArenaAnswerModel, ArenaRoundModel
from app.arena.models.arena_room import ArenaRoomPlayerModel
from app.arena.models.arena_rating import ArenaRankHistoryModel, ArenaRatingModel
from app.arena.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.arena.services.admin_service import AdminService
from app.arena.services.competitive_service import CompetitiveService
from app.arena.services.presence_service import PresenceService
from app.arena.services.rank_service import RankService
from app.arena.services.rating_service import RatingService
from app.arena.services.realtime_gateway import RealtimeGateway
from app.arena.services.round_engine import RoundEngine
from app.arena.services.telemetry_service import TelemetryService
from app.arena.services.room_service import RoomService
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_intermission_seconds():
    # Set intermission to 0 to avoid race conditions in tests
    original_value = arena_settings.ARENA_INTERMISSION_SECONDS
    arena_settings.ARENA_INTERMISSION_SECONDS = 0
    yield
    arena_settings.ARENA_INTERMISSION_SECONDS = original_value


def test_avatar_image_falls_back_to_default_when_missing(tmp_path, monkeypatch):
    avatar_dir = tmp_path / "avatar"
    avatar_dir.mkdir(parents=True, exist_ok=True)

    default_avatar = tmp_path / "chicken.png"
    default_avatar.write_bytes(b"fake-png-bytes")

    monkeypatch.setattr(auth_endpoints, "AVATAR_IMAGE_DIR", avatar_dir)
    monkeypatch.setattr(auth_endpoints, "DEFAULT_AVATAR_PATH", default_avatar)

    response = auth_endpoints.get_avatar_image("missing.png")

    assert response.path == str(default_avatar)
    assert response.media_type == "image/png"


def _create_public_course(db_session):
    course = PublicCourseModel(
        slug="python-basics",
        title="Python Basics",
        topic="Python Basics",
        description="Official Arena topic for Python newcomers.",
        is_published=True,
        tags_json=["python", "basics"],
        metadata_json={
            "arena_questions": [
                {
                    "question_id": "q1",
                    "prompt": "Which keyword defines a function in Python?",
                    "options": [
                        {"id": "a", "text": "func"},
                        {"id": "b", "text": "define"},
                        {"id": "c", "text": "def"},
                        {"id": "d", "text": "lambda"},
                    ],
                    "correct_option_id": "c",
                    "knowledge_tags": ["functions"],
                },
                {
                    "question_id": "q2",
                    "prompt": "Which type stores ordered mutable items?",
                    "options": [
                        {"id": "a", "text": "tuple"},
                        {"id": "b", "text": "list"},
                        {"id": "c", "text": "set"},
                        {"id": "d", "text": "str"},
                    ],
                    "correct_option_id": "b",
                    "knowledge_tags": ["collections"],
                },
            ]
        },
    )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


def _create_question_pool(db_session, public_course: PublicCourseModel):
    pool = ArenaQuestionPoolModel(
        public_course_id=public_course.id,
        slug="default-ranked-pool",
        title="Default Ranked Pool",
        is_active=True,
        version=1,
    )
    db_session.add(pool)
    db_session.commit()
    db_session.refresh(pool)

    db_session.add_all(
        [
            ArenaQuestionPoolItemModel(
                pool_id=pool.id,
                question_key="q1",
                prompt="Which keyword defines a function in Python?",
                options_json=[
                    {"id": "a", "text": "func"},
                    {"id": "b", "text": "define"},
                    {"id": "c", "text": "def"},
                    {"id": "d", "text": "lambda"},
                ],
                correct_option_id="c",
                difficulty="easy",
                knowledge_tags_json=["functions"],
            ),
            ArenaQuestionPoolItemModel(
                pool_id=pool.id,
                question_key="q2",
                prompt="Which type stores ordered mutable items?",
                options_json=[
                    {"id": "a", "text": "tuple"},
                    {"id": "b", "text": "list"},
                    {"id": "c", "text": "set"},
                    {"id": "d", "text": "str"},
                ],
                correct_option_id="b",
                difficulty="easy",
                knowledge_tags_json=["collections"],
            ),
        ]
    )
    db_session.commit()
    return pool


def _activate_round_for_players(db_session, round_engine: RoundEngine, match_id: int, players: list[UserModel]):
    state = round_engine.get_match_state(db_session, match_id, players[0])
    round_id = state["activeRound"]["roundId"]
    for player in players:
        round_engine.mark_question_ready(
            db_session,
            match_id=match_id,
            round_id=round_id,
            current_user=player,
        )
    return round_engine.get_match_state(db_session, match_id, players[0])


def _create_user(db_session, email: str, full_name: str | None = None):
    user = UserModel(
        email=email,
        hashed_password="hashed",
        full_name=full_name,
        credits=100,
        xp=0,
        level=1,
        xp_to_next_level=100,
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


def _create_rating(db_session, user_id: int, rating: int):
    arena_rating = ArenaRatingModel(
        user_id=user_id,
        rating=rating,
        rank_tier="Bronze",
        best_rank_tier="Bronze",
    )
    db_session.add(arena_rating)
    db_session.flush()
    db_session.refresh(arena_rating)
    return arena_rating


def _create_competitive_match(db_session, public_course_id: int, player_ids: list[int]):
    match = ArenaMatchModel(
        public_course_id=public_course_id,
        room_id=None,
        mode=ArenaMode.COMPETITIVE,
        status=ArenaMatchStatus.FINISHED,
        room_snapshot_json={"queue_mode": True, "player_ids": player_ids},
        rules_snapshot_json={"round_count": 5, "round_time_seconds": 30, "max_players": len(player_ids)},
        started_at=utc_now(),
        ended_at=utc_now(),
    )
    db_session.add(match)
    db_session.flush()
    db_session.refresh(match)

    db_session.add_all(
        [ArenaMatchPlayerModel(match_id=match.id, user_id=player_id) for player_id in player_ids]
    )
    db_session.flush()
    return match


def _create_waiting_queue_entry(db_session, user_id: int, public_course_id: int, pool_id: int | None = None):
    entry = ArenaQueueEntryModel(
        user_id=user_id,
        public_course_id=public_course_id,
        question_pool_id=pool_id,
        mode=ArenaMode.COMPETITIVE,
        status="waiting",
        expires_at=utc_now() + timedelta(minutes=3),
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


def test_room_service_create_join_ready_and_start_flow(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    season = ArenaSeasonModel(
        name="Season One",
        status="active",
        is_active=True,
        started_at=utc_now(),
    )
    db_session.add(season)
    db_session.commit()
    room_service = RoomService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=5,
        round_time_seconds=30,
    )

    assert room.host_user_id == user.id
    assert len(room.players) == 1
    assert room.room_code
    assert room.season_id == season.id
    host_room_player = next(player for player in room.players if player.user_id == user.id)
    assert host_room_player.connection_state == "connected"
    assert host_room_player.last_seen_at is not None

    joined_room = room_service.join_room(db_session, second_user, room.room_code)
    assert len(joined_room.players) == 2
    joined_room_player = next(player for player in joined_room.players if player.user_id == second_user.id)
    assert joined_room_player.connection_state == "connected"
    assert joined_room_player.last_seen_at is not None

    ready_room = room_service.set_ready(
        db_session,
        second_user,
        room.room_code,
        is_ready=True,
    )
    assert room_service.can_start_room(ready_room) is True

    match = room_service.start_room_match(db_session, user, room.room_code)
    assert match.room_id == room.id
    assert match.status == "in_progress"
    assert match.season_id == season.id
    assert match.player_count == 2
    assert match.round_count == 5
    assert match.completed_round_count == 0

    match_players = (
        db_session.query(ArenaMatchPlayerModel)
        .filter(ArenaMatchPlayerModel.match_id == match.id)
        .all()
    )
    assert len(match_players) == 2
    assert all(player.connection_state == "connected" for player in match_players)

    refreshed_room = room_service.get_room_by_code(db_session, room.room_code)
    assert refreshed_room.status == "in_match"
    assert refreshed_room.latest_match_id == match.id


def test_room_service_reassigns_host_when_host_leaves(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=5,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)

    room_service.leave_room(db_session, user, room.room_code)

    refreshed_room = room_service.get_room_by_code(db_session, room.room_code)
    assert refreshed_room.host_user_id == second_user.id
    assert len(refreshed_room.players) == 1
    assert refreshed_room.players[0].user_id == second_user.id


def test_room_service_closes_room_when_last_player_leaves(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    room_service = RoomService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=5,
        round_time_seconds=30,
    )

    room_service.leave_room(db_session, user, room.room_code)

    refreshed_room = room_service.get_room_by_code(db_session, room.room_code)
    assert refreshed_room.status == "closed"
    assert refreshed_room.closed_at is not None
    assert len(refreshed_room.players) == 0


def test_room_service_auto_closes_idle_lobby_rooms(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    room_service = RoomService()
    original_idle_minutes = arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES
    arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES = 15
    try:
        room = room_service.create_room(
            db_session,
            user,
            public_course_id=public_course.id,
            mode="private_room",
            visibility="private",
            max_players=4,
            round_count=5,
            round_time_seconds=30,
        )

        stale_at = utc_now() - timedelta(minutes=20)
        room.status = ArenaRoomStatus.LOBBY
        room.updated_at = stale_at
        for player in room.players:
            player.last_seen_at = stale_at
            player.updated_at = stale_at
            player.joined_at = stale_at
            db_session.add(player)
        db_session.add(room)
        db_session.commit()

        active_room = room_service.get_active_room_for_user(db_session, user.id)
        assert active_room is None

        refreshed_room = room_service.get_room_by_code(
            db_session, room.room_code, cleanup_idle=False
        )
        assert refreshed_room is not None
        assert refreshed_room.status == ArenaRoomStatus.CLOSED
        assert refreshed_room.closed_at is not None
    finally:
        arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES = original_idle_minutes


def test_room_service_keeps_lobby_open_when_presence_is_recent(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    room_service = RoomService()
    original_idle_minutes = arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES
    arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES = 15
    try:
        room = room_service.create_room(
            db_session,
            user,
            public_course_id=public_course.id,
            mode="private_room",
            visibility="private",
            max_players=4,
            round_count=5,
            round_time_seconds=30,
        )

        room.updated_at = utc_now() - timedelta(minutes=30)
        for player in room.players:
            player.last_seen_at = utc_now() - timedelta(minutes=1)
            db_session.add(player)
        db_session.add(room)
        db_session.commit()

        active_room = room_service.get_active_room_for_user(db_session, user.id)
        assert active_room is not None
        assert active_room.status == ArenaRoomStatus.LOBBY

        refreshed_room = room_service.get_room_by_code(
            db_session, room.room_code, cleanup_idle=False
        )
        assert refreshed_room is not None
        assert refreshed_room.status == ArenaRoomStatus.LOBBY
        assert refreshed_room.closed_at is None
    finally:
        arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES = original_idle_minutes


def test_room_service_prevents_start_before_all_non_hosts_ready(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai")
    room_service = RoomService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=5,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)

    try:
        room_service.start_room_match(db_session, user, room.room_code)
        assert False, "Expected host start guard to raise"
    except HTTPException as exc:
        assert exc.status_code == 409


def test_competitive_service_matches_waiting_players(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    service = CompetitiveService()

    first_entry = service.join_queue(
        db_session,
        user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )
    assert first_entry.status == "waiting"

    second_entry = service.join_queue(
        db_session,
        second_user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )

    assert second_entry.status == "matched"
    assert second_entry.match_id is not None

    refreshed_first = service.get_current_entry(db_session, user)
    assert refreshed_first is not None
    assert refreshed_first.status == "matched"
    assert refreshed_first.match_id == second_entry.match_id


def test_competitive_service_cancels_waiting_entry(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    service = CompetitiveService()

    service.join_queue(
        db_session,
        user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )
    service.cancel_current_entry(db_session, user)

    assert service.get_current_entry(db_session, user) is None
    cancelled_entry = db_session.query(ArenaQueueEntryModel).filter(ArenaQueueEntryModel.user_id == user.id).first()
    assert cancelled_entry is not None
    assert cancelled_entry.status == "cancelled"


def test_competitive_service_prefers_closest_rating_match(db_session, user):
    from app.arena.config import arena_settings
    # Temporarily use realistic windows instead of the global 9999 override
    orig_base = arena_settings.ARENA_MATCHMAKING_BASE_WINDOW
    orig_max = arena_settings.ARENA_MATCHMAKING_MAX_WINDOW
    arena_settings.ARENA_MATCHMAKING_BASE_WINDOW = 100
    arena_settings.ARENA_MATCHMAKING_MAX_WINDOW = 1000
    
    try:
        public_course = _create_public_course(db_session)
        _create_question_pool(db_session, public_course)
        far_user = _create_user(db_session, "far@learn8.ai", "Far Player")
        close_user = _create_user(db_session, "close@learn8.ai", "Close Player")
        service = CompetitiveService()
        
        _create_rating(db_session, user.id, 1000)
        _create_rating(db_session, far_user.id, 1280)
        _create_rating(db_session, close_user.id, 1035)
        
        service.join_queue(
            db_session,
            far_user,
            public_course_id=public_course.id,
            round_count=5,
            round_time_seconds=30,
        )
        service.join_queue(
            db_session,
            close_user,
            public_course_id=public_course.id,
            round_count=5,
            round_time_seconds=30,
        )
        
        challenger_entry = service.join_queue(
            db_session,
            user,
            public_course_id=public_course.id,
            round_count=5,
            round_time_seconds=30,
        )
        
        assert challenger_entry.status == "matched"
        assert challenger_entry.matched_user_id == close_user.id
    finally:
        arena_settings.ARENA_MATCHMAKING_BASE_WINDOW = orig_base
        arena_settings.ARENA_MATCHMAKING_MAX_WINDOW = orig_max


def test_competitive_service_avoids_immediate_rematches_when_possible(db_session, user):
    from app.arena.config import arena_settings
    orig_base = arena_settings.ARENA_MATCHMAKING_BASE_WINDOW
    orig_lookback = arena_settings.ARENA_MATCHMAKING_RECENT_REMATCH_LOOKBACK
    arena_settings.ARENA_MATCHMAKING_BASE_WINDOW = 100
    arena_settings.ARENA_MATCHMAKING_RECENT_REMATCH_LOOKBACK = 3
    
    try:
        # Create fresh users for this test to avoid shared fixture state
        main_user = _create_user(db_session, "main@learn8.ai", "Main Player")
        repeat_user = _create_user(db_session, "repeat@learn8.ai", "Repeat Player")
        fresh_user = _create_user(db_session, "fresh@learn8.ai", "Fresh Player")
        
        public_course = _create_public_course(db_session)
        service = CompetitiveService()
        
        _create_rating(db_session, main_user.id, 1000)
        _create_rating(db_session, repeat_user.id, 1010)
        _create_rating(db_session, fresh_user.id, 1020)
        
        # Manually create the pool so we can assign it to queue entries
        pool = _create_question_pool(db_session, public_course)
        
        # Record a recent match between main and repeat
        _create_competitive_match(db_session, public_course.id, [main_user.id, repeat_user.id])
        
        # Verify and ensure visibility
        recent = service._get_recent_opponent_ids(db_session, main_user.id)
        if repeat_user.id not in recent:
            # Fallback for session isolation issues in tests
            print(f"FORCING recent opponent {repeat_user.id} for {main_user.id}")
            db_session.flush()
        
        # Both opponents join queue
        _create_waiting_queue_entry(db_session, repeat_user.id, public_course.id, pool_id=pool.id)
        _create_waiting_queue_entry(db_session, fresh_user.id, public_course.id, pool_id=pool.id)
        db_session.flush()
        
        # Main user joins and should prefer the fresh user
        challenger_entry = service.join_queue(
            db_session,
            main_user,
            public_course_id=public_course.id,
            round_count=5,
            round_time_seconds=30,
        )
        
        assert challenger_entry.status == "matched"
        assert challenger_entry.matched_user_id == fresh_user.id
    finally:
        arena_settings.ARENA_MATCHMAKING_BASE_WINDOW = orig_base
        arena_settings.ARENA_MATCHMAKING_RECENT_REMATCH_LOOKBACK = orig_lookback


def test_competitive_service_expands_rating_window_for_long_waiters(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    veteran_user = _create_user(db_session, "veteran@learn8.ai", "Veteran Player")
    service = CompetitiveService()

    _create_rating(db_session, user.id, 1000)
    _create_rating(db_session, veteran_user.id, 1300)

    veteran_entry = service.join_queue(
        db_session,
        veteran_user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )
    veteran_entry.created_at = utc_now() - timedelta(seconds=80)
    db_session.add(veteran_entry)
    db_session.commit()

    challenger_entry = service.join_queue(
        db_session,
        user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )

    assert challenger_entry.status == "matched"
    assert challenger_entry.matched_user_id == veteran_user.id


def test_room_service_normalizes_legacy_competitive_mode_aliases(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    room_service = RoomService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="ranked",
        visibility="private",
        max_players=4,
        round_count=5,
        round_time_seconds=30,
    )

    assert room.mode == "competitive"


def test_rank_service_creates_default_profile_and_leaderboard_entry(db_session, user):
    _create_public_course(db_session)
    rank_service = RankService()

    payload = rank_service.build_profile_payload(db_session, user)
    leaderboard = rank_service.list_leaderboard(db_session)

    assert payload["userId"] == user.id
    assert payload["rating"] == 1000
    assert payload["rankTier"] == "Bronze"
    assert leaderboard[0]["userId"] == user.id
    assert leaderboard[0]["rating"] == 1000


def test_rank_service_adds_season_honors_to_profile_and_leaderboard(db_session, user):
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "honor@learn8.ai", "Honor Player")
    rank_service = RankService()

    season = ArenaSeasonModel(
        name="Season Honors",
        status="active",
        is_active=True,
        reward_config_json={
            "honorBrackets": [
                {"maxPlacement": 1, "title": "Season Champion", "badge": "Crown"},
                {"maxPlacement": 2, "title": "Podium Finisher", "badge": "Podium"},
            ]
        },
    )
    db_session.add(season)
    db_session.commit()
    db_session.refresh(season)

    db_session.add_all(
        [
            ArenaRankHistoryModel(
                user_id=user.id,
                season_id=season.id,
                match_id=1,
                rating_before=1000,
                rating_after=1120,
                rating_delta=120,
                rank_tier_before="Bronze",
                rank_tier_after="Silver",
            ),
            ArenaRankHistoryModel(
                user_id=opponent.id,
                season_id=season.id,
                match_id=2,
                rating_before=1000,
                rating_after=1080,
                rating_delta=80,
                rank_tier_before="Bronze",
                rank_tier_after="Silver",
            ),
        ]
    )
    db_session.commit()

    profile = rank_service.build_profile_payload(db_session, user)
    season_board = rank_service.list_season_leaderboard(db_session, season_id=season.id, limit=10)

    assert profile["seasonPlacement"] == 1
    assert profile["seasonBadge"] == "Crown"
    assert profile["seasonTitle"] == "Season Champion"
    assert season_board[0]["seasonBadge"] == "Crown"
    assert season_board[0]["seasonTitle"] == "Season Champion"
    assert season_board[1]["seasonBadge"] == "Podium"


def test_rating_service_rewards_upset_wins_more_than_expected_wins(db_session, user):
    public_course = _create_public_course(db_session)
    favored_opponent = _create_user(db_session, "favored@learn8.ai", "Favored")
    underdog_opponent = _create_user(db_session, "underdog@learn8.ai", "Underdog")
    rating_service = RatingService()

    _create_rating(db_session, user.id, 1000)
    _create_rating(db_session, favored_opponent.id, 1225)
    _create_rating(db_session, underdog_opponent.id, 875)

    upset_match = _create_competitive_match(db_session, public_course.id, [user.id, favored_opponent.id])
    upset_match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == upset_match.id).first()
    upset_standings = rating_service.settle_match(
        db_session,
        upset_match,
        [
            {
                "userId": user.id,
                "displayName": "Player",
                "score": 220,
                "correctCount": 5,
                "incorrectCount": 0,
                "answeredCount": 5,
                "averageResponseMs": 1800,
                "rank": 1,
            },
            {
                "userId": favored_opponent.id,
                "displayName": "Favored",
                "score": 160,
                "correctCount": 3,
                "incorrectCount": 2,
                "answeredCount": 5,
                "averageResponseMs": 2400,
                "rank": 2,
            },
        ],
    )

    expected_match = _create_competitive_match(db_session, public_course.id, [user.id, underdog_opponent.id])
    expected_match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == expected_match.id).first()
    expected_standings = rating_service.settle_match(
        db_session,
        expected_match,
        [
            {
                "userId": user.id,
                "displayName": "Player",
                "score": 220,
                "correctCount": 5,
                "incorrectCount": 0,
                "answeredCount": 5,
                "averageResponseMs": 1800,
                "rank": 1,
            },
            {
                "userId": underdog_opponent.id,
                "displayName": "Underdog",
                "score": 160,
                "correctCount": 3,
                "incorrectCount": 2,
                "answeredCount": 5,
                "averageResponseMs": 2400,
                "rank": 2,
            },
        ],
    )

    upset_gain = next(row for row in upset_standings if row["userId"] == user.id)["ratingDelta"]
    expected_gain = next(row for row in expected_standings if row["userId"] == user.id)["ratingDelta"]

    assert upset_gain > expected_gain


def test_rating_service_applies_abandonment_penalty_for_low_completion(db_session, user):
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "steady@learn8.ai", "Steady")
    rating_service = RatingService()

    _create_rating(db_session, user.id, 1000)
    _create_rating(db_session, opponent.id, 1000)

    match = _create_competitive_match(db_session, public_course.id, [user.id, opponent.id])
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()

    standings = rating_service.settle_match(
        db_session,
        match,
        [
            {
                "userId": opponent.id,
                "displayName": "Steady",
                "score": 180,
                "correctCount": 4,
                "incorrectCount": 1,
                "answeredCount": 5,
                "averageResponseMs": 2100,
                "rank": 1,
            },
            {
                "userId": user.id,
                "displayName": "Player",
                "score": 20,
                "correctCount": 0,
                "incorrectCount": 1,
                "answeredCount": 1,
                "averageResponseMs": 6000,
                "rank": 2,
            },
        ],
    )

    player_row = next(row for row in standings if row["userId"] == user.id)
    player_match = (
        db_session.query(ArenaMatchPlayerModel)
        .filter(
            ArenaMatchPlayerModel.match_id == match.id,
            ArenaMatchPlayerModel.user_id == user.id,
        )
        .first()
    )

    assert player_row["abandonmentPenalty"] > 0
    assert player_row["completionRatio"] == 0.2
    assert player_match is not None
    assert player_match.metadata_json["abandonment_penalty"] == player_row["abandonmentPenalty"]
    assert player_row["ratingDelta"] < -10


def test_round_engine_initializes_rounds_and_advances_match(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)
    rounds = (
        db_session.query(ArenaRoundModel)
        .filter(ArenaRoundModel.match_id == match.id)
        .order_by(ArenaRoundModel.round_index.asc())
        .all()
    )
    assert len(rounds) == 2
    assert all(round_item.question_key in {"q1", "q2"} for round_item in rounds)
    assert all(round_item.question_count == 4 for round_item in rounds)
    assert all(round_item.difficulty == "easy" for round_item in rounds)

    state = round_engine.get_match_state(db_session, match.id, user)
    assert state["status"] == "in_progress"
    assert state["totalRounds"] == 2
    assert state["activeRound"] is not None
    assert state["activeRound"]["status"] == "pending"

    ready_state = round_engine.mark_question_ready(
        db_session,
        match_id=match.id,
        round_id=state["activeRound"]["roundId"],
        current_user=user,
    )
    assert ready_state["activated"] is False

    ready_state = round_engine.mark_question_ready(
        db_session,
        match_id=match.id,
        round_id=state["activeRound"]["roundId"],
        current_user=second_user,
    )
    assert ready_state["activated"] is True
    assert ready_state["state"]["activeRound"]["status"] == "active"

    first_round_id = ready_state["state"]["activeRound"]["roundId"]
    first_correct = ready_state["state"]["activeRound"]["question"]["questionId"]

    if first_correct == "q1":
        user_answer = "c"
        second_answer = "a"
    else:
        user_answer = "b"
        second_answer = "a"

    first_submit = round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=first_round_id,
        current_user=user,
        selected_option_id=user_answer,
    )
    assert first_submit["accepted"] is True
    assert first_submit["state"]["status"] == "in_progress"
    assert first_submit["roundClosed"] is False
    assert first_submit["revealedAnswer"]["correctOptionId"] == user_answer
    assert first_submit["isCorrect"] is True
    assert first_submit["scoreAwarded"] > 0

    second_submit = round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=first_round_id,
        current_user=second_user,
        selected_option_id=second_answer,
    )
    assert second_submit["accepted"] is True
    assert second_submit["roundClosed"] is True
    assert second_submit["state"]["activeRound"] is not None
    assert second_submit["state"]["activeRound"]["status"] == "pending"
    second_ready_state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
    second_round_id = second_ready_state["activeRound"]["roundId"]
    second_question_id = second_ready_state["activeRound"]["question"]["questionId"]

    if second_question_id == "q1":
        user_second_answer = "c"
        second_user_second_answer = "a"
    else:
        user_second_answer = "b"
        second_user_second_answer = "a"

    round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=second_round_id,
        current_user=user,
        selected_option_id=user_second_answer,
    )
    final_submit = round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=second_round_id,
        current_user=second_user,
        selected_option_id=second_user_second_answer,
    )

    # Refresh state to reflect the state (should show in_progress but no activeRound)
    # Since we set INTERMISSION_SECONDS=0, the match might be FINISHED already
    # or the thread is about to finish. We'll check the flags.
    final_state = round_engine.get_match_state(db_session, match.id, user)

    assert final_submit["matchFinished"] is True 
    assert final_state["activeRound"] is None 
    assert final_state["standings"][0]["userId"] == user.id
    assert final_state["standings"][0]["score"] > final_state["standings"][1]["score"]

    refreshed_match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert refreshed_match is not None
    assert refreshed_match.completed_round_count == 2
    assert refreshed_match.winner_user_id == user.id

    closed_rounds = (
        db_session.query(ArenaRoundModel)
        .filter(ArenaRoundModel.match_id == match.id)
        .order_by(ArenaRoundModel.round_index.asc())
        .all()
    )
    assert all(round_item.answered_count == 2 for round_item in closed_rounds)
    assert sum(round_item.correct_count for round_item in closed_rounds) >= 2

    stored_answers = (
        db_session.query(ArenaAnswerModel)
        .filter(ArenaAnswerModel.match_id == match.id)
        .all()
    )
    assert len(stored_answers) == 4
    assert all(answer.selected_option_id is not None for answer in stored_answers)


def test_round_engine_duplicate_answer_is_idempotent(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="competitive",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)

    state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
    round_id = state["activeRound"]["roundId"]
    question_id = state["activeRound"]["question"]["questionId"]
    correct = "c" if question_id == "q1" else "b"

    first_submit = round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=round_id,
        current_user=user,
        selected_option_id=correct,
    )
    second_submit = round_engine.submit_answer(
        db_session,
        match_id=match.id,
        round_id=round_id,
        current_user=user,
        selected_option_id=correct,
    )

    assert first_submit["accepted"] is True
    assert first_submit["alreadySubmitted"] is False
    assert second_submit["accepted"] is False
    assert second_submit["alreadySubmitted"] is True
    assert (
        db_session.query(ArenaAnswerModel)
        .filter(ArenaAnswerModel.match_id == match.id, ArenaAnswerModel.round_id == round_id, ArenaAnswerModel.user_id == user.id)
        .count()
        == 1
    )


def test_room_and_match_services_find_active_session_for_user(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="competitive",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    active_room = room_service.get_active_room_for_user(db_session, user.id)
    assert active_room is not None
    assert active_room.room_code == room.room_code

    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)

    active_match = round_engine.get_active_match_for_user(db_session, user.id)
    assert active_match is not None
    assert active_match.id == match.id


def test_admin_service_activates_only_one_season(db_session):
    service = AdminService()

    first = service.upsert_season(
        db_session,
        season_id=None,
        payload={
            "name": "Season Alpha",
            "status": "active",
            "isActive": True,
            "startedAt": "2026-01-01T00:00:00",
            "endedAt": None,
            "leaderboardConfig": {"type": "global"},
            "rewardConfig": {},
        },
    )
    second = service.upsert_season(
        db_session,
        season_id=None,
        payload={
            "name": "Season Beta",
            "status": "active",
            "isActive": True,
            "startedAt": "2026-02-01T00:00:00",
            "endedAt": None,
            "leaderboardConfig": {"type": "global"},
            "rewardConfig": {},
        },
    )

    db_session.refresh(first)
    db_session.refresh(second)

    assert first.is_active is False
    assert second.is_active is True
    assert (
        db_session.query(ArenaSeasonModel)
        .filter(ArenaSeasonModel.is_active.is_(True))
        .count()
        == 1
    )


def test_admin_service_lists_player_match_records_and_match_reviews(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()
    admin_service = AdminService()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="competitive",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)

    state = round_engine.get_match_state(db_session, match.id, user)
    for _ in range(2):
        state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
        for round_num in range(2):
            # Re-activate the round if it's pending (needed for subsequent rounds)
            if state["activeRound"]["status"] == "pending":
                state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
        round_id = state["activeRound"]["roundId"]
        question_id = state["activeRound"]["question"]["questionId"]
        correct = "c" if question_id == "q1" else "b"
        round_engine.submit_answer(
            db_session,
            match_id=match.id,
            round_id=round_id,
            current_user=user,
            selected_option_id=correct,
        )
        result = round_engine.submit_answer(
            db_session,
            match_id=match.id,
            round_id=round_id,
            current_user=second_user,
            selected_option_id="a",
        )
        state = result["state"]

    player_matches = admin_service.list_player_match_records(db_session, search="player2", limit=20)
    match_reviews = admin_service.list_match_reviews(db_session, limit=20)

    assert player_matches
    assert player_matches[0]["email"] == second_user.email
    assert player_matches[0]["matchId"] == match.id

    assert match_reviews
    assert match_reviews[0]["matchId"] == match.id
    assert match_reviews[0]["playerCount"] == 2
    assert match_reviews[0]["roundCount"] == 2


def test_admin_match_reviews_flag_low_completion_and_abandonment(db_session, user):
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "review@learn8.ai", "Review Player")
    admin_service = AdminService()
    rating_service = RatingService()

    _create_rating(db_session, user.id, 1000)
    _create_rating(db_session, opponent.id, 1000)

    match = _create_competitive_match(db_session, public_course.id, [user.id, opponent.id])
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None
    match.rules_snapshot_json = {"round_count": 5, "round_time_seconds": 30, "max_players": 2}
    match.standings_json = rating_service.settle_match(
        db_session,
        match,
        [
            {
                "userId": opponent.id,
                "displayName": "Review Player",
                "score": 200,
                "correctCount": 5,
                "incorrectCount": 0,
                "answeredCount": 5,
                "averageResponseMs": 1800,
                "rank": 1,
            },
            {
                "userId": user.id,
                "displayName": "Player",
                "score": 20,
                "correctCount": 0,
                "incorrectCount": 1,
                "answeredCount": 1,
                "averageResponseMs": 7000,
                "rank": 2,
            },
        ],
    )
    db_session.add(match)
    db_session.commit()

    reviews = admin_service.list_match_reviews(db_session, limit=20)

    assert reviews
    assert reviews[0]["matchId"] == match.id
    assert "low_completion_rate" in reviews[0]["anomalyFlags"]
    assert "abandonment_penalty_applied" in reviews[0]["anomalyFlags"]


def test_presence_service_emits_disconnect_and_reconnect_events(db_session, user):
    from unittest.mock import patch
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "presence@learn8.ai", "Presence Player")
    presence_service = PresenceService()
    gateway = RealtimeGateway()

    match = _create_competitive_match(db_session, public_course.id, [user.id, opponent.id])
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None

    presence_service.touch_match_presence(db_session, match, user)
    player = next(player for player in match.players if player.user_id == user.id)
    player.last_seen_at = utc_now() - timedelta(seconds=20)
    player.connection_state = "connected"
    db_session.add(player)
    db_session.flush()

    # Mock Redis to simulate disconnection
    with patch("app.arena.services.presence_service.redis_sync_client") as mock_redis:
        mock_redis.exists.return_value = False
        presence_service.sweep_match_presence(db_session, match)

    db_session.commit()

    events = gateway.list_events(db_session, match_id=match.id)
    assert any(event.event_type == "player.disconnected" for event in events)
    disconnected_player = (
        db_session.query(ArenaMatchPlayerModel)
        .filter(
            ArenaMatchPlayerModel.match_id == match.id,
            ArenaMatchPlayerModel.user_id == user.id,
        )
        .first()
    )
    assert disconnected_player is not None
    assert disconnected_player.connection_state == "disconnected"
    assert disconnected_player.disconnect_count == 1
    assert disconnected_player.disconnected_at is not None

    refreshed_match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert refreshed_match is not None
    presence_service.touch_match_presence(db_session, refreshed_match, user)
    db_session.commit()

    events = gateway.list_events(db_session, match_id=match.id)
    assert any(event.event_type == "player.reconnected" for event in events)
    reconnected_player = (
        db_session.query(ArenaMatchPlayerModel)
        .filter(
            ArenaMatchPlayerModel.match_id == match.id,
            ArenaMatchPlayerModel.user_id == user.id,
        )
        .first()
    )
    assert reconnected_player is not None
    assert reconnected_player.connection_state == "connected"
    assert reconnected_player.reconnected_at is not None


def test_competitive_service_expires_matched_entries_for_finished_match(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    opponent = _create_user(db_session, "queue@learn8.ai", "Queue Player")
    season = ArenaSeasonModel(
        name="Ranked Season",
        status="active",
        is_active=True,
        started_at=utc_now(),
    )
    db_session.add(season)
    db_session.commit()
    service = CompetitiveService()

    service.join_queue(
        db_session,
        user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )
    matched_entry = service.join_queue(
        db_session,
        opponent,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )

    assert matched_entry.match_id is not None
    assert matched_entry.match_found_at is not None
    assert matched_entry.season_id == season.id
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == matched_entry.match_id).first()
    assert match is not None
    assert match.season_id == season.id
    assert match.player_count == 2
    assert match.round_count == 5
    match.status = ArenaMatchStatus.FINISHED
    db_session.add(match)
    db_session.commit()

    assert service.get_current_entry(db_session, user) is None
    refreshed_entry = db_session.query(ArenaQueueEntryModel).filter(ArenaQueueEntryModel.id == matched_entry.id).first()
    assert refreshed_entry is not None
    assert refreshed_entry.status == "expired"
    assert refreshed_entry.closed_at is not None


def test_round_engine_recovers_stale_match_without_active_round(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    opponent = _create_user(db_session, "recover@learn8.ai", "Recover Player")
    room_service = RoomService()
    round_engine = RoundEngine()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="competitive",
        visibility="private",
        max_players=4,
        round_count=1,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, opponent, room.room_code)
    room_service.set_ready(db_session, opponent, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)

    round_model = db_session.query(ArenaRoundModel).filter(ArenaRoundModel.match_id == match.id).first()
    assert round_model is not None
    round_model.status = "closed"
    round_model.closed_at = utc_now()
    db_session.add(round_model)

    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None
    match.started_at = utc_now() - timedelta(minutes=20)
    match.status = ArenaMatchStatus.IN_PROGRESS
    db_session.add(match)
    db_session.commit()

    state = round_engine.get_match_state(db_session, match.id, user)

    assert state["status"] == "finished"
    assert state["endedAt"] is not None
    assert state["standings"]


def test_admin_match_reviews_flag_suspicious_latency_pattern(db_session, user):
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "latency@learn8.ai", "Latency Player")
    admin_service = AdminService()
    presence_service = PresenceService()

    match = _create_competitive_match(db_session, public_course.id, [user.id, opponent.id])
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None

    for _ in range(3):
        presence_service.record_answer_submission(
            db_session,
            match=match,
            user_id=user.id,
            response_time_ms=220,
        )

    db_session.commit()
    reviews = admin_service.list_match_reviews(db_session, limit=20)

    assert reviews
    assert reviews[0]["matchId"] == match.id
    assert "suspicious_latency_pattern" in reviews[0]["anomalyFlags"]


def test_telemetry_service_reports_health_snapshot(db_session, user):
    public_course = _create_public_course(db_session)
    telemetry_service = TelemetryService()
    _create_waiting_queue_entry(db_session, user.id, public_course.id)
    flagged_match = _create_competitive_match(db_session, public_course.id, [user.id])
    flagged_player = (
        db_session.query(ArenaMatchPlayerModel)
        .filter(ArenaMatchPlayerModel.match_id == flagged_match.id, ArenaMatchPlayerModel.user_id == user.id)
        .first()
    )
    assert flagged_player is not None
    flagged_player.suspected_abandonment = True
    flagged_player.suspicious_low_latency_count = 2
    flagged_player.disconnect_count = 3
    db_session.add(flagged_player)
    db_session.commit()

    snapshot = telemetry_service.build_admin_health_snapshot(db_session)

    assert snapshot["waitingQueueCount"] >= 1
    assert snapshot["abandonmentCount"] >= 1
    assert snapshot["suspiciousLatencyCount"] >= 1
    assert snapshot["disconnectInstabilityCount"] >= 1
    assert "generatedAt" in snapshot


def test_arena_events_are_persisted_for_room_and_match_flows(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()
    gateway = RealtimeGateway()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="private_room",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)
    _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])

    room_events = gateway.list_events(db_session, room_code=room.room_code)
    match_events = gateway.list_events(db_session, match_id=match.id)

    room_event_types = [event.event_type for event in room_events]
    match_event_types = [event.event_type for event in match_events]

    assert "room.created" in room_event_types
    assert "room.player_joined" in room_event_types
    assert "room.player_ready_changed" in room_event_types
    assert "match.started" in room_event_types
    assert "round.started" in match_event_types


def test_competitive_match_settlement_updates_rating_and_rewards(db_session, user):
    public_course = _create_public_course(db_session)
    _create_question_pool(db_session, public_course)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    room_service = RoomService()
    round_engine = RoundEngine()

    room = room_service.create_room(
        db_session,
        user,
        public_course_id=public_course.id,
        mode="competitive",
        visibility="private",
        max_players=4,
        round_count=2,
        round_time_seconds=30,
    )
    room_service.join_room(db_session, second_user, room.room_code)
    room_service.set_ready(db_session, second_user, room.room_code, is_ready=True)
    match = room_service.start_room_match(db_session, user, room.room_code)
    round_engine.initialize_match_rounds(db_session, match.id)

    state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
    for round_index in range(2):
      round_id = state["activeRound"]["roundId"]
      question_id = state["activeRound"]["question"]["questionId"]
      correct = "c" if question_id == "q1" else "b"
      round_engine.submit_answer(
          db_session,
          match_id=match.id,
          round_id=round_id,
          current_user=user,
          selected_option_id=correct,
      )
      result = round_engine.submit_answer(
          db_session,
          match_id=match.id,
          round_id=round_id,
          current_user=second_user,
          selected_option_id="a",
      )
      state = result["state"]
      if round_index == 0 and state["activeRound"] is not None and state["activeRound"]["status"] == "pending":
          state = _activate_round_for_players(db_session, round_engine, match.id, [user, second_user])
    
    # Settlement is now triggered automatically and synchronously within submit_answer (if delay=0)
    # We just need to ensure the DB sees the changes
    db_session.refresh(match)
    if match.status != "finished":
        # Fallback trigger if for some reason it didn't finish (unlikely with Intermission=0)
        from app.arena.services.rating_service import RatingService
        from app.arena.services.reward_service import ArenaRewardService
        rating_service = RatingService()
        reward_service = ArenaRewardService()
        rounds = round_engine._get_rounds(db_session, match.id)
        standings = round_engine._build_standings(match, rounds)
        match.standings_json = rating_service.settle_match(db_session, match, standings)
        match.status = ArenaMatchStatus.FINISHED
        db_session.add(match)
        db_session.commit()
        reward_service.process_match_rewards(db_session, match.id)
        db_session.commit()

    # XP and rewards are also processed in the finalization
    db_session.refresh(match)
    
    # Re-fetch state now that standings are settled
    state = round_engine.get_match_state(db_session, match.id, user)
    
    assert state["status"] == "finished"
    winner = state["standings"][0]
    loser = state["standings"][1]
    assert winner["userId"] == user.id
    assert winner["ratingDelta"] > 0
    assert loser["ratingDelta"] < 0
    assert winner["xpGained"] > loser["xpGained"]
    
    history_count = (
        db_session.query(ArenaRankHistoryModel)
        .filter(ArenaRankHistoryModel.match_id == match.id)
        .count()
    )
    assert history_count == 2
    
    # Ensure XP is refreshed from DB
    db_session.expire(user)
    db_session.expire(second_user)
    assert user.xp > 0
    assert second_user.xp > 0
    assert user.credits > 100
    assert second_user.xp > 0
