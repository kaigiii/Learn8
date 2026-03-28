from typing import Any, Optional, List, Union
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# --- 列舉型別 (Enums) ---
class ModuleType(str, Enum):
    Instruction = "Instruction"
    Practice = "Practice"
    Assessment = "Assessment"
    Incentive = "Incentive"


class SkinType(str, Enum):
    Scientific = "Scientific"
    Classic = "Classic"
    Code = "Code"


class ValidationType(str, Enum):
    Exact = "exact"
    Regex = "regex"
    Logic = "logic"


def parse_data_field(v: Any) -> Any:
    # 輔助函式：處理 LLM 回傳的字串化 JSON
    if v is None:
        return {}
    if isinstance(v, str):
        try:
            import json

            return json.loads(v)
        except:
            return {}
    return v


# --- 設定模型 (Config Models) ---
class GenericConfig(BaseModel):
    initialState: dict = Field(default_factory=dict)
    data: Union[dict, list, str, Any] = Field(
        default_factory=dict
    )  # 為了遷移期間的相容性而放寬型別

    @field_validator("initialState", mode="before")
    @classmethod
    def validate_initial_state(cls, v: Any) -> dict:
        return v or {}

    @field_validator("data", mode="before")
    @classmethod
    def validate_data(cls, v: Any) -> Union[dict, list, str, Any]:
        return parse_data_field(v)


# --- 驗證與回饋 (Validation & Feedback) ---
class Validation(BaseModel):
    type: ValidationType
    condition: Optional[Any] = None


class Feedback(BaseModel):
    success: str
    error: str


# --- 階段模型 (Stage Models) ---
class LessonStage(BaseModel):
    stageId: str
    topic: str
    module: ModuleType
    skin: SkinType
    component: str  # 接受任意字串，透過 registry 驗證
    validation: Validation
    feedback: Feedback
    config: GenericConfig

    @field_validator("component")
    @classmethod
    def validate_component(cls, v: str) -> str:
        from app.core.component_loader import registry

        if v not in registry.get_component_names():
            raise ValueError(f"Unsupported component: {v}")
        return v


class SubmissionRequest(BaseModel):
    sessionId: int
    stageId: str
    userInput: Any
    context_topic: Optional[str] = None
    component: Optional[str] = None


class FailedStageRecord(BaseModel):
    failedStage: LessonStage
    userInput: Any


class LessonSessionStartRequest(BaseModel):
    courseId: int
    nodeId: str
    topic: str
    primaryStages: List[LessonStage]


class LessonSessionPayload(BaseModel):
    sessionId: int
    status: str
    activePhase: str
    rewardEligible: bool = True
    resumedSession: bool = False
    pendingFailedCount: int = 0
    primaryStages: List[LessonStage] = Field(default_factory=list)
    remedialStages: List[LessonStage] = Field(default_factory=list)
    activeStages: List[LessonStage] = Field(default_factory=list)
    remedialJobId: Optional[str] = None


class LessonSessionCompleteRequest(BaseModel):
    hintsUsed: int = 0


class LessonSessionSummaryPayload(BaseModel):
    sessionId: int
    courseId: Optional[int] = None
    nodeId: str
    status: str
    activePhase: str
    rewardEligible: bool = True
    totalStages: int
    attemptedCount: int
    correctCount: int
    incorrectCount: int
    skippedCount: int
    accuracy: int
    elapsedSeconds: int
    elapsedLabel: str
    xpGained: int


class RemedialGenerationRequest(BaseModel):
    topic: str
    courseId: Optional[int] = None
    nodeId: Optional[str] = None
    sessionId: Optional[int] = None
    failedStages: List[FailedStageRecord] = Field(default_factory=list)


class SubmissionResponse(BaseModel):
    nextAction: str
    result: str
    recordedFailure: bool = False
    evaluation: dict = Field(default_factory=dict)
    remedialStage: Optional[LessonStage] = None
    message: Optional[str] = None


class LessonAssistantMessage(BaseModel):
    role: str
    content: str


class LessonAssistantRequest(BaseModel):
    userQuestion: str
    sessionId: Optional[int] = None
    courseId: Optional[int] = None
    courseTopic: Optional[str] = None
    courseTitle: Optional[str] = None
    nodeId: Optional[str] = None
    nodeTitle: Optional[str] = None
    nodeDescription: Optional[str] = None
    activePhase: Optional[str] = None
    stageIndex: Optional[int] = None
    totalStages: Optional[int] = None
    currentStage: Optional[LessonStage] = None
    conversation: List[LessonAssistantMessage] = Field(default_factory=list)


class LessonAssistantResponse(BaseModel):
    answer: str
