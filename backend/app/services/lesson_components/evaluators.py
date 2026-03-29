from __future__ import annotations

from typing import Any

from app.schemas.lesson_schema import LessonStage
from app.services.lesson_components.evaluator_registry import evaluator_registry


def _normalize_ordering_item(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return (
            item.get("text")
            or item.get("label")
            or item.get("content")
            or item.get("id")
            or str(item)
        )
    return str(item)


def normalize_multiple_choice_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        selected_option_id = user_input.get("selectedOptionId") or user_input.get(
            "selected_option_id"
        )
    else:
        selected_option_id = user_input
    return {"selectedOptionId": str(selected_option_id or "")}


def normalize_ordering_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        order = user_input.get("order") or user_input.get("steps") or []
    else:
        order = user_input or []
    return {"order": [_normalize_ordering_item(item) for item in list(order)]}


def normalize_matching_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        matches = user_input.get("matches", user_input)
    else:
        matches = {}
    return {"matches": {str(k): str(v) for k, v in dict(matches).items()}}


def _normalize_matching_pair_id(pair: Any, index: int) -> str:
    if isinstance(pair, dict) and pair.get("id"):
        return str(pair.get("id"))
    return f"pair-{index}"


async def evaluate_multiple_choice(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    validation = (
        stage.validation.condition
        if isinstance(stage.validation.condition, dict)
        else {}
    )
    normalized_input = normalize_multiple_choice_input(user_input)
    correct_option_id = (
        data.get("correctId")
        or data.get("correctOptionId")
        or validation.get("correctId")
        or validation.get("correctOptionId")
        or ""
    )
    is_correct = normalized_input["selectedOptionId"] == str(correct_option_id)
    evaluation = {
        "selectedOptionId": normalized_input["selectedOptionId"],
        "correctOptionId": str(correct_option_id),
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


async def evaluate_ordering(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    normalized_input = normalize_ordering_input(user_input)
    expected_order = [
        _normalize_ordering_item(item) for item in list(data.get("steps", []))
    ]
    is_correct = normalized_input["order"] == expected_order
    evaluation = {
        "submittedOrder": normalized_input["order"],
        "expectedOrder": expected_order,
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


async def evaluate_matching_pairs(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    normalized_input = normalize_matching_input(user_input)
    expected_pairs = {
        _normalize_matching_pair_id(pair, index): _normalize_matching_pair_id(
            pair, index
        )
        for index, pair in enumerate(list(data.get("pairs", [])))
    }
    is_correct = normalized_input["matches"] == expected_pairs
    evaluation = {
        "submittedMatches": normalized_input["matches"],
        "expectedMatches": expected_pairs,
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


async def evaluate_feynman(
    stage: LessonStage,
    user_input: Any,
    context_topic: str,
    architect_service: Any,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    if isinstance(user_input, dict):
        explanation = str(user_input.get("explanation") or "").strip()
    else:
        explanation = str(user_input or "").strip()

    normalized_input = {"explanation": explanation}
    grading = await architect_service.grade_feynman_attempt(
        explanation,
        context_topic or stage.topic,
        prompt=str(data.get("prompt") or stage.topic),
        sample_answer=str(data.get("sampleAnswer") or ""),
    )
    is_correct = bool(grading.get("isCorrect"))
    evaluation = {
        "prompt": str(data.get("prompt") or stage.topic),
        "sampleAnswer": str(data.get("sampleAnswer") or ""),
        "grading": grading,
    }
    return (
        "correct" if is_correct else "incorrect",
        grading.get(
            "feedback",
            stage.feedback.success if is_correct else stage.feedback.error,
        ),
        normalized_input,
        evaluation,
    )


evaluator_registry.register("MultipleChoice", evaluate_multiple_choice)
evaluator_registry.register("Ordering", evaluate_ordering)
evaluator_registry.register("MatchingPairs", evaluate_matching_pairs)
evaluator_registry.register("FeynmanMirror", evaluate_feynman)
