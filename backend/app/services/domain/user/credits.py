from app.models.user import UserModel


def has_sufficient_credits(user: UserModel, amount: int) -> bool:
    return int(user.credits or 0) >= max(int(amount or 0), 0)


def deduct_user_credits(user: UserModel, amount: int) -> int:
    normalized_amount = max(int(amount or 0), 0)
    if normalized_amount == 0:
        return 0

    if not has_sufficient_credits(user, normalized_amount):
        raise ValueError("Insufficient credits.")

    user.credits = int(user.credits or 0) - normalized_amount
    return normalized_amount


def top_up_user_credits(user: UserModel, amount: int) -> int:
    normalized_amount = max(int(amount or 0), 0)
    if normalized_amount == 0:
        return 0

    user.credits = int(user.credits or 0) + normalized_amount
    return normalized_amount
