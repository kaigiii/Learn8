import pytest
import asyncio
import logging
from typing import List, Any, Type
from pydantic import BaseModel

from app.schemas.course_schema import CoursePath, Unit, LessonNode
from app.domain.statuses import NodeStatus
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.services.ai_engine.agents.syllabus_agent import SyllabusAgent, AuditorOutput, ActionItem, ActionType
from app.schemas.lesson_schema import LessonStage, GenericConfig, Validation, Feedback
from app.services.domain.learning.lesson_components.go.placer import place_go_board, BoardPlacerOutput

# --- MOCK LLM PROVIDER ---

class MockSyllabusLLMProvider(BaseLLMProvider):
    def __init__(self, course_draft: CoursePath, auditor_responses: List[AuditorOutput]):
        super().__init__()
        self.course_draft = course_draft
        self.auditor_responses = auditor_responses
        self.auditor_call_count = 0
        self.planner_called = False

    def bind_files(self, files: List[str], use_google_file_api: bool = True) -> "MockSyllabusLLMProvider":
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        return "Mock plain text"

    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        if schema == CoursePath:
            self.planner_called = True
            return self.course_draft
        elif schema == AuditorOutput:
            if self.auditor_call_count < len(self.auditor_responses):
                resp = self.auditor_responses[self.auditor_call_count]
                self.auditor_call_count += 1
                return resp
            else:
                return AuditorOutput(reflection_critique=None, actions=[], is_complete=True)
        raise ValueError(f"Unexpected schema requested: {schema}")


class MockGoPlacerLLMProvider(BaseLLMProvider):
    def __init__(self, placers: List[BoardPlacerOutput], semantic_replies: List[str]):
        super().__init__()
        self.placers = placers
        self.semantic_replies = semantic_replies
        self.placer_call_count = 0
        self.semantic_call_count = 0

    def bind_files(self, files: List[str], use_google_file_api: bool = True) -> "MockGoPlacerLLMProvider":
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        if self.semantic_call_count < len(self.semantic_replies):
            reply = self.semantic_replies[self.semantic_call_count]
            self.semantic_call_count += 1
            return reply
        return "YES"

    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        if schema == BoardPlacerOutput:
            if self.placer_call_count < len(self.placers):
                resp = self.placers[self.placer_call_count]
                self.placer_call_count += 1
                return resp
            raise ValueError("Out of configured placer outputs.")
        raise ValueError(f"Unexpected schema requested: {schema}")


# --- TESTS ---

def test_two_stage_syllabus_generation(caplog):
    """
    1. Confirm course outline generation two-stage (Planner & Auditor) is correctly called.
    We mock a Planner draft, followed by an Auditor turn that updates course title and adds a node.
    """
    initial_draft = CoursePath(
        courseTitle="Initial Course Draft",
        units=[
            Unit(
                unitId="u1",
                unitTitle="Unit 1",
                unitDescription="Intro",
                nodes=[
                    LessonNode(
                        id="n1",
                        title="Node 1",
                        description="First node",
                        status=NodeStatus.LOCKED
                    )
                ]
            )
        ]
    )

    auditor_turn_1 = AuditorOutput(
        reflection_critique="Course title needs updating, and let's add Node 2.",
        actions=[
            ActionItem(
                action_type=ActionType.UPDATE_COURSE_METADATA,
                courseTitle="Final Course Outline"
            ),
            ActionItem(
                action_type=ActionType.INSERT_NODES,
                unit_id="u1",
                nodes=[
                    LessonNode(
                        id="n2",
                        title="Node 2",
                        description="Second node",
                        status=NodeStatus.LOCKED
                    )
                ]
            )
        ],
        is_complete=False
    )

    auditor_turn_2 = AuditorOutput(
        reflection_critique=None,
        actions=[],
        is_complete=True
    )

    mock_provider = MockSyllabusLLMProvider(initial_draft, [auditor_turn_1, auditor_turn_2])
    agent = SyllabusAgent(mock_provider)

    progress_messages = []
    def progress_cb(progress, msg):
        progress_messages.append((progress, msg))

    # Capture logs under 'app.services.ai_engine.agents.syllabus_agent'
    with caplog.at_level(logging.INFO, logger="app.services.ai_engine.agents.syllabus_agent"):
        result = asyncio.run(agent.run(topic="Testing Multi-Agent Syllabus", progress_callback=progress_cb))

    # Assertions on the output
    assert result is not None
    assert result.courseTitle == "Final Course Outline"
    assert len(result.units[0].nodes) == 2
    assert result.units[0].nodes[1].id == "n2"
    # First node is unlocked as per SyllabusAgent.run's final logic
    assert result.units[0].nodes[0].status == NodeStatus.AVAILABLE

    # Assertions on call progression
    assert mock_provider.planner_called is True
    assert mock_provider.auditor_call_count == 2

    # Assertions on Logs
    log_text = caplog.text
    assert "Starting Multi-Agent generation for 'Testing Multi-Agent Syllabus'" in log_text
    assert "Blueprint Draft generated with 1 units" in log_text
    assert "Review successfully completed in 2 turns" in log_text

    # Assertions on Progress Callback Messages
    progress_texts = [msg for prog, msg in progress_messages]
    assert any("正在啟動 AI 審查機制，檢核「Testing Multi-Agent Syllabus」課程細部節點" in t for t in progress_texts)
    assert any("正在為「Testing Multi-Agent Syllabus」進行第 1 次深度審核與單元微調" in t for t in progress_texts)
    assert any("正在優化課程大綱中的單元結構" in t for t in progress_texts)
    assert any("正在為「Testing Multi-Agent Syllabus」進行第 2 次深度審核與單元微調" in t for t in progress_texts)
    assert any("課程大綱生成與審核完成，規劃出 1 個單元" in t for t in progress_texts)



