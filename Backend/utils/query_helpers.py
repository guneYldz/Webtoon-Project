from datetime import datetime, timezone
from typing import Optional

PG_INT32_MAX = 2147483647


def parse_pg_int(raw: Optional[str]) -> Optional[int]:
    """Parse a positive 32-bit PostgreSQL integer ID, returning None if invalid or out of range."""
    if raw is None:
        return None
    cleaned = raw.strip()
    if not cleaned.isdigit():
        return None
    val = int(cleaned)
    if val < 1 or val > PG_INT32_MAX:
        return None
    return val


def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize a naive-UTC or tz-aware datetime as a UTC ISO-8601 string ending in 'Z'."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")
