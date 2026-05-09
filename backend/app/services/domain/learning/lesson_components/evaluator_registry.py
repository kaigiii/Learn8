from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

from app.schemas.lesson_schema import LessonStage

EvaluationResult = tuple[str, str, dict, dict]
Evaluator = Callable[[LessonStage, Any, str, Any, Optional[int]], Awaitable[EvaluationResult]]


class LessonComponentEvaluatorRegistry:
    def __init__(self) -> None:
        self._evaluators: Dict[str, Evaluator] = {}

    def register(self, component: str, evaluator: Evaluator) -> None:
        self._evaluators[component] = evaluator

    def get(self, component: str) -> Evaluator | None:
        return self._evaluators.get(component)

    def names(self) -> list[str]:
        return list(self._evaluators.keys())


evaluator_registry = LessonComponentEvaluatorRegistry()
