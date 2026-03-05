"""
模組名稱: app.schemas.lesson
功能描述: 遊戲化課程內容架構 (Gamified Lesson Content Schemas)

這是系統中最複雜的 Schema 模組，定義了 "Lesson Stage" (課程階段) 的多態性結構。
利用 Pydantic 的 Union 與 Discriminator 機制，支援多種不同的遊戲化組件配置。

主要枚舉 (Enums):
    - ModuleType: 教學模組類型 (Instruction, Practice, Assessment, Incentive)。
    - ComponentType: 前端 UI 組件類型 (TextToken, TaxonomyMatrix, PatternMatcher 等)。
    - SkinType: 介面風格 (Scientific, Classic, Code)。
    - ValidationType: 答案驗證邏輯 (Exact, Regex, Logic)。

核心模型 (Stage Models):
    - LessonStage (Union): 代表任意一種階段類型。
    - TextTokenStage: 針對 TextToken 組件的設定。
    - TaxonomyStage: 針對 TaxonomyMatrix 組件的設定。
    - PatternMatcherStage: 針對 PatternMatcher 組件的設定。

互動模型:
    - SubmissionRequest: 前端提交答案的格式。
    - SubmissionResponse: 後端回傳的判定結果 (包含 nextAction, remedialStage)。
"""
from typing import Any, Optional, List, Union, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum

# --- Enums ---
class ModuleType(str, Enum):
    Instruction = 'Instruction'
    Practice = 'Practice'
    Assessment = 'Assessment'
    Incentive = 'Incentive'

class ComponentType(str, Enum):
    # We keep this for any legacy code, but realistically new ones are just strings
    pass

class SkinType(str, Enum):
    Scientific = 'Scientific'
    Classic = 'Classic'
    Code = 'Code'

class ValidationType(str, Enum):
    Exact = 'exact'
    Regex = 'regex'
    Logic = 'logic'

def parse_data_field(v: Any) -> Any:
    # Helper to handle stringified JSON from LLMs
    if v is None: return {}
    if isinstance(v, str):
        try:
            import json
            return json.loads(v)
        except:
            return {}
    return v

# --- Config Models ---
class GenericConfig(BaseModel):
    initialState: dict = {}
    data: Union[dict, list, str, Any] = {} # Permissive for migration
    
    @field_validator('initialState', mode='before')
    @classmethod
    def validate_initial_state(cls, v: Any) -> dict:
        return v or {}

    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any) -> Union[dict, list, str, Any]:
        return parse_data_field(v)

# --- Validation & Feedback ---
class Validation(BaseModel):
    type: ValidationType
    condition: Optional[Any] = None

class Feedback(BaseModel):
    success: str
    error: str

# --- Stage Models ---
class LessonStage(BaseModel):
    stageId: str
    topic: str
    module: ModuleType
    skin: SkinType
    component: str  # Now accepts any string, validating against registry
    validation: Validation
    feedback: Feedback
    config: GenericConfig

    @field_validator('component')
    @classmethod
    def validate_component(cls, v: str) -> str:
        from app.core.component_loader import registry
        if v not in registry.get_component_names():
            # In production, you might raise ValueError here based on strictness requirements
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
