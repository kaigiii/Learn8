import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.time import utc_now
from app.arena.models.arena_match import ArenaMatchModel
from app.services.commons.user_economy import award_arena_match_reward
from app.models.user import UserModel

logger = logging.getLogger(__name__)

class ArenaRewardService:
    def process_match_rewards(self, db: Session, match_id: int) -> bool:
        """
        Processes rewards for all players in a match.
        Uses a row-level lock (FOR UPDATE) on the match to prevent parallel processing.
        """
        match = (
            db.query(ArenaMatchModel)
            .filter(ArenaMatchModel.id == match_id)
            .with_for_update(skip_locked=True)
            .first()
        )

        if not match:
            # Match is either missing or locked by another worker
            return False

        if match.status != "finished":
            logger.warning(f"Attempted to process rewards for non-finished match {match_id} (status={match.status})")
            return False

        if match.reward_awarded_at:
            # Already processed
            return False

        logger.info(f"Processing rewards for Arena Match {match_id}...")

        try:
            for player in match.players:
                # Extract reward information from metadata_json populated by RatingService
                metadata = player.metadata_json or {}
                xp_gained = metadata.get("xp_gained", 0)
                credits_gained = metadata.get("credits_gained", 0)

                if xp_gained <= 0 and credits_gained <= 0:
                    continue

                user = db.query(UserModel).filter(UserModel.id == player.user_id).first()
                if not user:
                    continue

                award_arena_match_reward(
                    db,
                    user,
                    match_id=match.id,
                    placement=player.final_rank or 0,
                    xp_amount=xp_gained,
                    credits_amount=credits_gained,
                    mode=match.mode,
                    public_course_id=match.public_course_id,
                )

            match.reward_awarded_at = utc_now()
            db.add(match)
            db.commit()
            logger.info(f"Successfully awarded rewards for Match {match_id}")
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process rewards for Match {match_id}: {e}")
            return False

    def sweep_pending_rewards(self, db: Session) -> int:
        """
        Finds finished matches that haven't been awarded and processes them.
        """
        pending_matches = (
            db.query(ArenaMatchModel.id)
            .filter(
                ArenaMatchModel.status == "finished",
                ArenaMatchModel.reward_awarded_at.is_(None)
            )
            .all()
        )

        count = 0
        for (match_id,) in pending_matches:
            if self.process_match_rewards(db, match_id):
                count += 1
        return count
