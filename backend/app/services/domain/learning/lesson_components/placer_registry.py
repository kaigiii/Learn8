from typing import Callable, Dict, Any, Awaitable
from app.schemas.lesson_schema import LessonStage

# Placer interface: takes LessonStage and llm_provider, runs asynchronous generation and merges it
Placer = Callable[[LessonStage, Any], Awaitable[None]]

class LessonComponentPlacerRegistry:
    def __init__(self) -> None:
        self._placers: Dict[str, Placer] = {}

    def register(self, component: str, placer: Placer) -> None:
        self._placers[component] = placer

    def get(self, component: str) -> Placer | None:
        return self._placers.get(component)

placer_registry = LessonComponentPlacerRegistry()
