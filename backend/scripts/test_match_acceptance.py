import sys
from datetime import timedelta
from sqlalchemy import text
from app.db.session import SessionLocal
from app.services.arena.round_engine import RoundEngine
from app.core.time import utc_now
from app.models.user import UserModel
from app.models.public_course import PublicCourseModel
from app.models.course import CourseModel
from app.models.job import JobModel
from app.models.lesson import (
    LessonModel,
    LessonSessionModel,
    LessonStageModel,
    LessonSessionStageModel,
    LessonFailedStageModel,
    LessonRemedialModel,
)
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_round import ArenaRoundModel
from app.models.arena_event import ArenaEventModel
from app.models.arena_queue import ArenaQueueEntryModel
from app.models.arena_rating import ArenaRatingModel
from app.models.arena_season import ArenaSeasonModel
from app.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel, ArenaInviteModel
from app.models.password_reset import PasswordResetTokenModel
from app.models.user_ledger_event import UserLedgerEventModel
from app.models.course_media_asset import CourseMediaAssetModel
from app.models.lesson_generation_preference import LessonGenerationPreferenceModel
from app.domain.arena_statuses import ArenaMatchStatus
from app.domain.arena_modes import ArenaMode

def test_acceptance_flow():
    db = SessionLocal()
    engine = RoundEngine()
    try:
        # 1. Setup two test users
        users = db.query(UserModel).limit(2).all()
        if len(users) < 2:
            print("Need at least 2 users in DB")
            return

        u1, u2 = users[0], users[1]
        print(f"Testing with Users: {u1.id}, {u2.id}")

        # 2. Create a PENDING match
        match = ArenaMatchModel(
            public_course_id=1, # Assume 1 exists
            mode=ArenaMode.COMPETITIVE,
            status=ArenaMatchStatus.PENDING,
            player_count=2,
            round_count=5,
            deadline_at=utc_now() + timedelta(seconds=60),
            started_at=utc_now(),
        )
        db.add(match)
        db.flush()

        db.add_all([
            ArenaMatchPlayerModel(match_id=match.id, user_id=u1.id),
            ArenaMatchPlayerModel(match_id=match.id, user_id=u2.id)
        ])
        db.commit()
        db.refresh(match)
        
        match_id = match.id
        print(f"Created PENDING match: {match_id}")

        # 3. Confirm for user 1
        print(f"Confirming for user {u1.id}...")
        engine.confirm_match(db, match_id, u1)
        db.refresh(match)
        print(f"Match status after U1: {match.status}")
        assert match.status == ArenaMatchStatus.PENDING

        # 4. Confirm for user 2
        print(f"Confirming for user {u2.id}...")
        engine.confirm_match(db, match_id, u2)
        db.refresh(match)
        print(f"Match status after U2: {match.status}")
        assert match.status == ArenaMatchStatus.IN_PROGRESS

        # 5. Check rounds
        rounds_count = db.execute(text(f"SELECT count(*) FROM arena_rounds WHERE match_id={match_id}")).scalar()
        print(f"Rounds initialized: {rounds_count}")
        assert rounds_count > 0

        # 6. Test Timeout
        print("\nTesting Timeout Flow...")
        match_timeout = ArenaMatchModel(
            public_course_id=1,
            mode=ArenaMode.COMPETITIVE,
            status=ArenaMatchStatus.PENDING,
            player_count=2,
            round_count=5,
            deadline_at=utc_now() - timedelta(seconds=10), # Expired
            started_at=utc_now() - timedelta(seconds=70),
        )
        db.add(match_timeout)
        db.commit()
        db.refresh(match_timeout)
        
        print(f"Created expired PENDING match: {match_timeout.id}")
        swept = engine.sweep_stale_matches(db)
        db.refresh(match_timeout)
        print(f"Match status after sweep: {match_timeout.status}")
        assert match_timeout.status == ArenaMatchStatus.CANCELLED
        print(f"Total matches swept: {swept}")

        # 7. Test Decline Flow (Cancel via CompetitiveService)
        from app.services.arena.competitive_service import CompetitiveService
        from app.domain.arena_statuses import ArenaQueueStatus
        comp_service = CompetitiveService()
        
        print("\nTesting Decline Flow (Cancellation)...")
        match_decline = ArenaMatchModel(
            public_course_id=1,
            mode=ArenaMode.COMPETITIVE,
            status=ArenaMatchStatus.PENDING,
            player_count=2,
            round_count=5,
            deadline_at=utc_now() + timedelta(seconds=60),
            started_at=utc_now(),
        )
        db.add(match_decline)
        db.commit()
        db.refresh(match_decline)
        
        # Create a queue entry for U1 matched to this match
        entry = ArenaQueueEntryModel(
            user_id=u1.id,
            public_course_id=1,
            mode=ArenaMode.COMPETITIVE,
            status=ArenaQueueStatus.MATCHED,
            match_id=match_decline.id
        )
        db.add(entry)
        db.commit()
        
        print(f"Decline test: Cancelling entry for U1...")
        comp_service.cancel_current_entry(db, u1)
        db.refresh(match_decline)
        print(f"Match status after U1 decline: {match_decline.status}")
        assert match_decline.status == ArenaMatchStatus.CANCELLED

        print("\nVerification SUCCESSFUL!")

    finally:
        db.close()

if __name__ == "__main__":
    test_acceptance_flow()
