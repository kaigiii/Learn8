class ArenaRoomStatus:
    LOBBY = "lobby"
    IN_MATCH = "in_match"
    CLOSED = "closed"


class ArenaRoomVisibility:
    PRIVATE = "private"
    PUBLIC = "public"


class ArenaInviteStatus:
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ArenaQueueStatus:
    WAITING = "waiting"
    MATCHED = "matched"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ArenaMatchStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class ArenaRoundStatus:
    PENDING = "pending"
    ACTIVE = "active"
    CLOSED = "closed"
