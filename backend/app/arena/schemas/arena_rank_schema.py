from typing import List, Optional

from pydantic import BaseModel


class ArenaLeaderboardEntry(BaseModel):
    userId: int
    displayName: str
    avatarUrl: Optional[str] = None
    rating: int
    rankTier: str
    wins: int
    losses: int
    rankedMatches: int
    seasonPlacement: Optional[int] = None
    seasonPercentile: Optional[float] = None
    seasonBadge: Optional[str] = None
    seasonTitle: Optional[str] = None


class ArenaLeaderboardResponse(BaseModel):
    items: List[ArenaLeaderboardEntry]


class ArenaRankHistoryEntry(BaseModel):
    matchId: Optional[int] = None
    seasonId: Optional[int] = None
    ratingBefore: int
    ratingAfter: int
    ratingDelta: int
    rankTierBefore: str
    rankTierAfter: str
    createdAt: str


class ArenaRankHistoryResponse(BaseModel):
    items: List[ArenaRankHistoryEntry]


class ArenaProfileTopicRating(BaseModel):
    publicCourseId: int
    title: str
    topic: str
    rating: int
    rankTier: str


class ArenaProfileResponse(BaseModel):
    userId: int
    displayName: str
    avatarUrl: Optional[str] = None
    rating: int
    rankTier: str
    bestRankTier: str
    wins: int
    losses: int
    draws: int
    rankedMatches: int
    winRate: float
    activeSeason: Optional[str] = None
    seasonPlacement: Optional[int] = None
    seasonPercentile: Optional[float] = None
    seasonBadge: Optional[str] = None
    seasonTitle: Optional[str] = None
    topicRatings: List[ArenaProfileTopicRating]
