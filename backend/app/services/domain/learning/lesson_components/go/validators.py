import asyncio
import io
import base64
from typing import List, Any
from PIL import Image, ImageDraw, ImageFont
from app.services.domain.learning.lesson_components.go.rules_engine import GoRulesEngine
from app.services.domain.learning.lesson_components.go.evaluators import _normalize_stone_color
from app.services.domain.learning.lesson_components.validator_registry import validator_registry

def render_go_board(board_data: dict) -> bytes:
    """利用 Pillow 渲染圍棋盤面配置成 PNG 圖片，並於四周標記 A-T / 1-N 座標標籤"""
    size = board_data.get("size", 9)
    black = board_data.get("black", [])
    white = board_data.get("white", [])
    marks = board_data.get("marks", [])
    
    img_size = 400
    margin = 40
    # 建立畫布，溫暖的木色背景
    image = Image.new("RGB", (img_size, img_size), color="#E4A853")
    draw = ImageDraw.Draw(image)
    
    # 計算網格大小
    if size > 1:
        cell_size = (img_size - 2 * margin) / (size - 1)
    else:
        cell_size = 0
        
    # 繪製網格線
    for i in range(size):
        offset = margin + i * cell_size
        # 直線
        draw.line([(offset, margin), (offset, img_size - margin)], fill="#000000", width=1)
        # 橫線
        draw.line([(margin, offset), (img_size - margin, offset)], fill="#000000", width=1)
        
    # 載入字型
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
        
    # 繪製欄位標籤 A-T (跳過欄位無特殊定義時，ord-based A, B, C...)
    for i in range(size):
        col_letter = chr(65 + i)
        offset = margin + i * cell_size
        draw.text((offset - 3, margin - 20), col_letter, fill="#000000", font=font)
        draw.text((offset - 3, img_size - margin + 5), col_letter, fill="#000000", font=font)
        
    # 繪製列數標籤 1-N (由下往上)
    for j in range(size):
        row_num = str(j + 1)
        offset = img_size - margin - j * cell_size
        draw.text((margin - 20, offset - 5), row_num, fill="#000000", font=font)
        draw.text((img_size - margin + 10, offset - 5), row_num, fill="#000000", font=font)
        
    # 棋子半徑
    stone_r = (cell_size * 0.45) if size > 1 else 15
    
    def coord_to_px(coord: str):
        coord = coord.strip().upper()
        if len(coord) < 2:
            return None
        col_letter = coord[0]
        try:
            row_num = int(coord[1:])
        except ValueError:
            return None
        c_idx = ord(col_letter) - 65
        r_idx = row_num - 1
        cx = margin + c_idx * cell_size
        cy = img_size - margin - r_idx * cell_size
        return cx, cy

    # 畫黑子
    for coord in black:
        pos = coord_to_px(coord)
        if pos:
            cx, cy = pos
            draw.ellipse([cx - stone_r, cy - stone_r, cx + stone_r, cy + stone_r], fill="#111111", outline="#000000", width=1)
            
    # 畫白子
    for coord in white:
        pos = coord_to_px(coord)
        if pos:
            cx, cy = pos
            draw.ellipse([cx - stone_r, cy - stone_r, cx + stone_r, cy + stone_r], fill="#FFFFFF", outline="#777777", width=1)
            
    # 畫紅色 X 標記
    for coord in marks:
        pos = coord_to_px(coord)
        if pos:
            cx, cy = pos
            mark_size = stone_r * 0.5
            draw.line([(cx - mark_size, cy - mark_size), (cx + mark_size, cy + mark_size)], fill="#FF0000", width=2)
            draw.line([(cx + mark_size, cy - mark_size), (cx - mark_size, cy + mark_size)], fill="#FF0000", width=2)
            
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


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

    # 執行第三層 AI 語義多模態視覺校驗
    try:
        blueprint = data.get("board_blueprint", "無文字描述")
        question = data.get("question", "")
        explanation = data.get("explanation", "")

        verification_prompt = (
            "You are a strict Go referee assistant. Please verify whether the following setup matches the attached board image and question logic.\n\n"
            f"- Question: {question}\n"
            f"- Player Color: {'Black' if player_color == 'B' else 'White'}\n"
            f"- Board Blueprint: {blueprint}\n"
            f"- Coordinates: Black: {board.get('black')}, White: {board.get('white')}, Marks: {board.get('marks')}\n"
            f"- Expected Play Coordinate: {expected_answer}\n"
            f"- Explanation: {explanation}\n\n"
            "Analyze the image and setup step-by-step:\n"
            "1. List each stone coordinate shown on the image and verify if it matches the 'Coordinates' list.\n"
            "2. Note the board orientation: columns are A-T from left to right, rows are 1-N from bottom to top.\n"
            "3. If Player plays at the Expected Play Coordinate, does it successfully achieve the goal of the Question?\n\n"
            "Output your step-by-step analysis first. Finally, end your response with exactly 'VERDICT: YES' if correct, or 'VERDICT: NO - [reason]' if there is any mistake."
        )

        from langchain_core.messages import SystemMessage, HumanMessage
        
        # 1. 渲染盤面配置成 PNG bytes
        png_bytes = render_go_board(board)
        b64_image = base64.b64encode(png_bytes).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_image}"

        # 2. 建構多模態 Prompt 訊息
        messages = [
            SystemMessage(content="You are a strict Go referee assistant. Perform a step-by-step analysis of the board image and output either 'VERDICT: YES' or 'VERDICT: NO - [reason]' at the very end."),
            HumanMessage(content=[
                {
                    "type": "text",
                    "text": verification_prompt
                },
                {
                    "type": "image_url",
                    "image_url": {"url": data_uri}
                }
            ])
        ]
        
        raw_reply = await llm_provider.generate_text(messages)
        reply = raw_reply.strip()

        # 解析 VERDICT: YES / NO
        if "VERDICT: YES" in reply.upper():
            pass
        elif "VERDICT: NO" in reply.upper():
            import re
            match = re.search(r"VERDICT:\s*NO\s*-?\s*(.*)", reply, re.IGNORECASE)
            reason = match.group(1).strip() if match else reply
            errors.append(f"第三層 AI 語義校驗未通過：{reason}")
        else:
            if "YES" not in reply.upper() or "NO" in reply.upper():
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
