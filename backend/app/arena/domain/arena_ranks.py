class ArenaRankTier:
    BRONZE = "Bronze"
    SILVER = "Silver"
    GOLD = "Gold"
    PLATINUM = "Platinum"
    DIAMOND = "Diamond"
    MASTER = "Master"
    GRANDMASTER = "Grandmaster"


ARENA_RANK_THRESHOLDS = (
    (0, ArenaRankTier.BRONZE),
    (1200, ArenaRankTier.SILVER),
    (1600, ArenaRankTier.GOLD),
    (2000, ArenaRankTier.PLATINUM),
    (2400, ArenaRankTier.DIAMOND),
    (2800, ArenaRankTier.MASTER),
    (3200, ArenaRankTier.GRANDMASTER),
)


def resolve_arena_rank_tier(rating: int) -> str:
    resolved = ArenaRankTier.BRONZE
    for threshold, tier in ARENA_RANK_THRESHOLDS:
        if rating >= threshold:
            resolved = tier
        else:
            break
    return resolved

