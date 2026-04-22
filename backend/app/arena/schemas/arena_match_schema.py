from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ArenaQuestionOption(BaseModel):
    id: str
    text: str


class ArenaQuestionView(BaseModel):
    questionId: str
    questionType: str = "MultipleChoice"
    prompt: str
    options: List[Any]
    difficulty: Optional[str] = None
    knowledgeTags: List[str] = Field(default_factory=list)


class ArenaStandingEntry(BaseModel):
    userId: int
    displayName: str
    score: int
    correctCount: int
    incorrectCount: int
    answeredCount: int
    averageResponseMs: Optional[int] = None
    rank: int
    accuracy: Optional[int] = None
    xpGained: Optional[int] = None
    creditsGained: Optional[int] = None
    ratingDelta: Optional[int] = None
    ratingBefore: Optional[int] = None
    ratingAfter: Optional[int] = None
    rankTierBefore: Optional[str] = None
    rankTierAfter: Optional[str] = None


class ArenaRoundStateResponse(BaseModel):
    roundId: int
    roundIndex: int
    status: str
    timerSeconds: int
    startedAt: Optional[str] = None
    deadlineAt: Optional[str] = None
    revealedAnswer: Optional[dict[str, Any]] = None
    question: ArenaQuestionView
    submittedPlayerIds: List[int] = Field(default_factory=list)
    hasSubmitted: bool = False


class ArenaPresenceStateResponse(BaseModel):
    userId: int
    displayName: Optional[str] = None
    avatarUrl: Optional[str] = None
    connectionState: str
    lastSeenAt: Optional[str] = None
    disconnectedAt: Optional[str] = None
    disconnectCount: int = 0
    suspectedAbandonment: bool = False
    isAccepted: bool = False


class ArenaMatchStateResponse(BaseModel):
    matchId: int
    roomCode: Optional[str] = None
    status: str
    mode: str
    publicCourseId: int
    publicCourseTitle: str
    totalRounds: int
    currentRoundIndex: int
    activeRound: Optional[ArenaRoundStateResponse] = None
    standings: List[ArenaStandingEntry] = Field(default_factory=list)
    currentPlayerResult: Optional[ArenaStandingEntry] = None
    presenceStates: List[ArenaPresenceStateResponse] = Field(default_factory=list)
    startedAt: Optional[str] = None
    deadlineAt: Optional[str] = None
    endedAt: Optional[str] = None


class ArenaAnswerSubmitRequest(BaseModel):
    roundId: int
    selectedOptionId: Optional[str] = None
    answerPayload: Optional[Any] = None


class ArenaAnswerSubmitResponse(BaseModel):
    accepted: bool
    alreadySubmitted: bool = False
    roundClosed: bool
    matchFinished: bool
    state: ArenaMatchStateResponse
