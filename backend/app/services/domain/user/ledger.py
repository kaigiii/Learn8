from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import UserModel
from app.models.user_ledger_event import UserLedgerEventModel
from app.services.domain.user.progress import award_user_xp, ensure_user_progress_fields


class LedgerEventType:
    CREDITS_TOP_UP = "credits_top_up"
    CREDITS_SPEND = "credits_spend"
    LESSON_COMPLETION_REWARD = "lesson_completion_reward"
    ARENA_MATCH_REWARD = "arena_match_reward"


@dataclass(slots=True)
class LedgerApplyResult:
    user: UserModel
    event: UserLedgerEventModel
    applied: bool


def build_user_event_key(scope: str, reference_id: str | int) -> str:
    return f"{scope}:{reference_id}"


def apply_user_ledger_event(
    db: Session,
    user_id: int,
    event_type: str,
    *,
    credits_delta: int = 0,
    xp_delta: int = 0,
    event_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> LedgerApplyResult:
    normalized_credits_delta = int(credits_delta or 0)
    normalized_xp_delta = max(int(xp_delta or 0), 0)

    locked_user = (
        db.query(UserModel).filter(UserModel.id == user_id).with_for_update().first()
    )
    if not locked_user:
        raise ValueError("User not found.")

    ensure_user_progress_fields(locked_user)

    existing_event = None
    if event_key:
        existing_event = (
            db.query(UserLedgerEventModel)
            .filter(UserLedgerEventModel.event_key == event_key)
            .first()
        )
        if existing_event:
            return LedgerApplyResult(user=locked_user, event=existing_event, applied=False)

    nested = db.begin_nested()
    try:
        with nested:
            next_credits = int(locked_user.credits or 0) + normalized_credits_delta
            if next_credits < 0:
                raise ValueError("Insufficient credits.")

            locked_user.credits = next_credits
            granted_xp = award_user_xp(locked_user, normalized_xp_delta)

            event = UserLedgerEventModel(
                user_id=locked_user.id,
                event_type=event_type,
                event_key=event_key,
                credits_delta=normalized_credits_delta,
                xp_delta=granted_xp,
                credits_balance_after=int(locked_user.credits or 0),
                xp_balance_after=int(locked_user.xp or 0),
                level_after=int(locked_user.level or 1),
                metadata_json=metadata or None,
            )
            db.add(event)
            db.add(locked_user)
            db.flush()
    except IntegrityError:
        if not event_key:
            raise
        if db.in_transaction():
            db.expire_all()
        existing_event = (
            db.query(UserLedgerEventModel)
            .filter(UserLedgerEventModel.event_key == event_key)
            .first()
        )
        if not existing_event:
            raise
        locked_user = db.query(UserModel).filter(UserModel.id == user_id).first()
        return LedgerApplyResult(user=locked_user, event=existing_event, applied=False)

    return LedgerApplyResult(user=locked_user, event=event, applied=True)
