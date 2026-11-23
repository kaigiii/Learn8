# 西洋棋探題組件 (ChessPuzzle) 技術實作指南 (V2.0)

本指南詳細記載了 Learn8 教學平台中 `ChessPuzzle` 模組的完整實作細節。此組件專為應對 LLM (如 Gemini) 在棋盤空間感與邏輯生成上的不足而設計，具備極高的強健性。

---

## 1. 環境依賴 (Dependencies)

若要重新實作此組件，前端需安裝以下套件：
- `chess.js`: 用於西洋棋規則驗證與 FEN 解析。
- `react-chessboard`: 用於棋盤介面渲染。
- `framer-motion`: 用於 UI 訊息動畫。

---

## 2. 後端： AI 驅動與提示詞硬化 (Backend & Prompting)

### 2.1 數據結構要求
為了提升 AI 的成功率，我們不直接要求 FEN 字串，而是要求 **8x8 矩陣**。

```yaml
# backend/game_modules/ChessPuzzle.yaml
schema_requirements: |
  config.data 必須包含：
  - board_layout: 8x8 矩陣 (Array of Arrays)。
    - 使用 PIECE SYMBOLS ONLY: P, R, N, B, Q, K (白) / p, r, n, b, q, k (黑)。
    - 空位使用 "."。
  - initial_fen: 作為備援的 FEN 字串。
  - solution_sequence: 解題步驟 (UCI 格式，如 "e2e4")。
```

### 2.2 防撞規則 (KeyError Prevention)
由於後端使用 Python 的 `.format()` 方法填充 AI Prompt，YAML 中的所有 JSON 範例大括號必須轉義。
- **原則**：所有的 `{` 必須寫成 `{{`，`}` 寫成 `}}`。

### 2.3 邏輯優先協議 (Logic-First Protocol)
Prompt 應強制要求 AI 遵循「先找棋理，再寫類比」的順序：
1. **SELECT A THEME**: 先選戰術主題（如 Fork, Pin, Skewer）。
2. **CONSTRUCT THE LOGIC**: 確保盤面合法且目標動作是唯一的最佳解。
3. **STRETCH THE ANALOGY**: 題目與課程內容（如線性代數）的結合應放在最後，不得為了硬套主題而破壞棋局。

---

## 3. 前端： 災難恢復式解析引擎 (Frontend Robust Parsing)

### 3.1 萬能格式解碼器 (`layoutToFen`)
此函數應處理 AI 可能回傳的三種變體格式：
1. **標準 2D 陣列**：`[["r", "."], ...]`
2. **物件型 Row**：`[{"a": "r", "b": "."}, ...]`
3. **稀疏列表 (Sparse List)**：特定棋子位置列表。

**核心代碼參考：**
```typescript
function layoutToFen(layout: any[]): string {
  const VALID_PIECES = /^[prnbqkPRNBQK]$/; // 關鍵：過濾 AI 產生的數字 (如 8) 或無效字符
  // ...填充 8x8 棋盤邏輯
  board[row][col] = VALID_PIECES.test(piece) ? piece : ".";
  // ...轉換為 FEN 字串帶入 (w - - 0 1)
}
```

### 3.2 三層級回退策略 (Three-Tier Fallback)
為了確保頁面不因 AI 故障而「變白」，`parseChessPuzzleStage` 採取：
1. **優先試用矩陣**：若生成的 FEN 通過 `new Chess(fen)` 測試，則採用。
2. **次要試用 initial_fen**：若矩陣毀損，嘗試使用 AI 的字串輸入。
3. **終極回退 (Default Start)**：若皆失敗，則載入標準開局盤面。

---

## 4. 遊戲邏輯與品質提升

### 4.1 提示助手 (Hint System)
當玩家使用提示時，系統會調用 `getReadableMove`。
- **規則校驗**：使用 `game.moves({ verbose: true })` 實時比對。
- **非法過濾**：若 AI 提供的是非法走法，提示系統會靜默隱藏，避免誤導玩家。

### 4.2 資料庫報錯防禦
為了解決長報錯（AI 輸出過長）導致的寫入失敗：
- **修改**：`generation_jobs.message` 的 `SQLAlchemy` 類型應從 `String(255)` 改為 `Text`。
- **動作**：需執行 `alembic` 遷移以更新資料庫架構。

---

## 5. 常見問題解答 (Troubleshooting)

- **Q: 為什麼出現 "Invalid FEN: pieces invalid"?**
  - A: 通常是因為 AI 在矩陣中輸入了數字（代表空位數）。新的解析器已加入 `VALID_PIECES` 正則過濾，會自動將數字轉回為 `.` 占位。
- **Q: 題目顯示 Queen to e8，但那邊沒有格子？**
  - A: 這是 AI 的坐標幻覺。新版本已加入 `getReadableMove` 驗證，僅顯示在規則上合法的提示。

---

*本指南最後更新於 2026-04-11。所有代碼變動已歸檔至此。*
