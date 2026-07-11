import asyncio
from typing import List, Any
from app.services.domain.learning.lesson_components.go.rules_engine import GoRulesEngine
from app.services.domain.learning.lesson_components.go.evaluators import _normalize_stone_color
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
    import re
    is_coordinate = bool(expected_answer and re.match(r"^[A-Z]\d+$", expected_answer.strip().upper()))

    if is_coordinate:
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
    if is_coordinate:
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
            "1. 結合棋盤佈局，當落子方下在預期解答點後，是否能完美實現問題和藍圖所要求的目的（如成功提子、逃跑、連接或完成死活要點）？\n"
            "2. 題目描述與實體棋盤座標有沒有產生矛盾？\n\n"
            "如果沒有任何邏輯或題意問題，請輸出 'YES'。如果發現 any 邏輯矛盾、棋子畫錯或答案不對，請直接輸出 'NO' 並簡短說明錯誤原因（不超過150字）。"
        )

        messages = [
            ("system", "你只會回答 YES 或 NO (若為 NO 則附加理由)。"),
            ("user", verification_prompt)
        ]
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
