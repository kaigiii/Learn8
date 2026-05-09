from app.services.domain.user.ledger import (
    LedgerEventType,
    apply_user_ledger_event,
)


def test_apply_user_ledger_event_is_idempotent(db_session, user):
    first = apply_user_ledger_event(
        db_session,
        user.id,
        LedgerEventType.CREDITS_SPEND,
        credits_delta=-10,
        event_key="test:spend:1",
        metadata={"source": "test"},
    )
    db_session.commit()

    second = apply_user_ledger_event(
        db_session,
        user.id,
        LedgerEventType.CREDITS_SPEND,
        credits_delta=-10,
        event_key="test:spend:1",
        metadata={"source": "test"},
    )
    db_session.commit()

    assert first.applied is True
    assert second.applied is False
    assert first.event.id == second.event.id

    db_session.refresh(user)
    assert user.credits == 90


def test_apply_user_ledger_event_awards_xp_once(db_session, user):
    result = apply_user_ledger_event(
        db_session,
        user.id,
        LedgerEventType.LESSON_COMPLETION_REWARD,
        xp_delta=45,
        event_key="test:reward:1",
        metadata={"source": "lesson_completion"},
    )
    db_session.commit()
    db_session.refresh(user)

    assert result.applied is True
    assert user.level == 1
    assert user.xp == 45
    assert user.xp_to_next_level == 100
