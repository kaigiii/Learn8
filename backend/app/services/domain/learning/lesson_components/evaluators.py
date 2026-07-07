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


def _normalize_go_board_row(value: Any) -> list[str]:
    """Split a single board row into individual point tokens.

    Mirrors the frontend parser: rows may be a space/comma separated string,
    a run of single characters ("..B.."), or an already-split list.
    """
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return []
        if re.search(r"[\s,|]+", trimmed):
            return [token for token in re.split(r"[\s,|]+", trimmed) if token]
        return [char for char in trimmed if char != " "]
    if isinstance(value, list):
        return [str(entry) for entry in value if str(entry)]
    return []


def _parse_go_board_rows(board: Any) -> list[list[str]]:
    if isinstance(board, list):
        raw_rows = [_normalize_go_board_row(row) for row in board]
    elif isinstance(board, dict) and isinstance(board.get("rows"), list):
        raw_rows = [_normalize_go_board_row(row) for row in board["rows"]]
    else:
        return []

    if not raw_rows:
        return []

    # Pad to a square grid (with empty points) so the counting matches the
    # square board the frontend renders — a no-op for well-formed positions.
    size = max(len(raw_rows), max((len(row) for row in raw_rows), default=0))
    return [[row[col] if col < len(row) else "." for col in range(size)] for row in raw_rows[:size]] + [
        ["."] * size for _ in range(size - len(raw_rows))
    ]


def count_marked_group_liberties(board: Any) -> Optional[int]:
    """Count the liberties of the marked ("X") group directly from the board.

    Returns ``None`` when the board has no marked group so callers can fall
    back to the authored answer. Liberties are the distinct empty (".") points
    orthogonally adjacent to any stone in the marked group.
    """
    rows = _parse_go_board_rows(board)
    marked = [
        (r, c)
        for r, row in enumerate(rows)
        for c, cell in enumerate(row)
        if cell in ("X", "x")
    ]
    if not marked:
        return None

    liberties: set[tuple[int, int]] = set()
    for row_index, col_index in marked:
        neighbors = (
            (row_index - 1, col_index),
            (row_index + 1, col_index),
            (row_index, col_index - 1),
            (row_index, col_index + 1),
        )
        for neighbor_row, neighbor_col in neighbors:
            if 0 <= neighbor_row < len(rows) and 0 <= neighbor_col < len(rows[neighbor_row]):
                if rows[neighbor_row][neighbor_col] == ".":
                    liberties.add((neighbor_row, neighbor_col))
    return len(liberties)


def _go_coordinate(row: int, col: int, size: int) -> str:
    """Board coordinate in the same notation the frontend renders/reads.

    Column letters run A, B, C … from the left; row numbers count from the
    bottom (so the bottom row is 1, matching a real go board).
    """
    return f"{chr(65 + col)}{size - row}"


