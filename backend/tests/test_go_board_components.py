import asyncio

from app.schemas.lesson_schema import Feedback, GenericConfig, LessonStage, Validation
from app.services.domain.learning.go_puzzle_bank import (
    GO_COMPONENTS,
    _load_bank,
    apply_go_puzzle_bank,
    random_go_puzzle,
)
from app.services.domain.learning.lesson_components.evaluators import (
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
                "expectedAnswer": "1",
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


def _bank_stage(component, data):
    return LessonStage(
        stageId="go-bank",
        topic="圍棋",
        skin="Scientific",
        component=_map_legacy_component(component),
        validation=Validation(type="exact", condition={"answer": data["expectedAnswer"]}),
        feedback=Feedback(success="正確", error="再想想"),
        config=GenericConfig(data=data, initialState={}),
    )


def test_puzzle_bank_has_all_types_and_is_5x5():
    bank = _load_bank()
    assert GO_COMPONENTS <= set(bank.keys())
    for component in GO_COMPONENTS:
        puzzles = bank[component]
        assert len(puzzles) >= 15, f"{component} only has {len(puzzles)} puzzles"
        for puzzle in puzzles:
            board = puzzle["board"]
            assert len(board) == 5 and all(len(row) == 5 for row in board)
            assert puzzle["question"] and puzzle["explanation"]


def test_every_bank_puzzle_grades_its_own_answer_correct():
    bank = _load_bank()
    for component in GO_COMPONENTS:
        for puzzle in bank[component]:
            stage = _bank_stage(component, puzzle)
            status, *_ = asyncio.run(
                evaluate_go_board(stage, {"answer": puzzle["expectedAnswer"]}, "圍棋", None)
            )
            assert status == "correct", f"{component} {puzzle['board']} -> {puzzle['expectedAnswer']}"


def test_bank_accepts_alternate_answers_and_rejects_wrong():
    # Some coordinate puzzles (cut/connect/atari) have several correct points;
    # every listed point must be accepted and a bogus one rejected.
    bank = _load_bank()
    component, multi = next(
        (component, puzzle)
        for component in GO_COMPONENTS
        for puzzle in bank[component]
        if len(puzzle.get("acceptableAnswers", [])) > 1
    )
    stage = _bank_stage(component, multi)
    for good in multi["acceptableAnswers"]:
        assert asyncio.run(evaluate_go_board(stage, {"answer": good}, "圍棋", None))[0] == "correct"
    assert asyncio.run(evaluate_go_board(stage, {"answer": "Z9"}, "圍棋", None))[0] == "incorrect"


def test_apply_go_puzzle_bank_replaces_go_board():
    stage = _bank_stage(
        "GoCaptureStones",
        {"question": "ai", "board": ["....."], "expectedAnswer": "ZZ"},
    )
    apply_go_puzzle_bank([stage])
    data = stage.config.data
    assert data["board"]["size"] == 5
    assert isinstance(data["board"]["black"], list)
    assert data["expectedAnswer"] != "ZZ"
    assert data.get("explanation")
