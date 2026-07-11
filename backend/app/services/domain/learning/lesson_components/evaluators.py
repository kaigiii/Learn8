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


def normalize_go_board_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        answer = user_input.get("answer") or user_input.get("selectedPoint") or user_input.get("value") or ""
    else:
        answer = user_input or ""
    return {"answer": str(answer).strip()}


def _parse_go_board_rows(board: Any) -> list[list[str]]:
    from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
    return GoRulesEngine(board).grid


def count_marked_group_liberties(board: Any) -> Optional[int]:
    from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
    return GoRulesEngine(board).count_marked_group_liberties()


def _go_coordinate(row: int, col: int, size: int) -> str:
    """Board coordinate in the same notation the frontend renders/reads."""
    return f"{chr(65 + col)}{size - row}"


def find_capturing_moves(board: Any) -> list[str]:
    from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
    return GoRulesEngine(board).find_capturing_moves()


def _normalize_stone_color(value: Any) -> Optional[str]:
    """Normalize a colour hint ("B"/"black"/"黑"…, "W"/"white"/"白"…) to "B"/"W"."""
    if not isinstance(value, str):
        return None
    token = value.strip().lower()
    if token in ("w", "white", "白", "白棋"):
        return "W"
    if token in ("b", "black", "黑", "黑棋"):
        return "B"
    return None


def find_no_entry_points(board: Any, player: str = "B") -> list[str]:
    from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
    return GoRulesEngine(board).find_no_entry_points(player)



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


async def evaluate_go_board(
    stage: LessonStage,
    user_input: Any,
    _context_topic: str,
    _architect_service: Any,
    course_id: Optional[int] = None,
):
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    normalized_input = normalize_go_board_input(user_input)
    expected_answer = (
        data.get("expectedAnswer")
        or data.get("correctAnswer")
        or data.get("answer")
        or ""
    )

    valid_answers: Optional[set[str]] = None
    bank_acceptable = data.get("acceptableAnswers")
    if isinstance(bank_acceptable, list) and bank_acceptable:
        valid_answers = {str(answer).replace(" ", "").upper() for answer in bank_acceptable}
    
    from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
    engine = GoRulesEngine(data.get("board"))
    
    # 1. Coordinate / Single Click answering modes
    if stage.component in ("GoBoardCoordinate", "GoCaptureStones", "GoNoEntry", "GoConnect", "GoCut", "GoEscape", "GoKo"):
        if not valid_answers and engine.grid:
            question_text = data.get("question", "")
            player = _normalize_stone_color(data.get("playerColor")) or "B"
            
            is_matched = False
            ans_list = []
            if "提" in question_text or "吃" in question_text:
                ans_list = engine.find_capturing_moves("W" if player == "B" else "B")
                is_matched = True
            elif "禁" in question_text:
                ans_list = engine.find_no_entry_points(player)
                is_matched = True
            elif "連" in question_text:
                ans_list = engine.find_connecting_moves(player)
                is_matched = True
            elif "斷" in question_text:
                ans_list = engine.find_cutting_moves(player)
                is_matched = True
            elif "逃" in question_text:
                ans_list = engine.find_escaping_moves(player)
                is_matched = True
            elif "劫" in question_text or "叫吃" in question_text:
                ans_list = engine.find_atari_moves(player)
                is_matched = True
                
            if is_matched:
                valid_answers = {ans.replace(" ", "").upper() for ans in ans_list}
                expected_answer = " 或 ".join(ans_list)
                
    # 2. Numeric / Liberty Counting modes
    elif stage.component in ("GoBoardNumeric", "GoCountLiberties", "GoCountTerritory"):
        if stage.component in ("GoBoardNumeric", "GoCountLiberties") and engine.marks:
            computed = engine.count_marked_group_liberties()
            if computed is not None:
                expected_answer = str(computed)
        elif stage.component in ("GoBoardNumeric", "GoCountTerritory") and "目" in data.get("question", ""):
            computed = engine.count_black_territory()
            expected_answer = str(computed)

    submitted_answer = normalized_input["answer"]
    expected_text = str(expected_answer).strip()
    submitted_text = submitted_answer.strip()

    if valid_answers is not None:
        is_correct = submitted_text.replace(" ", "").upper() in valid_answers
    elif submitted_text.isdigit() and expected_text.isdigit():
        is_correct = int(submitted_text) == int(expected_text)
    else:
        is_correct = submitted_text.lower() == expected_text.lower()

    evaluation = {
        "submittedAnswer": submitted_text,
        "expectedAnswer": expected_text,
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
evaluator_registry.register("GoBoardCoordinate", evaluate_go_board)
evaluator_registry.register("GoBoardNumeric", evaluate_go_board)
evaluator_registry.register("GoCountLiberties", evaluate_go_board)
evaluator_registry.register("GoCaptureStones", evaluate_go_board)
evaluator_registry.register("GoKo", evaluate_go_board)
evaluator_registry.register("GoEscape", evaluate_go_board)
evaluator_registry.register("GoNoEntry", evaluate_go_board)
evaluator_registry.register("GoConnect", evaluate_go_board)
evaluator_registry.register("GoCut", evaluate_go_board)
evaluator_registry.register("GoCountTerritory", evaluate_go_board)




