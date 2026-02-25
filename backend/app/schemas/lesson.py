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
    VariableBalancer = 'VariableBalancer'
    LogicChain = 'LogicChain'
    TaxonomyMatrix = 'TaxonomyMatrix'
    TextToken = 'TextToken'
    FeynmanMirror = 'FeynmanMirror'
    Sequencer = 'Sequencer'
    SpatialAnatomy = 'SpatialAnatomy'
    DilemmaSolver = 'DilemmaSolver'
    PatternMatcher = 'PatternMatcher'

class SkinType(str, Enum):
    Scientific = 'Scientific'
    Classic = 'Classic'
    Code = 'Code'

class ValidationType(str, Enum):
    Exact = 'exact'
    Regex = 'regex'
    Logic = 'logic'

# --- Component Data Models ---
# --- Component Data Models ---
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

class TextTokenData(BaseModel):
    text: Optional[str] = None
    items: Optional[List[str]] = None

class TaxonomyItem(BaseModel):
    id: str
    content: str
    correctBucket: Optional[str] = None

class TaxonomyData(BaseModel):
    buckets: List[str]
    items: List[TaxonomyItem]

class GenericData(BaseModel):
    # For components not yet strictly typed
    pass

# --- Config Models ---
class BaseStageConfig(BaseModel):
    initialState: dict = {}

    @field_validator('initialState', mode='before')
    @classmethod
    def validate_initial_state(cls, v: Any) -> dict:
        return v or {}

class TextTokenConfig(BaseStageConfig):
    data: TextTokenData
    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any): return parse_data_field(v)

class TaxonomyConfig(BaseStageConfig):
    data: TaxonomyData
    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any): return parse_data_field(v)

class GenericConfig(BaseStageConfig):
    data: dict = {} # Permissive for migration
    
    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any) -> dict:
        return parse_data_field(v)

# --- Validation & Feedback ---
class Validation(BaseModel):
    type: ValidationType
    condition: Any

class Feedback(BaseModel):
    success: str
    error: str

# --- Stage Models ---
class BaseLessonStage(BaseModel):
    stageId: str
    topic: str
    module: ModuleType
    skin: SkinType
    validation: Validation
    feedback: Feedback

class TextTokenStage(BaseLessonStage):
    component: Literal[ComponentType.TextToken]
    config: TextTokenConfig

class TaxonomyStage(BaseLessonStage):
    component: Literal[ComponentType.TaxonomyMatrix]
    config: TaxonomyConfig


class PatternMatcherData(BaseModel):
    pairs: List[dict]

class PatternMatcherConfig(BaseStageConfig):
    data: PatternMatcherData
    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any): return parse_data_field(v)

class PatternMatcherStage(BaseLessonStage):
    component: Literal[ComponentType.PatternMatcher]
    config: PatternMatcherConfig

class GenericStage(BaseLessonStage):
    # Catch-all for other components
    component: Literal[
        ComponentType.VariableBalancer,
        ComponentType.LogicChain,
        ComponentType.FeynmanMirror,
        ComponentType.Sequencer,
        ComponentType.SpatialAnatomy,
        ComponentType.DilemmaSolver
    ]
    config: GenericConfig

# --- The Union ---
from typing import Annotated

LessonStage = Annotated[
    Union[
        TextTokenStage, 
        TaxonomyStage, 
        PatternMatcherStage, 
        GenericStage
    ],
    Field(discriminator='component')
]
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
