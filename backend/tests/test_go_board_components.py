import asyncio

from app.schemas.lesson_schema import Feedback, GenericConfig, LessonStage, Validation
from app.services.domain.learning.lesson_components.evaluators import (
    count_marked_group_liberties,
    evaluate_go_board,
    find_capturing_moves,
)


def _liberties_stage(board, expected_answer):
    return LessonStage(
        stageId="go-lib",
        topic="圍棋數氣",
        skin="Scientific",
        component="GoCountLiberties",
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
        component="GoCaptureStones",
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


def test_go_board_evaluator_accepts_coordinate_answers():
    stage = LessonStage(
        stageId="go-1",
        topic="圍棋數氣",
        skin="Scientific",
        component="GoCountLiberties",
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
