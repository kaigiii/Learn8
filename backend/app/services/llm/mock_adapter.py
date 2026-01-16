
from typing import Any, List, Type
from pydantic import BaseModel
from app.services.llm.base import BaseLLMProvider

class MockLLMProvider(BaseLLMProvider):
    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        return "This is a mock response from the AI Architect."

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        # We need to return a valid instance of the requested schema
        # This requires knowing what schema is requested.
        # Ideally, we construct a dummy object based on the schema fields.
        
        # For Syllabus Generation (CoursePath)
        if schema.__name__ == "CoursePath":
            from app.schemas.course import CoursePath, Unit, LessonNode
            return CoursePath(
                courseTitle="Mock Course: Quantum Mechanics",
                units=[
                    Unit(
                        unitId="unit-1",
                        unitTitle="Unit 1: Basics",
                        nodes=[
                            LessonNode(id="node-1", title="Introduction to Quantum Physics", description="Basic principles of quantum mechanics", type="concept", status="locked"),
                            LessonNode(id="node-2", title="Wave-Particle Duality", description="Understanding light as both particle and wave", type="concept", status="locked"),
                        ]
                    ),
                    Unit(
                        unitId="unit-2",
                        unitTitle="Unit 2: Advanced Topics",
                        nodes=[
                            LessonNode(id="node-3", title="Schrodinger Equation", description="The fundamental equation of quantum mechanics", type="concept", status="locked"),
                        ]
                    )
                ]
            )
            
        # For Lesson Generation (LessonStage)
        if schema.__name__ == "LessonStage":
            from app.schemas.lesson import LessonStage, ComponentType, SkinType
            return LessonStage(
                stage_id="mock-stage-1",
                type=ComponentType.Quiz,
                skin=SkinType.Default,
                title="Mock Quiz",
                content="What is the speed of light?",
                options=["3x10^8 m/s", "300 km/h", "Infinite", "Zero"],
                correct_answer=0
            )
            
        # Default fallback (might fail if schema is complex, but good for now)
        try:
            return schema()
        except:
            raise NotImplementedError(f"Mock data for {schema.__name__} not implemented")
