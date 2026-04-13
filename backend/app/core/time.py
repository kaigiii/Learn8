from datetime import UTC, datetime
from typing import Optional

def utc_now() -> datetime:
    """Returns a timezone-aware UTC datetime object."""
    return datetime.now(UTC)

def to_iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """Formats a datetime to a strict ISO 8601 UTC string ending in Z."""
    if dt is None:
        return None
    # Ensure it's in UTC, then make naive for isoformat() to avoid offset suffix, then add Z
    return dt.astimezone(UTC).replace(tzinfo=None).isoformat() + "Z"
