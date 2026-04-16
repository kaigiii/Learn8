from typing import List, Optional, Any

from pydantic import BaseModel, Field




class ArenaAdminPublicCourseResponse(BaseModel):
    id: int
    slug: str
    title: str
    topic: str
    description: Optional[str] = None
    isPublished: bool
    isFeatured: bool
    tags: List[str] = Field(default_factory=list)


class ArenaAdminQuestionPoolItemRequest(BaseModel):
    questionKey: str = Field(min_length=1, max_length=120)
    questionType: str = Field(default="MultipleChoice", min_length=1)
    prompt: str = Field(min_length=1)
    options: List[Any]
    correctOptionId: Optional[str] = None
    difficulty: str = "normal"
    knowledgeTags: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    sourceUnitId: Optional[str] = None
    sourceNodeId: Optional[str] = None
    isActive: bool = True


class ArenaAdminSyllabusQuestionResponse(BaseModel):
    unitId: str
    unitTitle: str
    nodeId: str
    nodeTitle: str
    questionKey: str
    questionType: str
    prompt: str
    options: List[Any]
    correctOptionId: Optional[str] = None
    difficulty: str = "normal"
    explanation: Optional[str] = None


class ArenaAdminQuestionPoolUpsertRequest(BaseModel):
    publicCourseId: int
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    isActive: bool = True
    version: int = 1
    items: List[ArenaAdminQuestionPoolItemRequest] = Field(default_factory=list)


class ArenaAdminQuestionPoolItemResponse(BaseModel):
    id: int
    questionKey: str
    questionType: str
    prompt: str
    options: List[Any]
    correctOptionId: Optional[str] = None
    difficulty: str
    knowledgeTags: List[str]
    explanation: Optional[str] = None
    sourceUnitId: Optional[str] = None
    sourceNodeId: Optional[str] = None
    isActive: bool


class ArenaAdminQuestionPoolResponse(BaseModel):
    id: int
    publicCourseId: int
    slug: str
    title: str
    description: Optional[str] = None
    isActive: bool
    version: int
    items: List[ArenaAdminQuestionPoolItemResponse] = Field(default_factory=list)


class ArenaAdminSeasonUpsertRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=80)
    isActive: bool = False
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    leaderboardConfig: dict = Field(default_factory=dict)
    rewardConfig: dict = Field(default_factory=dict)


class ArenaAdminSeasonResponse(BaseModel):
    id: int
    name: str
    status: str
    isActive: bool
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    leaderboardConfig: dict = Field(default_factory=dict)
    rewardConfig: dict = Field(default_factory=dict)


class ArenaAdminPlayerMatchRecordResponse(BaseModel):
    matchId: int
    userId: int
    displayName: str
    email: str
    publicCourseTitle: str
    mode: str
    status: str
    finalRank: Optional[int] = None
    score: int
    correctCount: int
    incorrectCount: int
    ratingDelta: int
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None


class ArenaAdminMatchReviewResponse(BaseModel):
    matchId: int
    publicCourseTitle: str
    mode: str
    status: str
    playerCount: int
    roundCount: int
    answerCount: int
    timedOutCount: int
    anomalyFlags: List[str] = Field(default_factory=list)
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None


class ArenaAdminHealthSnapshotResponse(BaseModel):
    waitingQueueCount: int
    matchedQueueCount: int
    inProgressMatchCount: int
    staleMatchCount: int
    abandonmentCount: int
    suspiciousLatencyCount: int
    disconnectInstabilityCount: int
    alertFlags: List[str] = Field(default_factory=list)
    generatedAt: str
