from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.time import utc_now, to_iso_utc
from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaQueueStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_queue import ArenaQueueEntryModel


class TelemetryService:
    STALE_MATCH_SECONDS = 900

    def build_admin_health_snapshot(self, db: Session) -> dict:
        now = utc_now()
        waiting_count = (
            db.query(ArenaQueueEntryModel)
            .filter(ArenaQueueEntryModel.status == ArenaQueueStatus.WAITING)
            .count()
        )
        matched_count = (
            db.query(ArenaQueueEntryModel)
            .filter(ArenaQueueEntryModel.status == ArenaQueueStatus.MATCHED)
            .count()
        )
        in_progress_matches = (
            db.query(ArenaMatchModel)
            .filter(ArenaMatchModel.status == ArenaMatchStatus.IN_PROGRESS)
            .all()
        )
        stale_matches = [
            match
            for match in in_progress_matches
            if match.started_at and (now - match.started_at).total_seconds() > self.STALE_MATCH_SECONDS
        ]

        suspicious_player_rows = (
            db.query(ArenaMatchPlayerModel)
            .filter(
                (ArenaMatchPlayerModel.suspected_abandonment.is_(True))
                | (ArenaMatchPlayerModel.suspicious_low_latency_count > 0)
                | (ArenaMatchPlayerModel.disconnect_count >= 2)
            )
            .all()
        )

        abandonment_count = 0
        suspicious_latency_count = 0
        disconnect_instability_count = 0
        for row in suspicious_player_rows:
            if bool(row.suspected_abandonment):
                abandonment_count += 1
            if int(row.suspicious_low_latency_count or 0) > 0:
                suspicious_latency_count += 1
            if int(row.disconnect_count or 0) >= 2:
                disconnect_instability_count += 1

        alert_flags: list[str] = []
        if stale_matches:
            alert_flags.append("stale_matches_present")
        if waiting_count >= 8:
            alert_flags.append("queue_backlog")
        if suspicious_latency_count > 0:
            alert_flags.append("suspicious_latency_activity")
        if abandonment_count > 0:
            alert_flags.append("abandonment_activity")

        return {
            "waitingQueueCount": waiting_count,
            "matchedQueueCount": matched_count,
            "inProgressMatchCount": len(in_progress_matches),
            "staleMatchCount": len(stale_matches),
            "abandonmentCount": abandonment_count,
            "suspiciousLatencyCount": suspicious_latency_count,
            "disconnectInstabilityCount": disconnect_instability_count,
            "alertFlags": alert_flags,
            "generatedAt": to_iso_utc(now),
        }
