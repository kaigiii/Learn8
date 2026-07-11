# 圍棋 AI 棋譜生成校驗與多輪解耦 Agent 實作計劃書 (施工藍圖版)

本計劃書為 Learn8 專案在「純 AI 驅動」的圍棋關卡生成中，解決**棋盤座標（`black`, `white`, `marks`）與教學題意無法對齊**的終極施工藍圖。

我們將廢除所有硬編碼的圍棋規則提示，全面採用 **YAML 驅動** 與 **多輪解耦 Agent 管道**。校驗機制則採用**「第一、二層程式碼物理防線 + 第三層 AI 語義校驗」**的混合驗證模型，並透過 **組件校驗註冊器 (Validator Registry)** 進行優雅的泛化。

---

## 1. 系統架構與資料流 (Architecture & Data Flow)

整個關卡生成流程將被拆分為三層解耦管道，其執行序列與狀態轉移如下：

```
                    ┌────────────────────────┐
                    │  1. 課程大綱生成階段   │ (Agent 1 - Syllabus Architect)
                    │  (依據教材生成 Stage)   │ - 僅輸出 question, explanation 與 
                    └───────────┬────────────┘   board_blueprint (文字相對棋局藍圖)
                                │
                                ▼ (過濾出含有 board_blueprint 欄位的 Stage)
                    ┌────────────────────────┐
                    │  2. 並行座標翻譯階段   │ (Agent 2 - Board Placer)
                    │  (asyncio.gather 執行)  │ - 將 blueprint 翻譯為 
                    └───────────┬────────────┘   size, black, white, marks, expectedAnswer
                                │
                                ▼
                    ┌────────────────────────┐
                    │  3. 雙層混合校驗階段   │ (Validator Registry)
                    │  (Programmatic + AI)   │
                    └───────────┬────────────┘
                                │
                                ├─► [第一層：物理校驗 (Code)] ──❌ 失敗 ──┐
                                │   - 重疊、越界檢查                      │
                                │                                         │
                                ├─► [第二層：狀態校驗 (Code)] ──❌ 失敗 ──┤
                                │   - 自殺、落子前死子檢查                │
                                │                                         │
                                ├─► [第三層：語義校驗 (AI)] ────❌ 失敗 ──┤
                                │   - 模擬驗證題意與棋盤是否一致          │
                                │                                         │
                                │                                         ▼ (錯誤反饋)
                                │                      ┌────────────────────────────┐
                                │                      │ 重新呼叫 Agent 2 (最多3次)  │
                                │                      └─────────────┬──────────────┘
                                │                                    ▲ (若 3 次均失敗)
                                │                                    │ 回滾至 Agent 1
                                ▼ ⭕ 三層皆通過                       │ 重新生成藍圖
                    ┌────────────────────────┐                      │ (最多 1 次)
                    │ 4. 欄位清理與整合階段  │                      │
                    │ (刪除 blueprint)       ├──────────────────────┘
                    │ 返回 100% 正確的 Stage │
                    └────────────────────────┘
```

---

## 2. 施工細節與模組設計 (Implementation Blueprint)

