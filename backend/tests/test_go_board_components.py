import asyncio

from app.schemas.lesson_schema import Feedback, GenericConfig, LessonStage, Validation

from app.services.domain.learning.lesson_components.go.evaluators import (
    count_marked_group_liberties,
    evaluate_go_board,
    find_capturing_moves,
    find_no_entry_points,
)


def _map_legacy_component(comp: str) -> str:
    if comp in ("GoCountLiberties", "GoCountTerritory", "GoBoardNumeric"):
        return "GoBoardNumeric"
    return "GoBoardCoordinate"


def _liberties_stage(board, expected_answer):
    return LessonStage(
        stageId="go-lib",
        topic="圍棋數氣",
        skin="Scientific",
        component=_map_legacy_component("GoCountLiberties"),
        validation=Validation(type="exact", condition={"answer": str(expected_answer)}),
        feedback=Feedback(success="正確", error="再想想"),
        config=GenericConfig(
            data={
                "question": "這個標記棋串有幾口氣？",
                "board": board,
                "expectedAnswer": str(expected_answer),
            },
            initialState={},
        ),
    )


def test_count_marked_group_liberties_from_board():
    assert count_marked_group_liberties([". . .", ". X .", ". . ."]) == 4
    assert count_marked_group_liberties(["X . .", ". . .", ". . ."]) == 2
    assert count_marked_group_liberties([". X X .", ". . W .", ". . . ."]) == 3
    # No marked group -> caller should fall back to the authored answer.
    assert count_marked_group_liberties([". . .", ". B .", ". . ."]) is None


def test_go_board_scores_against_board_not_authored_answer():
    # Authored answer is wrong (says 3) but the marked stone clearly has 4 liberties.
    stage = _liberties_stage([". . .", ". X .", ". . ."], expected_answer="3")

    correct = asyncio.run(evaluate_go_board(stage, {"answer": "4"}, "圍棋", None))
    assert correct[0] == "correct"
    assert correct[3]["expectedAnswer"] == "4"

    wrong = asyncio.run(evaluate_go_board(stage, {"answer": "3"}, "圍棋", None))
    assert wrong[0] == "incorrect"
    assert wrong[3]["expectedAnswer"] == "4"


def _capture_stage(board):
    ans_list = find_capturing_moves(board)
    return LessonStage(
        stageId="go-cap",
        topic="圍棋提子",
        skin="Scientific",
        component=_map_legacy_component("GoCaptureStones"),
        validation=Validation(type="exact", condition={"answer": ""}),
        feedback=Feedback(success="正確", error="再想想"),
        config=GenericConfig(
            data={
                "question": "黑棋下在哪裡可以把白棋提走？",
                "board": board,
                # Authored answer is an (irrelevant) count — grading must ignore it.
                "expectedAnswer": ans_list[0] if ans_list else "1",
                "acceptableAnswers": ans_list,
            },
            initialState={},
        ),
    )


def test_find_capturing_moves_from_board():
    # White stone in atari with its last liberty below it.
    assert find_capturing_moves([". B .", "B W B", ". . ."]) == ["B1"]
    # Connected two-stone white group in atari.
    assert find_capturing_moves(["B B B", "B W W", "B B ."]) == ["C1"]
    # White has two liberties -> not capturable.
    assert find_capturing_moves([". B .", "B W .", ". . ."]) == []


def test_go_capture_grades_by_capturing_position():
    stage = _capture_stage([". B .", "B W B", ". . ."])  # capturing move is B1

    correct = asyncio.run(evaluate_go_board(stage, {"answer": "B1"}, "圍棋", None))
    assert correct[0] == "correct"
    assert correct[3]["expectedAnswer"] == "B1"

    # Coordinates are matched case-insensitively.
    assert asyncio.run(evaluate_go_board(stage, {"answer": "b1"}, "圍棋", None))[0] == "correct"

    # A non-capturing point (and the old count answer) are now incorrect.
    assert asyncio.run(evaluate_go_board(stage, {"answer": "A1"}, "圍棋", None))[0] == "incorrect"
    assert asyncio.run(evaluate_go_board(stage, {"answer": "1"}, "圍棋", None))[0] == "incorrect"


def _no_entry_stage(board, expected_answer):
    ans_list = find_no_entry_points(board)
    return LessonStage(
        stageId="go-noentry",
        topic="圍棋禁入點",
        skin="Scientific",
        component=_map_legacy_component("GoNoEntry"),
        validation=Validation(type="exact", condition={"answer": str(expected_answer)}),
        feedback=Feedback(success="正確", error="再想想"),
        config=GenericConfig(
            data={
                "question": "哪一個點是黑棋的禁入點？",
                "board": board,
                "expectedAnswer": str(expected_answer),
                "acceptableAnswers": ans_list,
            },
            initialState={},
        ),
    )


def test_find_no_entry_points_from_board():
    # Empty point fully enclosed by white (an eye) is suicide for Black.
    assert "B2" in find_no_entry_points([".W.", "W.W", ".W."])
    # A point with an empty neighbour is legal, never a no-entry point.
    assert find_no_entry_points([".....", "..B..", ".....", ".....", "....."]) == []
    # If the surrounded white group is itself in atari, Black captures instead of
    # committing suicide, so the point is legal.
    assert find_no_entry_points(["BWB", "W.W", "BWB"]) == []


