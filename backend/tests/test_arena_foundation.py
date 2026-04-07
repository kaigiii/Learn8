from datetime import timedelta

from fastapi import HTTPException

from app.core.time import utc_now_naive
from app.domain.arena_modes import ArenaMode
from app.domain.arena_statuses import ArenaMatchStatus
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.models.arena_queue import ArenaQueueEntryModel
from app.models.arena_round import ArenaAnswerModel, ArenaRoundModel
from app.models.arena_room import ArenaRoomPlayerModel
from app.models.arena_rating import ArenaRankHistoryModel, ArenaRatingModel
from app.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.services.arena.admin_service import AdminService
from app.services.arena.competitive_service import CompetitiveService
from app.services.arena.presence_service import PresenceService
from app.services.arena.rank_service import RankService
from app.services.arena.rating_service import RatingService
from app.services.arena.realtime_gateway import RealtimeGateway
from app.services.arena.round_engine import RoundEngine
from app.services.arena.telemetry_service import TelemetryService
from app.services.arena.room_service import RoomService


def _create_public_course(db_session):
    course = PublicCourseModel(
        slug="python-basics",
        title="Python Basics",
        topic="Python Basics",
        description="Official Arena topic for Python newcomers.",
        difficulty="beginner",
        is_published=True,
        is_arena_enabled=True,
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
    db_session.commit()
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
    db_session.commit()
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
        started_at=utc_now_naive(),
        ended_at=utc_now_naive(),
    )
    db_session.add(match)
    db_session.commit()
    db_session.refresh(match)

    db_session.add_all(
        [ArenaMatchPlayerModel(match_id=match.id, user_id=player_id) for player_id in player_ids]
    )
    db_session.commit()
    return match


def _create_waiting_queue_entry(db_session, user_id: int, public_course_id: int):
    entry = ArenaQueueEntryModel(
        user_id=user_id,
        public_course_id=public_course_id,
        mode=ArenaMode.COMPETITIVE,
        status="waiting",
        expires_at=utc_now_naive() + timedelta(minutes=3),
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


def test_room_service_create_join_ready_and_start_flow(db_session, user):
    public_course = _create_public_course(db_session)
    second_user = _create_user(db_session, "player2@learn8.ai", "Player Two")
    season = ArenaSeasonModel(
        name="Season One",
        status="active",
        is_active=True,
        started_at=utc_now_naive(),
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


def test_room_service_prevents_start_before_all_non_hosts_ready(db_session, user):
    public_course = _create_public_course(db_session)
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
    public_course = _create_public_course(db_session)
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


def test_competitive_service_avoids_immediate_rematches_when_possible(db_session, user):
    public_course = _create_public_course(db_session)
    repeat_user = _create_user(db_session, "repeat@learn8.ai", "Repeat Player")
    fresh_user = _create_user(db_session, "fresh@learn8.ai", "Fresh Player")
    service = CompetitiveService()

    _create_rating(db_session, user.id, 1000)
    _create_rating(db_session, repeat_user.id, 1010)
    _create_rating(db_session, fresh_user.id, 1020)
    _create_competitive_match(db_session, public_course.id, [user.id, repeat_user.id])

    _create_waiting_queue_entry(db_session, repeat_user.id, public_course.id)
    _create_waiting_queue_entry(db_session, fresh_user.id, public_course.id)

    challenger_entry = service.join_queue(
        db_session,
        user,
        public_course_id=public_course.id,
        round_count=5,
        round_time_seconds=30,
    )

    assert challenger_entry.status == "matched"
    assert challenger_entry.matched_user_id == fresh_user.id


def test_competitive_service_expands_rating_window_for_long_waiters(db_session, user):
    public_course = _create_public_course(db_session)
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
    veteran_entry.created_at = utc_now_naive() - timedelta(seconds=80)
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
    first_round_id = state["activeRound"]["roundId"]
    first_correct = state["activeRound"]["question"]["questionId"]

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
    second_round_id = second_submit["state"]["activeRound"]["roundId"]
    second_question_id = second_submit["state"]["activeRound"]["question"]["questionId"]

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

    assert final_submit["matchFinished"] is True
    assert final_submit["state"]["status"] == "finished"
    assert final_submit["state"]["activeRound"] is None
    assert final_submit["state"]["standings"][0]["userId"] == user.id
    assert final_submit["state"]["standings"][0]["score"] > final_submit["state"]["standings"][1]["score"]

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

    state = round_engine.get_match_state(db_session, match.id, user)
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
    public_course = _create_public_course(db_session)
    opponent = _create_user(db_session, "presence@learn8.ai", "Presence Player")
    presence_service = PresenceService()
    gateway = RealtimeGateway()

    match = _create_competitive_match(db_session, public_course.id, [user.id, opponent.id])
    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None

    presence_service.touch_match_presence(db_session, match, user)
    player = next(player for player in match.players if player.user_id == user.id)
    player.last_seen_at = utc_now_naive() - timedelta(seconds=20)
    player.connection_state = "connected"
    db_session.add(player)
    db_session.flush()

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
    opponent = _create_user(db_session, "queue@learn8.ai", "Queue Player")
    season = ArenaSeasonModel(
        name="Ranked Season",
        status="active",
        is_active=True,
        started_at=utc_now_naive(),
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
    round_model.closed_at = utc_now_naive()
    db_session.add(round_model)

    match = db_session.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
    assert match is not None
    match.started_at = utc_now_naive() - timedelta(minutes=20)
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

    state = round_engine.get_match_state(db_session, match.id, user)
    for _ in range(2):
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

    assert state["status"] == "finished"
    winner = state["standings"][0]
    loser = state["standings"][1]
    assert winner["userId"] == user.id
    assert winner["ratingDelta"] > 0
    assert loser["ratingDelta"] < 0
    assert winner["xpGained"] > loser["xpGained"]

    winner_rating = (
        db_session.query(ArenaRatingModel)
        .filter(ArenaRatingModel.user_id == user.id)
        .first()
    )
    loser_rating = (
        db_session.query(ArenaRatingModel)
        .filter(ArenaRatingModel.user_id == second_user.id)
        .first()
    )
    assert winner_rating is not None
    assert loser_rating is not None
    assert winner_rating.rating > 1000
    assert loser_rating.rating < 1000

    history_count = (
        db_session.query(ArenaRankHistoryModel)
        .filter(ArenaRankHistoryModel.match_id == match.id)
        .count()
    )
    assert history_count == 2

    db_session.refresh(user)
    db_session.refresh(second_user)
    assert user.xp > 0
    assert user.credits > 100
    assert second_user.xp > 0