def test_go_puzzle_validation_loop_success(caplog):
    """
    2. Confirm Go puzzle generation validation loop actually goes to validation test.
    Case A: Validation succeeds on the first attempt.
    """
    stage = LessonStage(
        stageId="go-test-stage",
        topic="圍棋關卡",
        skin="Scientific",
        component="GoBoardCoordinate",
        validation=Validation(type="exact", condition={}),
        feedback=Feedback(success="Correct", error="Wrong"),
        config=GenericConfig(
            data={
                "question": "黑棋下在哪裡可以吃掉白棋？",
                "playerColor": "B",
                "board_blueprint": "Place a black stone to capture white stone at D3",
            },
            initialState={}
        )
    )

    placer_out = BoardPlacerOutput(
        thoughtProcess="Let's capture the white stone at D3 by playing at C3.",
        size=9,
        black=["C4", "E4"],
        white=["D3"],
        marks=[],
        expectedAnswer="C3",
        acceptableAnswers=["C3"],
        puzzleType="capture"
    )

    mock_provider = MockGoPlacerLLMProvider(
        placers=[placer_out],
        semantic_replies=["YES"] # AI semantic check passes
    )

    with caplog.at_level(logging.INFO, logger="activity_logger"):
        asyncio.run(place_go_board(stage, mock_provider))

    # Verify that the stage data is correctly updated
    assert stage.config.data["board"]["size"] == 9
    assert stage.config.data["expectedAnswer"] == "C3"
    assert "board_blueprint" not in stage.config.data
    assert stage.validation.condition["answer"] == "C3"

    # Verify that the log indicates successful validation
    assert "Go Board Placer validation passed at attempt 1" in caplog.text