def test_go_no_entry_grades_by_forbidden_point():
    # White eye at B2 (center); the enclosing stones have outside liberties.
    stage = _no_entry_stage([".W.", "W.W", ".W."], expected_answer="B2")

    assert asyncio.run(evaluate_go_board(stage, {"answer": "B2"}, "圍棋", None))[0] == "correct"
    assert asyncio.run(evaluate_go_board(stage, {"answer": "b2"}, "圍棋", None))[0] == "correct"

    # The buggy board from the report: the authored answer says B2, but B2 has
    # empty neighbours, so it is NOT forbidden. The board is authoritative, so
    # B2 must grade as incorrect instead of blindly trusting the authored answer.
    buggy = _no_entry_stage(["WW...", "W.B..", "WW...", ".....", "....."], expected_answer="B2")
    assert asyncio.run(evaluate_go_board(buggy, {"answer": "B2"}, "圍棋", None))[0] == "incorrect"


def test_go_board_evaluator_accepts_coordinate_answers():
    stage = LessonStage(
        stageId="go-1",
        topic="圍棋數氣",
        skin="Scientific",
        component=_map_legacy_component("GoCountLiberties"),
        validation=Validation(type="exact", condition={"answer": "4"}),
        feedback=Feedback(success="正確", error="再想想"),
        config=GenericConfig(
            data={
                "question": "這顆黑子有幾個氣？",
                "board": [". . .", ". B .", ". . ."],
                "expectedAnswer": "4",
            },
            initialState={},
        ),
    )

    result = asyncio.run(
        evaluate_go_board(stage, {"answer": "4"}, "圍棋", None)
    )

    status, message, normalized_input, evaluation = result

    assert status == "correct"
    assert message == "正確"
    assert normalized_input["answer"] == "4"
    assert evaluation["expectedAnswer"] == "4"





def test_validator_physical_sanity():
    from app.services.domain.learning.lesson_components.go.validators import check_physical_and_state_rules

    # 1. Valid configuration
    valid_board = {"size": 9, "black": ["C4", "E4"], "white": ["D3"], "marks": []}
    errors = check_physical_and_state_rules(valid_board, "C3", "B")
    assert not errors

    # 2. Overlapping stones
    overlap_board = {"size": 9, "black": ["C4"], "white": ["C4"], "marks": []}
    errors = check_physical_and_state_rules(overlap_board, "C3", "B")
    assert any("重疊" in err for err in errors)

    # 3. Coordinate out of bounds
    oob_board = {"size": 5, "black": ["A6"], "white": ["E2"], "marks": []}
    errors = check_physical_and_state_rules(oob_board, "C3", "B")
    assert any("超出棋盤邊界" in err for err in errors)

    # 4. Answer coordinate out of bounds
    errors = check_physical_and_state_rules(valid_board, "K10", "B")
    assert any("預期答案座標越界" in err for err in errors)

    # 5. Suicide move
    # Place white stones around C3
    suicide_board = {
        "size": 5,
        "black": [],
        "white": ["C4", "C2", "B3", "D3"],
        "marks": []
    }
    errors = check_physical_and_state_rules(suicide_board, "C3", "B")
    assert any("自殺" in err for err in errors)

    # 6. Pre-existing dead stones
    # Black stone at C3 is fully surrounded by White but still present on board before move
    dead_board = {
        "size": 5,
        "black": ["C3"],
        "white": ["C4", "C2", "B3", "D3"],
        "marks": []
    }
    errors = check_physical_and_state_rules(dead_board, "A1", "B")
    assert any("死棋" in err for err in errors)


def test_validate_go_board_coordinate_with_mock_llm():
    from app.services.domain.learning.lesson_components.go.validators import validate_go_board_coordinate

    class MockProvider:
        def __init__(self, reply: str):
            self.reply = reply
        async def generate_text(self, messages, **kwargs):
            return self.reply

    # Case A: AI Semantic check passes
    data_pass = {
        "board": {"size": 5, "black": ["A1"], "white": ["E5"], "marks": []},
        "expectedAnswer": "B1",
        "playerColor": "B",
        "board_blueprint": "Place Black B1",
        "question": "Where to play?",
        "explanation": "Play B1"
    }
    mock_pass = MockProvider("YES")
    errors = asyncio.run(validate_go_board_coordinate(data_pass, mock_pass))
    assert not errors

    # Case B: AI Semantic check fails
    mock_fail = MockProvider("NO because expectedAnswer does not capture anything")
    errors = asyncio.run(validate_go_board_coordinate(data_pass, mock_fail))
    assert any("第三層 AI 語義校驗未通過" in err for err in errors)


def test_validate_go_board_numeric_liberties_and_territory():
    from app.services.domain.learning.lesson_components.go.validators import validate_go_board_numeric

    # Case A: Liberties count matches
    data_lib = {
        "board": {"size": 5, "black": ["C3"], "white": [], "marks": ["C3"]},
        "expectedAnswer": "4",
        "question": "How many氣?",
    }
    errors = asyncio.run(validate_go_board_numeric(data_lib, None))
    assert not errors
    assert data_lib["expectedAnswer"] == "4"

    # Case B: Liberties count mismatch (should autocorrect)
    data_mismatch = {
        "board": {"size": 5, "black": ["C3"], "white": [], "marks": ["C3"]},
        "expectedAnswer": "2",  # incorrect, should be 4
        "question": "How many氣?",
    }
    errors = asyncio.run(validate_go_board_numeric(data_mismatch, None))
    assert not errors
    assert data_mismatch["expectedAnswer"] == "4"  # Autocorrected!

    # Case C: Liberties question but marks missing
    data_no_marks = {
        "board": {"size": 5, "black": ["C3"], "white": [], "marks": []},
        "expectedAnswer": "4",
        "question": "How many氣?",
    }
    errors = asyncio.run(validate_go_board_numeric(data_no_marks, None))
    assert any("marks' 欄位為空" in err for err in errors)