### 2.1 Step 1: YAML 驅動配置 (Component Schema)
我們修改 [GoBoardCoordinate.yaml](file:///Users/kaigiii/Coding/Learn8/backend/data/game_modules/GoBoardCoordinate.yaml) 與 [GoBoardNumeric.yaml](file:///Users/kaigiii/Coding/Learn8/backend/data/game_modules/GoBoardNumeric.yaml)，使大綱規劃師 (Agent 1) 不再被迫直接輸出坐標：

* **required_config_data_fields**：`["question", "board_blueprint"]`
* **optional_config_data_fields**：`["explanation", "playerColor", "board", "expectedAnswer", "acceptableAnswers"]`

---

### 2.2 Step 2: Syllabus Architect (Agent 1) Prompt 清理
* **檔案異動**：[course_architect_prompts.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_engine/agents/course_architect_prompts.py)
* **實作內容**：
  - 徹底刪除硬編碼的 `GO_PUZZLE_GUIDE` 全域字串。
  - 移除 `build_node_system_prompt` 中對 `VAR_GO_GUIDE` 的替換邏輯。
  - 確保 Agent 1 僅依據組件 YAML 的 description 知道自己只需要輸出 `board_blueprint` (無絕對座標的棋局文字說明)。

---

### 2.3 Step 3: Board Placer (Agent 2) 座標翻譯師
* **檔案異動**：[course_architect.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_engine/agents/course_architect.py)
* **設計要點**：
  - 新增專屬的 Pydantic 輸出 Schema:
    ```python
    class BoardPlacerOutput(BaseModel):
        size: int = Field(description="棋盤尺寸，通常為 5, 9, 13 或 19")
        black: List[str] = Field(description="所有黑子的座標列表，例如 ['C4', 'E4']")
        white: List[str] = Field(description="所有白子的座標列表，例如 ['D3']")
        marks: List[str] = Field(description="需要疊加標記符號(X)的座標列表，例如 ['C4']")
        expectedAnswer: str = Field(description="正確的落子點或答案值，例如 'C4' 或 '3'")
        acceptableAnswers: List[str] = Field(description="所有可接受的正確落子點列表，例如 ['C4']")
    ```
  - **Agent 2 專用提示詞**：包含圍棋座標系細則（A-T 橫列，跳過 I，從下往上數 1-N），並強制規定不可產生超出 `size` 的座標。

---

### 2.4 Step 4: 雙層混合校驗 (Validator Registry Pattern)
我們實作泛化註冊機制，並將驗證職責精準拆分。

#### 檔案 A: [validator_registry.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/domain/learning/lesson_components/validator_registry.py) [NEW]
```python
from typing import Callable, Dict, List, Any

# 驗證器接口：輸入 data 字典與額外的 llm_provider（供語義驗證使用），回傳錯誤字串列表
Validator = Callable[[dict, Any], List[str]]

class LessonComponentValidatorRegistry:
    def __init__(self) -> None:
        self._validators: Dict[str, Validator] = {}

    def register(self, component: str, validator: Validator) -> None:
        self._validators[component] = validator

    def get(self, component: str) -> Validator | None:
        return self._validators.get(component)

validator_registry = LessonComponentValidatorRegistry()
```

#### 檔案 B: [validators.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/domain/learning/lesson_components/validators.py) [NEW]
我們在此實作 `GoBoardCoordinate` 與 `GoBoardNumeric` 的驗證邏輯：

```python
import asyncio
from app.services.domain.learning.lesson_components.go_rules_engine import GoRulesEngine
from app.services.domain.learning.lesson_components.evaluators import _normalize_stone_color
from app.services.domain.learning.lesson_components.validator_registry import validator_registry

def check_physical_and_state_rules(board: dict, expected_answer: str, player_color: str) -> List[str]:
    """第一、二層程式碼校驗：物理邊界、棋子重疊、落子前死棋與自殺判定"""
    errors = []
    engine = GoRulesEngine(board)
    if not engine.grid:
        return ["無法解析棋盤網格。"]

    size = board.get("size", 9)
    black_set = set(board.get("black", []))
    white_set = set(board.get("white", []))

    # 1. 重疊檢查
    overlap = black_set & white_set
    if overlap:
        errors.append(f"黑子與白子座標重疊：{list(overlap)}")

    # 2. 邊界檢查
    for coord in black_set | white_set | set(board.get("marks", [])):
        r, c = engine.coord_to_idx(coord)
        if not engine.in_bounds(r, c):
            errors.append(f"棋子座標超出棋盤邊界 ({size}x{size})：{coord}")

    # 3. 預期答案邊界與重疊檢查
    if expected_answer:
        ar, ac = engine.coord_to_idx(expected_answer)
        if not engine.in_bounds(ar, ac):
            errors.append(f"預期答案座標越界：{expected_answer}")
        elif engine.grid[ar][ac] != ".":
            errors.append(f"預期答案座標已落有棋子：{expected_answer}")

    if errors:
        return errors # 若物理規則已破損，直接返回

    # 4. 落子前死子檢查 (棋盤上現存的每一塊棋必須至少有 1 口氣)
    visited = set()
    for r in range(engine.rows):
        for c in range(engine.cols):
            if engine.grid[r][c] != "." and (r, c) not in visited:
                group, libs = engine.get_group(r, c)
                visited.update(group)
                if not libs:
                    coord_str = engine.get_coord_str(r, c)
                    errors.append(f"落子前，棋盤上已存在無氣的死棋塊，包含座標 {coord_str} (顏色: {engine.grid[r][c]})。")

    # 5. 自殺檢查 (玩家落子在答案點後，該棋塊不能為 0 氣，除非能提掉對手的子)
    if expected_answer:
        ar, ac = engine.coord_to_idx(expected_answer)
        if engine.in_bounds(ar, ac):
            virtual_grid = engine.place_stone_virtual(ar, ac, player_color)
            _, post_libs = engine.get_group(ar, ac, grid_override=virtual_grid)
            if not post_libs:
                errors.append(f"玩家 '{player_color}' 落子在 '{expected_answer}' 會導致自殺，該動作不合法。")

    return errors


async def validate_go_board_coordinate(data: dict, llm_provider: Any) -> List[str]:
    board = data.get("board", {})
    expected_answer = data.get("expectedAnswer")
    player_color = _normalize_stone_color(data.get("playerColor")) or "B"

    # 執行第一、二層程式碼校驗
    errors = check_physical_and_state_rules(board, expected_answer, player_color)
    if errors:
        return errors

    # 執行第三層 AI 語義校驗
    try:
        blueprint = data.get("board_blueprint", "無文字描述")
        question = data.get("question", "")
        explanation = data.get("explanation", "")

        verification_prompt = (
            "你是一位嚴格的圍棋裁判助理。請在腦中模擬落子，核對以下生成內容是否存在邏輯或題意矛盾。\n\n"
            f"【問題文字】：{question}\n"
            f"【落子方顏色】：{'黑棋' if player_color == 'B' else '白棋'}\n"
            f"【題目文字藍圖描述】：{blueprint}\n"
            f"【生成的座標棋盤配置】：黑子: {board.get('black')}, 白子: {board.get('white')}, 標記: {board.get('marks')}\n"
            f"【預期正確解答座標】：{expected_answer}\n"
            f"【解析說明】：{explanation}\n\n"
            "請仔細檢查：\n"
            "1. 結合棋盤佈局，當落方下在預期解答點後，是否能完美實現問題和藍圖所要求的目的（如成功提子、逃跑、連接或完成死活要點）？\n"
            "2. 題目描述與實體棋盤座標有沒有產生矛盾？\n\n"
            "如果沒有任何邏輯或題意問題，請輸出 'YES'。如果發現任何邏輯矛盾、棋子畫錯或答案不對，請直接輸出 'NO' 並簡短說明錯誤原因（不超過150字）。"
        )

        messages = [("system", "你只會回答 YES 或 NO (若為 NO 則附加理由)。"), ("user", verification_prompt)]
        raw_reply = await llm_provider.generate_text(messages)
        reply = raw_reply.strip()

        if reply.upper().startswith("NO"):
            errors.append(f"第三層 AI 語義校驗未通過：{reply}")
    except Exception as e:
        errors.append(f"語義校驗調用異常：{str(e)}")

    return errors


async def validate_go_board_numeric(data: dict, llm_provider: Any) -> List[str]:
    board = data.get("board", {})
    expected_answer = data.get("expectedAnswer")
    player_color = _normalize_stone_color(data.get("playerColor")) or "B"

    # 執行第一、二層程式碼校驗
    errors = check_physical_and_state_rules(board, expected_answer, player_color)
    if errors:
        return errors

    # 氣數與地盤規則的精準程式碼比對
    try:
        engine = GoRulesEngine(board)
        question = data.get("question", "")
        
        if "氣" in question:
            if not engine.marks:
                errors.append("氣數題但 'board.marks' 欄位為空，無法判斷該數哪顆子的氣。")
            else:
                computed = engine.count_marked_group_liberties()
                if computed is None:
                    errors.append("計算氣數失敗。")
                elif str(computed) != str(expected_answer).strip():
                    # 自動補正答案
                    data["expectedAnswer"] = str(computed)
                    
        elif "目" in question or "地" in question:
            computed = engine.count_black_territory()
            if str(computed) != str(expected_answer).strip():
                # 自動補正答案
                data["expectedAnswer"] = str(computed)
    except Exception as e:
        errors.append(f"氣數/目數程式碼核對出錯：{str(e)}")

    return errors

# 註冊至全域 Registry
validator_registry.register("GoBoardCoordinate", validate_go_board_coordinate)
validator_registry.register("GoBoardNumeric", validate_go_board_numeric)
```

---

## 3. 雙層重試控制與並行排程 (Orchestration & Retry Loop)

在 `AIArchitectService` 中，我們依據下列算法調度 Agent 2、執行校驗與重試：

```python
async def _process_go_placements(self, stages: List[LessonStage]) -> None:
    """找出所有需要填滿棋盤座標的 Go 關卡，啟動並行生成與輕量重試"""
    go_stages = [s for s in stages if s.component in ("GoBoardCoordinate", "GoBoardNumeric")]
    if not go_stages:
        return

    async def generate_and_verify_single_stage(stage: LessonStage) -> None:
        data = stage.config.data
        blueprint = data.get("board_blueprint")
        if not blueprint:
            return

        placer_prompt = (
            f"請將下列圍棋關卡的文字藍圖翻譯成二維坐標配置 JSON。\n\n"
            f"【問題要求】：{data.get('question')}\n"
            f"【文字藍圖描述】：{blueprint}\n\n"
            "請注意座標極限，如果是 9x9，縱橫座標範圍不可超出 1-9 和 A-J。"
        )

        max_placer_retries = 3
        placer_errors = []

        for attempt in range(max_placer_retries):
            try:
                # 呼叫 Agent 2 翻譯坐標 (結構化輸出)
                placer_out = await self.provider.generate_structured(
                    [("system", BOARD_PLACER_SYSTEM_PROMPT), ("user", placer_prompt + (f"\n\n修正反饋：\n{placer_errors[-1]}" if placer_errors else ""))],
                    BoardPlacerOutput
                )
                
                # 將產出合併回 config.data
                data["board"] = {
                    "size": placer_out.size,
                    "black": placer_out.black,
                    "white": placer_out.white,
                    "marks": placer_out.marks
                }
                data["expectedAnswer"] = placer_out.expectedAnswer
                data["acceptableAnswers"] = placer_out.acceptableAnswers
                data["puzzleType"] = placer_out.puzzleType

                # 呼叫全域驗證器進行三層校驗
                validator = validator_registry.get(stage.component)
                if validator:
                    errors = await validator(data, self.provider)
                    if not errors:
                        # 校驗成功！清除臨時藍圖欄位
                        data.pop("board_blueprint", None)
                        return
                    else:
                        placer_errors.append(f"第 {attempt+1} 次驗證失敗：{errors}")
            except Exception as e:
                placer_errors.append(f"第 {attempt+1} 次座標生成異常：{e}")

        # 若 Agent 2 失敗 3 次，拋出異常，將回滾邏輯交給上層，引導 Agent 1 重新出題
        raise ValueError(f"關卡 {stage.stageId} 棋盤坐標翻譯失敗。錯誤細節：{placer_errors}")

    try:
        # 使用 asyncio.gather 並行執行所有 Go 關卡的座標繪製
        await asyncio.gather(*(generate_and_verify_single_stage(s) for s in go_stages))
    except Exception as e:
        # 重試控制：在此攔截 ValueError 並向上傳遞，觸發全單元 Agent 1 的 Fallback 重生 (最多 1 次)
        raise e
```

---

## 4. 驗證計劃 (Verification Plan)

### 4.1 自動化單元測試
我們將在 `backend/tests/test_go_board_components.py` 新增針對校驗器的單元測試：
- 測試一個合法的吃子棋盤，預期驗證通過。
- 測試黑白子重疊（如都在 C4）、座標越界（9x9 盤面有 K10）的棋盤，預期物理校驗報警。
- 測試落子前已有死棋的棋盤，預期物理校驗報警。
- 模擬 `validate_go_board_coordinate` 調用，確認當預期答案不合邏輯時（如要求吃子但沒有提子），AI 語義驗證能成功識別並報錯。

### 4.2 端到端生成測試
- 調用課程 Stage 生成 API，故意提供圍棋 node，觀察終端日誌中的並行呼叫。
- 確認產出的 Stage JSON 中已不含 `board_blueprint`，而 `board` 欄位已被正確鋪平，答案經由 Rules Engine 校正無誤。
