from typing import Any, Optional
from app.schemas.lesson_schema import LessonStage
from app.services.domain.learning.lesson_components.evaluator_registry import evaluator_registry
from app.services.domain.learning.lesson_components.go.rules_engine import GoRulesEngine

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

def normalize_go_board_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        answer = user_input.get("answer") or user_input.get("selectedPoint") or user_input.get("value") or ""
    else:
        answer = user_input or ""
    return {"answer": str(answer).strip()}

def _parse_go_board_rows(board: Any) -> list[list[str]]:
    return GoRulesEngine(board).grid

def count_marked_group_liberties(board: Any) -> Optional[int]:
    return GoRulesEngine(board).count_marked_group_liberties()

def find_capturing_moves(board: Any) -> list[str]:
    return GoRulesEngine(board).find_capturing_moves()

def find_no_entry_points(board: Any, player: str = "B") -> list[str]:
    return GoRulesEngine(board).find_no_entry_points(player)



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
    if isinstance(bank_acceptable, list):
        valid_answers = {str(answer).replace(" ", "").upper() for answer in bank_acceptable}
    
    engine = GoRulesEngine(data.get("board"))
    
    # 2. Numeric / Liberty Counting modes
    if stage.component in ("GoBoardNumeric", "GoCountLiberties", "GoCountTerritory"):
        is_territory_question = (
            stage.component == "GoCountTerritory" or 
            (stage.component == "GoBoardNumeric" and "目" in data.get("question", ""))
        )
        if is_territory_question:
            # For territory questions, trust the database expectedAnswer if it is a valid digit,
            # otherwise fallback to counting black territory.
            if not (expected_answer and str(expected_answer).strip().isdigit()):
                computed = engine.count_black_territory()
                expected_answer = str(computed)
        else:
            if engine.marks:
                computed = engine.count_marked_group_liberties()
                if computed is not None:
                    expected_answer = str(computed)

    # 後備相容性：若無 acceptableAnswers，將 expectedAnswer 包裝為 valid_answers 比對
    if valid_answers is None and expected_answer:
        valid_answers = {str(expected_answer).replace(" ", "").upper()}

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

# Register all Go evaluators
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
