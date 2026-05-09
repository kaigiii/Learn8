from app.models.user import UserModel


def xp_for_level(level: int) -> int:
    return 100 + max(level - 1, 0) * 50


def ensure_user_progress_fields(user: UserModel) -> None:
    current_level = max(int(user.level or 1), 1)
    user.level = current_level
    user.xp = max(int(user.xp or 0), 0)
    user.xp_to_next_level = max(int(user.xp_to_next_level or 0), xp_for_level(current_level))


def award_user_xp(user: UserModel, amount: int) -> int:
    ensure_user_progress_fields(user)

    granted_xp = max(int(amount or 0), 0)
    if granted_xp == 0:
        return 0

    pending_xp = user.xp + granted_xp
    current_level = user.level
    xp_needed = xp_for_level(current_level)

    while pending_xp >= xp_needed:
        pending_xp -= xp_needed
        current_level += 1
        xp_needed = xp_for_level(current_level)

    user.level = current_level
    user.xp = pending_xp
    user.xp_to_next_level = xp_needed
    return granted_xp
