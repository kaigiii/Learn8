from typing import Any, Optional, List, Union, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# --- 列舉型別 (Enums) ---
class ModuleType(str, Enum):
    Instruction = "Instruction"
    Practice = "Practice"
    Assessment = "Assessment"
    Incentive = "Incentive"


class ComponentType(str, Enum):
    # 保留給舊有程式碼相容用途，新組件名稱已改為純字串
    pass


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
    initialState: dict = {}
    data: Union[dict, list, str, Any] = {}  # 為了遷移期間的相容性而放寬型別

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
            # 在正式環境中，可依嚴格度要求在此處拋出 ValueError
            pass
        return v


class SubmissionRequest(BaseModel):
    stageId: str
    userInput: Any
    isCorrect: bool
    context_topic: Optional[str] = None
    component: Optional[str] = None


class SubmissionResponse(BaseModel):
    nextAction: str
    remedialStage: Optional[LessonStage] = None
    message: Optional[str] = None
