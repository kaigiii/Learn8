from __future__ import annotations

from sqlalchemy.orm import Session

from app.arena.domain.arena_modes import RANKED_ARENA_MODES
from app.arena.domain.arena_ranks import resolve_arena_rank_tier
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_rating import (
    ArenaPlayerTopicRatingModel,
    ArenaRankHistoryModel,
    ArenaRatingModel,
)
from app.arena.models.arena_season import ArenaSeasonModel
from app.models.user import UserModel
from app.arena.services.rank_service import RankService


class RatingService:
    BASE_RATING_K = 28
    MULTI_PLAYER_K_BONUS = 4
    MAX_RATING_K = 44
    ABANDONMENT_COMPLETION_THRESHOLD = 0.6
    ABANDONMENT_MAX_PENALTY = 18

    def __init__(self, rank_service: RankService | None = None):
        self.rank_service = rank_service or RankService()

    def settle_match(self, db: Session, match: ArenaMatchModel, standings: list[dict]) -> list[dict]:
        if not standings:
            return standings

        active_season = self.rank_service.get_active_season(db)
        ranked_mode = match.mode in RANKED_ARENA_MODES
        players_by_user_id = {player.user_id: player for player in match.players}
        pre_match_ratings = {
            user_id: self.rank_service.ensure_player_rating(db, user_id).rating
            for user_id in players_by_user_id.keys()
        }
        users = {
            user.id: user
            for user in db.query(UserModel).filter(UserModel.id.in_(list(players_by_user_id.keys()))).all()
        }
        total_rounds = self._get_total_rounds(match)

        for row in standings:
            user_id = int(row["userId"])
            arena_rating = self.rank_service.ensure_player_rating(db, user_id)
            match_player = players_by_user_id[user_id]
            user = users[user_id]

            placement = int(row["rank"])
            rating_before = int(arena_rating.rating)
            rank_tier_before = arena_rating.rank_tier
            expected_performance = self._compute_expected_performance(
                player_rating=rating_before,
                opponent_ratings=[
                    rating
                    for opponent_user_id, rating in pre_match_ratings.items()
                    if opponent_user_id != user_id
                ],
            )
            completion_ratio = self._compute_completion_ratio(
                answered_count=int(row.get("answeredCount", 0)),
                total_rounds=total_rounds,
            )
            abandonment_penalty = self._compute_abandonment_penalty(
                completion_ratio=completion_ratio,
                ranked_mode=ranked_mode,
            )
            rating_delta = self._compute_rating_delta(
                placement=placement,
                player_count=len(standings),
                ranked_mode=ranked_mode,
                expected_performance=expected_performance,
                abandonment_penalty=abandonment_penalty,
            )
            if placement == 1:
                rating_delta *= 2
            if ranked_mode:
                arena_rating.rating = max(0, arena_rating.rating + rating_delta)
                arena_rating.ranked_matches += 1
                if placement == 1:
                    arena_rating.wins += 1
                elif placement == len(standings):
                    arena_rating.losses += 1
                else:
                    arena_rating.draws += 1
                arena_rating.rank_tier = resolve_arena_rank_tier(arena_rating.rating)
                best_rank = self._pick_best_rank(arena_rating.best_rank_tier, arena_rating.rank_tier)
                arena_rating.best_rank_tier = best_rank
                db.add(arena_rating)

                topic_rating = self._ensure_topic_rating(db, user_id, match.public_course_id)
                topic_rating.rating = max(0, topic_rating.rating + rating_delta)
                topic_rating.rank_tier = resolve_arena_rank_tier(topic_rating.rating)
                db.add(topic_rating)

                db.add(
                    ArenaRankHistoryModel(
                        user_id=user_id,
                        season_id=active_season.id if active_season else None,
                        match_id=match.id,
                        rating_before=rating_before,
                        rating_after=arena_rating.rating,
                        rating_delta=rating_delta,
                        rank_tier_before=rank_tier_before,
                        rank_tier_after=arena_rating.rank_tier,
                    )
                )
            else:
                arena_rating.rank_tier = resolve_arena_rank_tier(arena_rating.rating)
                db.add(arena_rating)

            xp_reward = self._compute_xp_reward(placement, len(standings))
            credits_reward = self._compute_credit_reward(placement, len(standings))
            display_score = int(row["score"])
            accuracy = (
                round((int(row["correctCount"]) / max(int(row["answeredCount"]), 1)) * 100)
                if int(row["answeredCount"]) > 0
                else 0
            )
            metadata = {
                "xp_gained": xp_reward,
                "credits_gained": credits_reward,
                "rating_before": rating_before,
                "rating_after": arena_rating.rating,
                "rank_tier_before": rank_tier_before,
                "rank_tier_after": arena_rating.rank_tier,
                "ranked_mode": ranked_mode,
                "expected_performance": round(expected_performance, 4),
                "completion_ratio": round(completion_ratio, 4),
                "abandonment_penalty": abandonment_penalty,
            }

            match_player.final_rank = placement
            match_player.score = display_score
            match_player.correct_count = int(row["correctCount"])
            match_player.incorrect_count = int(row["incorrectCount"])
            match_player.avg_response_ms = row.get("averageResponseMs")
            match_player.rating_delta = rating_delta
            match_player.metadata_json = metadata
            db.add(match_player)

            row["score"] = display_score
            row["accuracy"] = accuracy
            row["xpGained"] = metadata["xp_gained"]
            row["creditsGained"] = metadata["credits_gained"]
            row["ratingDelta"] = rating_delta
            row["ratingBefore"] = rating_before
            row["ratingAfter"] = arena_rating.rating
            row["rankTierBefore"] = rank_tier_before
            row["rankTierAfter"] = arena_rating.rank_tier
            row["completionRatio"] = round(completion_ratio, 4)
            row["abandonmentPenalty"] = abandonment_penalty

        return standings

    def _ensure_topic_rating(
        self,
        db: Session,
        user_id: int,
        public_course_id: int,
    ) -> ArenaPlayerTopicRatingModel:
        topic_rating = (
            db.query(ArenaPlayerTopicRatingModel)
            .filter(
                ArenaPlayerTopicRatingModel.user_id == user_id,
                ArenaPlayerTopicRatingModel.public_course_id == public_course_id,
            )
            .first()
        )
        if topic_rating:
            return topic_rating

        from sqlalchemy.exc import IntegrityError

        try:
            with db.begin_nested():
                topic_rating = ArenaPlayerTopicRatingModel(
                    user_id=user_id,
                    public_course_id=public_course_id,
                    rating=1000,
                    rank_tier=resolve_arena_rank_tier(1000),
                )
                db.add(topic_rating)
                db.flush()
        except IntegrityError:
            # Another process might have inserted it simultaneously
            topic_rating = (
                db.query(ArenaPlayerTopicRatingModel)
                .filter(
                    ArenaPlayerTopicRatingModel.user_id == user_id,
                    ArenaPlayerTopicRatingModel.public_course_id == public_course_id,
                )
                .first()
            )

        return topic_rating

    def _compute_rating_delta(
        self,
        *,
        placement: int,
        player_count: int,
        ranked_mode: bool,
        expected_performance: float,
        abandonment_penalty: int,
    ) -> int:
        if not ranked_mode:
            return 0

        if player_count <= 1:
            return 0

        actual_performance = (player_count - placement) / (player_count - 1)
        k_factor = min(
            self.BASE_RATING_K + max(0, player_count - 2) * self.MULTI_PLAYER_K_BONUS,
            self.MAX_RATING_K,
        )
        skill_delta = round((actual_performance - expected_performance) * k_factor)
        return skill_delta - abandonment_penalty

    def _compute_expected_performance(
        self,
        *,
        player_rating: int,
        opponent_ratings: list[int],
    ) -> float:
        if not opponent_ratings:
            return 0.5

        average_opponent_rating = sum(opponent_ratings) / len(opponent_ratings)
        return 1 / (1 + 10 ** ((average_opponent_rating - player_rating) / 400))

    def _compute_completion_ratio(self, *, answered_count: int, total_rounds: int) -> float:
        if total_rounds <= 0:
            return 1.0
        return max(0.0, min(1.0, answered_count / total_rounds))

    def _compute_abandonment_penalty(self, *, completion_ratio: float, ranked_mode: bool) -> int:
        if not ranked_mode or completion_ratio >= self.ABANDONMENT_COMPLETION_THRESHOLD:
            return 0

        shortfall = self.ABANDONMENT_COMPLETION_THRESHOLD - completion_ratio
        return min(
            self.ABANDONMENT_MAX_PENALTY,
            max(6, round(shortfall * 30)),
        )

    def _get_total_rounds(self, match: ArenaMatchModel) -> int:
        if isinstance(match.round_count, int) and match.round_count > 0:
            return match.round_count

        rules = match.rules_snapshot_json if isinstance(match.rules_snapshot_json, dict) else {}
        round_count = rules.get("round_count")
        if isinstance(round_count, int) and round_count > 0:
            return round_count
        return 0

    def _compute_xp_reward(self, placement: int, player_count: int) -> int:
        base = 20
        podium_bonus = max(0, (player_count - placement) * 8)
        return base + podium_bonus

    def _compute_credit_reward(self, placement: int, player_count: int) -> int:
        if placement == 1:
            return max(5, player_count * 2)
        if placement <= max(2, player_count // 2):
            return 2
        return 0

    def _pick_best_rank(self, previous: str, current: str) -> str:
        order = {
            "Bronze": 0,
            "Silver": 1,
            "Gold": 2,
            "Platinum": 3,
            "Diamond": 4,
            "Master": 5,
            "Grandmaster": 6,
        }
        return current if order.get(current, 0) >= order.get(previous, 0) else previous
