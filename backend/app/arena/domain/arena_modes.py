class ArenaMode:
    PRIVATE_ROOM = "private_room"
    COMPETITIVE = "competitive"
    LIVE_THEME = "live_theme"
    QUICK_MATCH = "quick_match"
    RANKED = "ranked"


COMPETITIVE_ARENA_MODE_ALIASES = (
    ArenaMode.COMPETITIVE,
    ArenaMode.LIVE_THEME,
    ArenaMode.QUICK_MATCH,
    ArenaMode.RANKED,
)


RANKED_ARENA_MODES = (
    *COMPETITIVE_ARENA_MODE_ALIASES,
)


def normalize_arena_mode(mode: str) -> str:
    if mode in COMPETITIVE_ARENA_MODE_ALIASES:
        return ArenaMode.COMPETITIVE
    return mode