def test_go_puzzle_validation_loop_retry_and_pass(caplog):
    """
    Case B: Validation fails on first attempt (due to overlapping coordinates), but succeeds on second attempt.
    """
    stage = LessonStage(
        stageId="go-test-stage-retry",
        topic="圍棋關卡",
        skin="Scientific",
        component="GoBoardCoordinate",
        validation=Validation(type="exact", condition={}),
        feedback=Feedback(success="Correct", error="Wrong"),
        config=GenericConfig(
            data={
                "question": "黑棋下在哪裡？",
                "playerColor": "B",
                "board_blueprint": "Place black stone",
            },
            initialState={}
        )
    )

    # Attempt 1: Overlapping coordinates (black and white at C4)
    placer_out_fail = BoardPlacerOutput(
        thoughtProcess="Placing stones on C4 overlap error.",
        size=9,
        black=["C4"],
        white=["C4"], # Overlap!
        marks=[],
        expectedAnswer="C3",
        acceptableAnswers=["C3"],
        puzzleType="general"
    )

    # Attempt 2: Correctly placed stones
    placer_out_pass = BoardPlacerOutput(
        thoughtProcess="Correct positioning of stones.",
        size=9,
        black=["C4"],
        white=["D3"],
        marks=[],
        expectedAnswer="C3",
        acceptableAnswers=["C3"],
        puzzleType="general"
    )

    mock_provider = MockGoPlacerLLMProvider(
        placers=[placer_out_fail, placer_out_pass],
        semantic_replies=["YES"]
    )

    with caplog.at_level(logging.INFO, logger="activity_logger"):
        asyncio.run(place_go_board(stage, mock_provider))

    # Verify second attempt passed and updated the stage
    assert stage.config.data["board"]["white"] == ["D3"]
    assert "Go Board Placer attempt 1 failed validation: 黑子與白子座標重疊" in caplog.text
    assert "Go Board Placer validation passed at attempt 2" in caplog.text


def test_go_puzzle_validation_loop_max_retries_fail(caplog):
    """
    Case C: Validation fails continuously, triggering ValueError after 3 attempts.
    """
    stage = LessonStage(
        stageId="go-test-stage-fail",
        topic="圍棋關卡",
        skin="Scientific",
        component="GoBoardCoordinate",
        validation=Validation(type="exact", condition={}),
        feedback=Feedback(success="Correct", error="Wrong"),
        config=GenericConfig(
            data={
                "question": "黑棋下在哪裡？",
                "playerColor": "B",
                "board_blueprint": "Place black stone",
            },
            initialState={}
        )
    )

    # Always return suicide coordinate (e.g. black stone at C3 surrounded by white)
    placer_out_suicide = BoardPlacerOutput(
        thoughtProcess="Place black stone on suicide coordinate C3.",
        size=5,
        black=[],
        white=["C4", "C2", "B3", "D3"],
        marks=[],
        expectedAnswer="C3", # Suicide!
        acceptableAnswers=["C3"],
        puzzleType="general"
    )

    mock_provider = MockGoPlacerLLMProvider(
        placers=[placer_out_suicide, placer_out_suicide, placer_out_suicide],
        semantic_replies=[]
    )

    with pytest.raises(ValueError) as excinfo:
        asyncio.run(place_go_board(stage, mock_provider))

    assert "Go Board Coordinate Placer failed after 3 attempts" in str(excinfo.value)
    
    # Assert logs for all three failed attempts
    log_text = caplog.text
    assert "Go Board Placer attempt 1 failed validation" in log_text
    assert "Go Board Placer attempt 2 failed validation" in log_text
    assert "Go Board Placer attempt 3 failed validation" in log_text


def test_go_board_evaluator_legacy_fallback():
    """
    Ensure that when acceptableAnswers is empty or missing (e.g. legacy data),
    grading falls back to matching expectedAnswer.
    """
    stage = LessonStage(
        stageId="go-legacy",
        topic="圍棋關卡",
        skin="Scientific",
        component="GoBoardCoordinate",
        validation=Validation(type="exact", condition={"answer": "C3"}),
        feedback=Feedback(success="Correct", error="Wrong"),
        config=GenericConfig(
            data={
                "question": "黑棋下在哪裡？",
                "playerColor": "B",
                "board": {
                    "size": 9,
                    "black": ["C4"],
                    "white": ["D3"],
                },
                "expectedAnswer": "C3",
                # acceptableAnswers is missing
            },
            initialState={}
        )
    )
    
    from app.services.domain.learning.lesson_components.go.evaluators import evaluate_go_board
    
    # Correct answer should pass
    result_correct = asyncio.run(evaluate_go_board(stage, {"answer": "C3"}, "圍棋", None))
    assert result_correct[0] == "correct"
    
    # Coordinates matched case-insensitively
    result_correct_case = asyncio.run(evaluate_go_board(stage, {"answer": "c3"}, "圍棋", None))
    assert result_correct_case[0] == "correct"
    
    # Incorrect answer should fail
    result_incorrect = asyncio.run(evaluate_go_board(stage, {"answer": "A1"}, "圍棋", None))
    assert result_incorrect[0] == "incorrect"

