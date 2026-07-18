import asyncio
import logging
from typing import List, Any
from pydantic import BaseModel, Field

from app.schemas.lesson_schema import LessonStage, Validation
from app.services.domain.learning.lesson_components.placer_registry import placer_registry
from app.services.domain.learning.lesson_components.validator_registry import validator_registry
import app.services.domain.learning.lesson_components.go.validators  # Force validator registration

activity_logger = logging.getLogger("activity_logger")

class BoardPlacerOutput(BaseModel):
    thoughtProcess: str = Field(description="Step-by-step reasoning of the coordinates and answer. You must calculate the grid coordinates and expected move reasoning here FIRST before outputting coordinate lists.")
    size: int = Field(description="Board size, usually 5, 9, 13, or 19")
    black: List[str] = Field(description="List of Black stone coordinates, e.g. ['C4', 'E4']")
    white: List[str] = Field(description="List of White stone coordinates, e.g. ['D3']")
    marks: List[str] = Field(description="List of marked coordinates, e.g. ['C4']")
    expectedAnswer: str = Field(description="The correct coordinate answer, e.g. 'C4' or a numeric value like '3'")
    acceptableAnswers: List[str] = Field(description="List of all acceptable correct coordinate answers, e.g. ['C4']")
    puzzleType: str = Field(description="The type of puzzle, one of: 'capture', 'connect', 'cut', 'escape', 'atari', 'no_entry', 'liberties', 'territory', 'general'")


BOARD_PLACER_SYSTEM_PROMPT = """You are a professional Go board coordinate mapper (Agent 2).
Your job is to translate a textual description of a Go board situation (a blueprint) and a target question into precise 2D coordinate lists.

### CRITICAL INSTRUCTION
You MUST first analyze the board size, calculate each stone's coordinate position step-by-step, verify there are no overlaps, determine the correct move, and write down this reasoning in the `thoughtProcess` field. Only then populate the other coordinate lists and expected answer.

### GO BOARD COORDINATE RULES
1. The grid coordinates use standard notation:
    - Columns are letters A-T. Do NOT skip the letter 'I'. Continuous alphabetical order is strictly used: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, where A maps to the 1st column (x=0), B to 2nd (x=1), ..., H to 8th (x=7), I to 9th (x=8), J to 10th (x=9), etc.
   - Rows are numbers 1 to N, starting from the bottom (Row 1) to the top (Row N).
   - For example, on a 9x9 board:
     - Bottom-left point is A1.
     - Top-right point is I9 (since I is the 9th column).
     - Center point is E5.
2. Ensure you place the stones EXACTLY where the blueprint describes their relative positions.
3. The size of the board must match the size requested (usually 5, 9, 13, or 19).
4. No two stones (black and white) can share the same coordinate.
5. The 'expectedAnswer' and 'acceptableAnswers' must contain coordinate strings (e.g. 'C4') or integer numbers as strings (e.g. '3') matching the question.
6. Declare the correct 'puzzleType' based on the question goal:
   - 'capture': capturing stones
   - 'connect': connecting friendly groups
   - 'cut': cutting opponent groups
   - 'escape': escaping from atari
   - 'atari': placing opponent group in atari
   - 'no_entry': forbidden suicide point
   - 'liberties': counting liberties of marked stones
   - 'territory': counting territory
   - 'general': generic/life-and-death/定式/手筋/vital point

### TEXTBOOK-QUALITY DESIGN PRINCIPLES
1. **Cleanliness & Focus**: Place ONLY the stones that are directly relevant to the problem. Do not add random background stones that distract the learner.
2. **Pedagogical Alignment**:
   - For `no_entry` (suicide point) questions: The target point must be surrounded on all sides by OPPONENT stones (with no friendly liberties remaining) to be a valid suicide point.
   - For `atari` (叫吃) questions: The target opponent group must have exactly 2 liberties before the player's move, so that playing at the correct coordinate reduces its liberties to exactly 1.
   - For `capture` (提子) questions: The target opponent group must have exactly 1 liberty remaining before the player's move, so that playing at the correct coordinate captures it.
3. **Appropriate Board Size & Center Placement**:
   - Use a `5x5` size for basic single-stone concepts (e.g., simple counting or basic suicide points).
   - Use a `9x9` size for local tactical fights (e.g., cutting, connecting, escaping, simple life-and-death shapes).
   - Position the stones near the center of the board or symmetrically on a side/corner to ensure maximum readability and textbook aesthetics.

You must output a structured JSON response matching the schema."""


