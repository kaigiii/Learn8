from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import UserModel
from app.models.user_ledger_event import UserLedgerEventModel
from app.services.commons.activity_logger import ActivityLogger
from app.services.commons.user_ledger import (
    LedgerApplyResult,
    LedgerEventType,
    apply_user_ledger_event,
    build_user_event_key,
)


def spend_user_credits(
    db: Session,
    user: UserModel,
    amount: int,
    *,
    reason: str,
    idempotency_scope: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
) -> LedgerApplyResult:
    event_key = (
        build_user_event_key(idempotency_scope, idempotency_key)
        if idempotency_scope and idempotency_key
        else None
    )
    result = apply_user_ledger_event(
        db,
        user.id,
        LedgerEventType.CREDITS_SPEND,
        credits_delta=-int(amount or 0),
        event_key=event_key,
        metadata=metadata or {"source": reason},
    )
    if result.applied:
        ActivityLogger.log_credits_deduct(
            result.user.id,
            result.user.email,
            abs(result.event.credits_delta),
            reason,
            result.user.credits,
        )
    return result


def top_up_user_credits(
    db: Session,
    user: UserModel,
    amount: int,
    *,
    reason: str,
    idempotency_scope: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
) -> LedgerApplyResult:
    event_key = (
        build_user_event_key(idempotency_scope, idempotency_key)
        if idempotency_scope and idempotency_key
        else None
    )
    result = apply_user_ledger_event(
        db,
        user.id,
        LedgerEventType.CREDITS_TOP_UP,
        credits_delta=int(amount or 0),
        event_key=event_key,
        metadata=metadata or {"source": reason},
    )
    if result.applied:
        ActivityLogger.log_credits_top_up(
            result.user.id,
            result.user.email,
            result.event.credits_delta,
            result.user.credits,
        )
    return result


def award_lesson_completion_xp(
    db: Session,
    user: UserModel,
    *,
    session_id: int,
    amount: int,
    course_id: int | None,
    node_id: str,
    active_phase: str,
    accuracy: int,
) -> LedgerApplyResult:
    result = apply_user_ledger_event(
        db,
        user.id,
        LedgerEventType.LESSON_COMPLETION_REWARD,
        xp_delta=int(amount or 0),
        event_key=build_user_event_key("lesson_session_reward", session_id),
        metadata={
            "source": "lesson_completion",
            "session_id": session_id,
            "course_id": course_id,
            "node_id": node_id,
            "active_phase": active_phase,
            "accuracy": accuracy,
        },
    )
    if result.applied:
        ActivityLogger.log_xp_award(
            result.user.id,
            result.user.email,
            result.event.xp_delta,
            "lesson_completion",
            result.user.xp,
            result.user.level,
        )
    return result


def list_user_ledger_events(
    db: Session,
    user_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
    event_type: str | None = None,
) -> tuple[list[UserLedgerEventModel], int]:
    query = db.query(UserLedgerEventModel).filter(UserLedgerEventModel.user_id == user_id)
    if event_type:
        query = query.filter(UserLedgerEventModel.event_type == event_type)

    total = query.count()
    items = (
        query.order_by(UserLedgerEventModel.created_at.desc(), UserLedgerEventModel.id.desc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 200))
        .all()
    )
    return items, total
