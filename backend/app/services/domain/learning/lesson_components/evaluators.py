from __future__ import annotations

import re
from typing import Any, Optional

from app.schemas.lesson_schema import LessonStage
from app.services.domain.learning.lesson_components.evaluator_registry import evaluator_registry
from app.services.ai_engine.agents.course_architect import AIArchitectService


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
    course_id: Optional[int] = None,
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
    course_id: Optional[int] = None,
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
    course_id: Optional[int] = None,
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
    architect_service: AIArchitectService,
    course_id: Optional[int] = None,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    if isinstance(user_input, dict):
        explanation = str(user_input.get("explanation") or "").strip()
        history = user_input.get("history", [])
    else:
        explanation = str(user_input or "").strip()
        history = []

    normalized_input = {"explanation": explanation, "history": history}
    
    # Check if the last message in history (from student) was satisfied
    # Or just re-evaluate if history is empty (backwards compatibility)
    if not history:
        grading = await architect_service.interact_feynman_round(
            topic=context_topic or stage.topic,
            conversation_history=[],
            user_input=explanation,
            course_id=course_id
        )
        is_correct = bool(grading.get("isSatisfied"))
        message = grading.get("reply", "")
    else:
        # The frontend tells us if it's correct/incorrect based on the student's satisfaction
        # But we should double check or just trust the last interaction result if passed
        # For now, let's assume if we reached here via onSubmit, it's either satisfied or max rounds.
        # We can re-run the satisfaction check on the last state.
        last_teacher_input = history[-2]["content"] if len(history) >= 2 else explanation
        prev_history = history[:-2] if len(history) >= 2 else []
        
        grading = await architect_service.interact_feynman_round(
            topic=context_topic or stage.topic,
            conversation_history=prev_history,
            user_input=last_teacher_input,
            course_id=course_id
        )
        is_correct = bool(grading.get("isSatisfied"))
        message = grading.get("reply", "")
        
        if not is_correct:
            # If not correct, it means we failed after max rounds.
            # Calculate actual rounds from history (len(history) // 2)
            round_count = len(history) // 2 if history else 1
            # Get advisor advice
            message = await architect_service.generate_feynman_remedial_suggestion(
                topic=context_topic or stage.topic,
                round_count=round_count,
                course_id=course_id
            )

    evaluation = {
        "prompt": str(data.get("prompt") or stage.topic),
        "sampleAnswer": str(data.get("sampleAnswer") or ""),
        "grading": grading,
        "history": history
    }
    
    return (
        "correct" if is_correct else "incorrect",
        message or (stage.feedback.success if is_correct else stage.feedback.error),
        normalized_input,
        evaluation,
    )


async def evaluate_explainer_media(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
    course_id: Optional[int] = None,
):
    normalized_input = (
        user_input
        if isinstance(user_input, dict)
        else {"acknowledged": bool(user_input)}
    )
    evaluation = {"acknowledged": True}
    return (
        "correct",
        stage.feedback.success,
        normalized_input,
        evaluation,
    )


async def evaluate_dynamic_category_sorter(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
    course_id: Optional[int] = None,
):
    normalized_input = user_input if isinstance(user_input, dict) else {}
    error_count = normalized_input.get("errorCount", 0)
    is_correct = error_count == 0 and normalized_input.get("completed", False)
    
    evaluation = {
        "completed": normalized_input.get("completed", False),
        "errorCount": error_count,
        "wrongMatches": normalized_input.get("wrongMatches", [])
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


async def evaluate_gantt_logic_scheduler(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
    course_id: Optional[int] = None,
):
    normalized_input = user_input if isinstance(user_input, dict) else {}
    logic_errors = normalized_input.get("logicErrors", [])
    is_correct = len(logic_errors) == 0 and normalized_input.get("completed", False)
    
    evaluation = {
        "completed": normalized_input.get("completed", False),
        "logicErrors": logic_errors,
        "durationUsed": normalized_input.get("durationUsed", 0)
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


async def evaluate_document_anomaly_debugger(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
    course_id: Optional[int] = None,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    total_anomalies = len(data.get("anomalies", []))
    
    normalized_input = user_input if isinstance(user_input, dict) else {}
    found_count = normalized_input.get("foundCount", 0)
    is_correct = (found_count == total_anomalies) and normalized_input.get("completed", False)
    
    evaluation = {
        "completed": normalized_input.get("completed", False),
        "foundCount": found_count,
        "totalAnomalies": total_anomalies,
        "wrongClicks": normalized_input.get("wrongClicks", 0)
    }
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


evaluator_registry.register("MultipleChoice", evaluate_multiple_choice)
evaluator_registry.register("Ordering", evaluate_ordering)
evaluator_registry.register("MatchingPairs", evaluate_matching_pairs)
evaluator_registry.register("FeynmanMirror", evaluate_feynman)
evaluator_registry.register("ExplainerMedia", evaluate_explainer_media)
evaluator_registry.register("DynamicCategorySorter", evaluate_dynamic_category_sorter)
evaluator_registry.register("GanttLogicScheduler", evaluate_gantt_logic_scheduler)
evaluator_registry.register("DocumentAnomalyDebugger", evaluate_document_anomaly_debugger)

# 動態載入其他組件的評分器
import app.services.domain.learning.lesson_components.go.evaluators