async def place_go_board(stage: LessonStage, llm_provider: Any) -> None:
    """圍棋座標擺放器：負責解析 board_blueprint 並轉換為實體坐標，同時運行重試校驗。"""
    if not isinstance(stage.config.data, dict):
        return

    blueprint = stage.config.data.get("board_blueprint")
    if not blueprint:
        # 如果沒有藍圖，直接跳過不處理（可能是歷史題目或資料庫已有的題）
        return

    question = stage.config.data.get("question", "")
    player_color = stage.config.data.get("playerColor") or "B"

    # 設置最大重試次數為 3 次
    max_retries = 3
    feedback_msg = ""

    for attempt in range(max_retries):
        user_content = f"Question: {question}\nPlayer Color: {player_color}\nBlueprint: {blueprint}"
        if feedback_msg:
            user_content += f"\n\n[Previous Validation Error]: {feedback_msg}\nPlease correct the placement coordinates or expectedAnswer to resolve this error."

        messages = [
            ("system", BOARD_PLACER_SYSTEM_PROMPT),
            ("user", user_content),
        ]

        try:
            placer_out = await llm_provider.generate_structured(messages, BoardPlacerOutput)
        except Exception as e:
            activity_logger.error(f"Go Board Placer API Error: {e}")
            feedback_msg = f"API Generation Error: {e}"
            continue

        # 組裝臨時的 config.data 用於跑校驗器
        test_data = {
            "board": {
                "size": placer_out.size,
                "black": placer_out.black,
                "white": placer_out.white,
                "marks": placer_out.marks,
            },
            "expectedAnswer": placer_out.expectedAnswer,
            "acceptableAnswers": placer_out.acceptableAnswers,
            "playerColor": player_color,
            "puzzleType": placer_out.puzzleType,
            "question": question,
            "board_blueprint": blueprint,
        }

        # 呼叫註冊的校驗器執行三層檢驗
        validator = validator_registry.get(stage.component)
        if validator:
            errors = await validator(test_data, llm_provider)
        else:
            errors = []

        if not errors:
            # 校驗成功：將翻譯好的座標與答案合併進 stage.config.data
            stage.config.data["board"] = test_data["board"]
            stage.config.data["expectedAnswer"] = placer_out.expectedAnswer
            stage.config.data["acceptableAnswers"] = placer_out.acceptableAnswers
            stage.config.data["puzzleType"] = placer_out.puzzleType
            # 移除臨時的 blueprint
            stage.config.data.pop("board_blueprint", None)

            # 更新 LessonStage 上的 validation 欄位
            stage.validation = Validation(
                type="exact",
                condition={"answer": placer_out.expectedAnswer}
            )
            activity_logger.info(f"Go Board Placer validation passed at attempt {attempt + 1}")
            return
        else:
            feedback_msg = "; ".join(errors)
            activity_logger.warning(
                f"Go Board Placer attempt {attempt + 1} failed validation: {feedback_msg}"
            )

    # 3次重試均失敗，拋出錯誤以回滾
    raise ValueError(f"Go Board Coordinate Placer failed after {max_retries} attempts: {feedback_msg}")


# 註冊 Placer
placer_registry.register("GoBoardCoordinate", place_go_board)
placer_registry.register("GoBoardNumeric", place_go_board)
