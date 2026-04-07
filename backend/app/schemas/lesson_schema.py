from typing import Any, Optional, List, Union
from pydantic import BaseModel, Field, field_validator, model_validator
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


class LessonDifficulty(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


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
    difficulty: Optional[LessonDifficulty] = None
    recommendedDurationMinutes: Optional[int] = None
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

    @field_validator("difficulty", mode="before")
    @classmethod
    def validate_difficulty(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, LessonDifficulty):
            return value
        normalized = str(value).strip().lower()
        mapping = {
            "low": LessonDifficulty.LOW,
            "medium": LessonDifficulty.MEDIUM,
            "mid": LessonDifficulty.MEDIUM,
            "high": LessonDifficulty.HIGH,
            "低": LessonDifficulty.LOW,
            "中": LessonDifficulty.MEDIUM,
            "高": LessonDifficulty.HIGH,
        }
        return mapping.get(normalized, value)

    @field_validator("recommendedDurationMinutes", mode="before")
    @classmethod
    def validate_recommended_duration_minutes(cls, value: Any) -> Any:
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return max(1, int(value))
        if isinstance(value, str):
            digits = "".join(ch for ch in value if ch.isdigit())
            if digits:
                return max(1, int(digits))
        return value

    @model_validator(mode="after")
    def validate_component_config(self):
        from app.core.component_loader import registry

        errors = registry.validate_component_data(self.component, self.config.data)
        if self.component == "MatchingPairs" and isinstance(self.config.data, dict):
            pairs = self.config.data.get("pairs", [])
            if not isinstance(pairs, list) or not pairs:
                errors.append("Component `MatchingPairs` requires a non-empty `pairs` list.")
            else:
                seen_ids = set()
                for index, pair in enumerate(pairs):
                    if not isinstance(pair, dict):
                        errors.append(
                            f"Component `MatchingPairs` pair at index {index} must be an object."
                        )
                        continue

                    left = str(pair.get("left") or "").strip()
                    right = str(pair.get("right") or "").strip()
                    pair_id = str(pair.get("id") or "").strip()

                    if not left:
                        errors.append(
                            f"Component `MatchingPairs` pair at index {index} is missing `left`."
                        )
                    if not right:
                        errors.append(
                            f"Component `MatchingPairs` pair at index {index} is missing `right`."
                        )
                    if pair_id:
                        if pair_id in seen_ids:
                            errors.append(
                                f"Component `MatchingPairs` has duplicate pair id `{pair_id}`."
                            )
                        seen_ids.add(pair_id)

        if errors:
            raise ValueError(" ".join(errors))
        return self


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


class LessonComponentManifestItem(BaseModel):
    name: str
    frontendRegistryKey: str
    module: str
    description: str
    allowedInRemedial: bool = False
    requiredConfigDataFields: List[str] = Field(default_factory=list)
    optionalConfigDataFields: List[str] = Field(default_factory=list)
    submissionKeys: List[str] = Field(default_factory=list)
    schemaRequirements: str = ""


class LessonComponentManifestResponse(BaseModel):
    items: List[LessonComponentManifestItem] = Field(default_factory=list)


class LessonGenerationPreferenceItem(BaseModel):
    id: int
    courseId: int
    nodeId: Optional[str] = None
    allowedComponents: List[str] = Field(default_factory=list)


class LessonGenerationPreferenceListResponse(BaseModel):
    items: List[LessonGenerationPreferenceItem] = Field(default_factory=list)


class LessonGenerationPreferenceUpsertRequest(BaseModel):
    courseId: int
    nodeId: Optional[str] = None
    allowedComponents: List[str] = Field(default_factory=list)