def find_capturing_moves(board: Any) -> list[str]:
    """Coordinates where the player to move can capture a white group.

    A move captures when it fills the last liberty of an opponent (white)
    group, so the answer for a "提子/capture" question is any empty point that
    is the sole liberty of a white group. Returns the coordinates sorted; an
    empty list means nothing is capturable (the caller then trusts the authored
    answer).
    """
    rows = _parse_go_board_rows(board)
    if not rows:
        return []

    size = len(rows)

    def is_white(value: str) -> bool:
        return value in ("W", "w")

    visited: set[tuple[int, int]] = set()
    moves: set[str] = set()

    for start_row in range(size):
        for start_col in range(size):
            if (start_row, start_col) in visited or not is_white(rows[start_row][start_col]):
                continue

            stack = [(start_row, start_col)]
            visited.add((start_row, start_col))
            liberties: set[tuple[int, int]] = set()

            while stack:
                row_index, col_index = stack.pop()
                neighbors = (
                    (row_index - 1, col_index),
                    (row_index + 1, col_index),
                    (row_index, col_index - 1),
                    (row_index, col_index + 1),
                )
                for neighbor_row, neighbor_col in neighbors:
                    if not (0 <= neighbor_row < size and 0 <= neighbor_col < size):
                        continue
                    cell = rows[neighbor_row][neighbor_col]
                    if cell == ".":
                        liberties.add((neighbor_row, neighbor_col))
                    elif is_white(cell) and (neighbor_row, neighbor_col) not in visited:
                        visited.add((neighbor_row, neighbor_col))
                        stack.append((neighbor_row, neighbor_col))

            if len(liberties) == 1:
                liberty_row, liberty_col = next(iter(liberties))
                moves.add(_go_coordinate(liberty_row, liberty_col, size))

    return sorted(moves)


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
    """Empty points that are illegal ("禁入點"/suicide) for ``player`` to play.

    Placing a stone is forbidden when the resulting group would have zero
    liberties and the move captures nothing. Concretely an empty point P is a
    no-entry point when: it has no empty neighbour, no adjacent opponent group
    has P as its only liberty (nothing gets captured), and every adjacent
    friendly group's only liberty is P (the played stone stays breathless).
    Returns the coordinates sorted; an empty list means the board has none.
    """
    rows = _parse_go_board_rows(board)
    if not rows:
        return []

    size = len(rows)
    player_color = _normalize_stone_color(player) or "B"
    opponent_color = "W" if player_color == "B" else "B"

    def color_of(cell: str) -> Optional[str]:
        if cell in ("B", "b"):
            return "B"
        if cell in ("W", "w"):
            return "W"
        return None

    def neighbors(row: int, col: int):
        for nr, nc in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
            if 0 <= nr < size and 0 <= nc < size:
                yield nr, nc

    def group_liberties(row: int, col: int) -> set[tuple[int, int]]:
        group_color = color_of(rows[row][col])
        stack = [(row, col)]
        seen = {(row, col)}
        liberties: set[tuple[int, int]] = set()
        while stack:
            cr, cc = stack.pop()
            for nr, nc in neighbors(cr, cc):
                cell = rows[nr][nc]
                if cell == ".":
                    liberties.add((nr, nc))
                elif color_of(cell) == group_color and (nr, nc) not in seen:
                    seen.add((nr, nc))
                    stack.append((nr, nc))
        return liberties

    no_entry: set[str] = set()
    for row in range(size):
        for col in range(size):
            if rows[row][col] != ".":
                continue

            board_neighbors = list(neighbors(row, col))
            # Direct liberty -> always legal.
            if any(rows[nr][nc] == "." for nr, nc in board_neighbors):
                continue

            captures_opponent = False
            friendly_survives = False
            for nr, nc in board_neighbors:
                neighbor_color = color_of(rows[nr][nc])
                if neighbor_color == opponent_color:
                    if group_liberties(nr, nc) == {(row, col)}:
                        captures_opponent = True
                        break
                elif neighbor_color == player_color:
                    if group_liberties(nr, nc) - {(row, col)}:
                        friendly_survives = True

            if captures_opponent or friendly_survives:
                continue

            no_entry.add(_go_coordinate(row, col, size))

    return sorted(no_entry)


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

    # The authored answer is AI-generated and frequently disagrees with the
    # board that is actually drawn, so derive the answer from the board itself
    # when we can. Only fall back to the authored answer when the board cannot
    # be graded (e.g. no marked group / nothing capturable).
    valid_answers: Optional[set[str]] = None
    bank_acceptable = data.get("acceptableAnswers")
    if isinstance(bank_acceptable, list) and bank_acceptable:
        # Puzzle-bank coordinate questions carry the full set of correct points
        # (e.g. several squares can capture / cut). Accept any of them.
        valid_answers = {str(answer).replace(" ", "").upper() for answer in bank_acceptable}
    elif stage.component == "GoCountLiberties":
        computed = count_marked_group_liberties(data.get("board"))
        if computed is not None:
            expected_answer = str(computed)
    elif stage.component == "GoCaptureStones":
        capturing_moves = find_capturing_moves(data.get("board"))
        if capturing_moves:
            valid_answers = {move.replace(" ", "").upper() for move in capturing_moves}
            expected_answer = " 或 ".join(capturing_moves)
    elif stage.component == "GoNoEntry" and _parse_go_board_rows(data.get("board")):
        # The board is authoritative for no-entry questions (there is no separate
        # marker to trust). Only genuinely forbidden points count; a board with
        # none is broken, so nothing is accepted and we don't surface the
        # unreliable authored answer.
        player = _normalize_stone_color(data.get("playerColor")) or "B"
        no_entry_points = find_no_entry_points(data.get("board"), player)
        valid_answers = {point.replace(" ", "").upper() for point in no_entry_points}
        expected_answer = " 或 ".join(no_entry_points)

    submitted_answer = normalized_input["answer"]
    expected_text = str(expected_answer).strip()
    submitted_text = submitted_answer.strip()

    if valid_answers is not None:
        # "Where can you capture?" — accept any coordinate that captures a group.
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
evaluator_registry.register("GoCountLiberties", evaluate_go_board)
evaluator_registry.register("GoCaptureStones", evaluate_go_board)
evaluator_registry.register("GoKo", evaluate_go_board)
evaluator_registry.register("GoEscape", evaluate_go_board)
evaluator_registry.register("GoNoEntry", evaluate_go_board)
evaluator_registry.register("GoConnect", evaluate_go_board)
evaluator_registry.register("GoCut", evaluate_go_board)
evaluator_registry.register("GoCountTerritory", evaluate_go_board)
