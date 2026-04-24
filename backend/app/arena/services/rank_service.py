from sqlalchemy.orm import Session
from app.core.time import to_iso_utc

from app.arena.domain.arena_modes import RANKED_ARENA_MODES
from app.arena.domain.arena_ranks import resolve_arena_rank_tier
from app.arena.models.arena_rating import ArenaPlayerTopicRatingModel, ArenaRankHistoryModel, ArenaRatingModel
from app.arena.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel


class RankService:
    def _resolve_display_name(self, user: UserModel) -> str:
        full_name = (user.full_name or "").strip()
        if full_name:
            return full_name
        email = user.email or ""
        if "@" in email:
            return email.split("@", 1)[0]
        if email:
            return email
        return f"User {user.id}"

    def _resolve_avatar_url(self, user: UserModel) -> str | None:
        avatar = getattr(user, "avatar_url", None)
        if avatar is None:
            return None
        avatar_text = str(avatar).strip()
        return avatar_text or None

    def ensure_player_rating(self, db: Session, user_id: int) -> ArenaRatingModel:
        rating = (
            db.query(ArenaRatingModel)
            .filter(ArenaRatingModel.user_id == user_id)
            .first()
        )
        if rating:
            return rating

        rating = ArenaRatingModel(
            user_id=user_id,
            rating=1000,
            rank_tier=resolve_arena_rank_tier(1000),
            best_rank_tier=resolve_arena_rank_tier(1000),
        )
        db.add(rating)
        db.commit()
        db.refresh(rating)
        return rating

    def get_active_season(self, db: Session) -> ArenaSeasonModel | None:
        return (
            db.query(ArenaSeasonModel)
            .filter(ArenaSeasonModel.is_active.is_(True))
            .order_by(ArenaSeasonModel.created_at.desc())
            .first()
        )

    def build_profile_payload(self, db: Session, user: UserModel) -> dict:
        rating = self.ensure_player_rating(db, user.id)
        active_season = self.get_active_season(db)
        season_summary = self._get_player_season_summary(db, user_id=user.id, season=active_season)

        topic_ratings = (
            db.query(ArenaPlayerTopicRatingModel, PublicCourseModel)
            .join(
                PublicCourseModel,
                PublicCourseModel.id == ArenaPlayerTopicRatingModel.public_course_id,
            )
            .filter(ArenaPlayerTopicRatingModel.user_id == user.id)
            .order_by(ArenaPlayerTopicRatingModel.rating.desc())
            .limit(10)
            .all()
        )

        total_decisions = rating.wins + rating.losses + rating.draws
        win_rate = round((rating.wins / total_decisions) * 100, 1) if total_decisions else 0.0

        return {
            "userId": user.id,
            "displayName": self._resolve_display_name(user),
            "avatarUrl": self._resolve_avatar_url(user),
            "rating": rating.rating,
            "rankTier": rating.rank_tier,
            "bestRankTier": rating.best_rank_tier,
            "wins": rating.wins,
            "losses": rating.losses,
            "draws": rating.draws,
            "rankedMatches": rating.ranked_matches,
            "winRate": win_rate,
            "activeSeason": active_season.name if active_season else None,
            "seasonPlacement": season_summary["seasonPlacement"] if season_summary else None,
            "seasonPercentile": season_summary["seasonPercentile"] if season_summary else None,
            "seasonBadge": season_summary["seasonBadge"] if season_summary else None,
            "seasonTitle": season_summary["seasonTitle"] if season_summary else None,
            "topicRatings": [
                {
                    "publicCourseId": public_course.id,
                    "title": public_course.title,
                    "topic": public_course.topic,
                    "rating": topic_rating.rating,
                    "rankTier": topic_rating.rank_tier,
                }
                for topic_rating, public_course in topic_ratings
            ],
        }

    def list_leaderboard(self, db: Session, limit: int = 50) -> list[dict]:
        rows = (
            db.query(ArenaRatingModel, UserModel)
            .join(UserModel, UserModel.id == ArenaRatingModel.user_id)
            .order_by(ArenaRatingModel.rating.desc(), ArenaRatingModel.updated_at.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "userId": user.id,
                "displayName": self._resolve_display_name(user),
                "avatarUrl": self._resolve_avatar_url(user),
                "rating": rating.rating,
                "rankTier": rating.rank_tier,
                "wins": rating.wins,
                "losses": rating.losses,
                "rankedMatches": rating.ranked_matches,
                "seasonPlacement": None,
                "seasonPercentile": None,
                "seasonBadge": None,
                "seasonTitle": None,
            }
            for rating, user in rows
        ]

    def list_season_leaderboard(
        self,
        db: Session,
        *,
        season_id: int | None,
        limit: int = 50,
    ) -> list[dict]:
        target_season = self.get_active_season(db) if season_id is None else db.query(ArenaSeasonModel).filter(ArenaSeasonModel.id == season_id).first()
        if not target_season:
            return self.list_leaderboard(db, limit)

        aggregates = self._build_season_aggregates(db, target_season.id)
        if not aggregates:
            return self.list_leaderboard(db, limit)

        items = list(aggregates.values())
        items.sort(key=lambda item: (-int(item["rating"]), item["displayName"]))
        total_entries = len(items)
        reward_config = target_season.reward_config_json if isinstance(target_season.reward_config_json, dict) else {}
        for index, item in enumerate(items, start=1):
            honor = self._resolve_season_honor(
                placement=index,
                total_entries=total_entries,
                reward_config=reward_config,
            )
            item["seasonPlacement"] = index
            item["seasonPercentile"] = honor["seasonPercentile"]
            item["seasonBadge"] = honor["seasonBadge"]
            item["seasonTitle"] = honor["seasonTitle"]
        return items[:limit]

    def list_rank_history(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int | None = None,
    ) -> list[dict]:
        query = (
            db.query(ArenaRankHistoryModel)
            .filter(ArenaRankHistoryModel.user_id == user_id)
            .order_by(ArenaRankHistoryModel.created_at.desc(), ArenaRankHistoryModel.id.desc())
        )
        if limit is not None:
            query = query.limit(min(max(limit, 1), 100))
        items = query.all()
        return [
            {
                "matchId": item.match_id,
                "seasonId": item.season_id,
                "ratingBefore": item.rating_before,
                "ratingAfter": item.rating_after,
                "ratingDelta": item.rating_delta,
                "rankTierBefore": item.rank_tier_before,
                "rankTierAfter": item.rank_tier_after,
                "createdAt": to_iso_utc(item.created_at),
            }
            for item in items
        ]

    def _build_season_aggregates(self, db: Session, season_id: int) -> dict[int, dict]:
        rows = (
            db.query(ArenaRankHistoryModel, UserModel)
            .join(UserModel, UserModel.id == ArenaRankHistoryModel.user_id)
            .filter(ArenaRankHistoryModel.season_id == season_id)
            .order_by(ArenaRankHistoryModel.created_at.asc())
            .all()
        )
        aggregates: dict[int, dict] = {}
        for history, user in rows:
            entry = aggregates.get(user.id)
            if entry is None:
                entry = {
                    "userId": user.id,
                    "displayName": self._resolve_display_name(user),
                    "avatarUrl": self._resolve_avatar_url(user),
                    "rating": history.rating_after,
                    "rankTier": history.rank_tier_after,
                    "wins": 0,
                    "losses": 0,
                    "rankedMatches": 0,
                }
                aggregates[user.id] = entry

            entry["rating"] = history.rating_after
            entry["rankTier"] = history.rank_tier_after
            entry["rankedMatches"] += 1
            if history.rating_delta > 0:
                entry["wins"] += 1
            elif history.rating_delta < 0:
                entry["losses"] += 1
        return aggregates

    def _get_player_season_summary(
        self,
        db: Session,
        *,
        user_id: int,
        season: ArenaSeasonModel | None,
    ) -> dict | None:
        if not season:
            return None
        aggregates = self._build_season_aggregates(db, season.id)
        if not aggregates or user_id not in aggregates:
            return None

        items = list(aggregates.values())
        items.sort(key=lambda item: (-int(item["rating"]), item["displayName"]))
        total_entries = len(items)
        reward_config = season.reward_config_json if isinstance(season.reward_config_json, dict) else {}
        for index, item in enumerate(items, start=1):
            if int(item["userId"]) != user_id:
                continue
            honor = self._resolve_season_honor(
                placement=index,
                total_entries=total_entries,
                reward_config=reward_config,
            )
            return {
                "seasonPlacement": index,
                "seasonPercentile": honor["seasonPercentile"],
                "seasonBadge": honor["seasonBadge"],
                "seasonTitle": honor["seasonTitle"],
            }
        return None

    def _resolve_season_honor(
        self,
        *,
        placement: int,
        total_entries: int,
        reward_config: dict,
    ) -> dict:
        percentile = 100.0 if total_entries <= 1 else round(((total_entries - placement + 1) / total_entries) * 100, 1)
        brackets = reward_config.get("honorBrackets")
        if not isinstance(brackets, list):
            brackets = [
                {"maxPlacement": 1, "title": "Season Champion", "badge": "Crown"},
                {"maxPlacement": 3, "title": "Podium Finisher", "badge": "Podium"},
                {"topPercent": 10, "title": "Elite Contender", "badge": "Elite"},
                {"topPercent": 25, "title": "Division Leader", "badge": "Star"},
            ]

        for bracket in brackets:
            if not isinstance(bracket, dict):
                continue
            max_placement = bracket.get("maxPlacement")
            top_percent = bracket.get("topPercent")
            if isinstance(max_placement, int) and placement <= max_placement:
                return {
                    "seasonPercentile": percentile,
                    "seasonBadge": bracket.get("badge"),
                    "seasonTitle": bracket.get("title"),
                }
            if isinstance(top_percent, (int, float)) and percentile >= float(top_percent):
                return {
                    "seasonPercentile": percentile,
                    "seasonBadge": bracket.get("badge"),
                    "seasonTitle": bracket.get("title"),
                }

        return {
            "seasonPercentile": percentile,
            "seasonBadge": None,
            "seasonTitle": None,
        }
