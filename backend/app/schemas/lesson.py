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
    component: ComponentType 
    config: GenericConfig

# --- The Union ---
LessonStage = Union[TextTokenStage, TaxonomyStage, PatternMatcherStage, GenericStage] 
# Pydantic automatically discriminates? 
# To work effectively, we should use Field(discriminator='component') 
# BUT simple Union often works if types are distinct. 
# Given GenericStage catches everything, order matters!
# Put GenericStage LAST.

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
