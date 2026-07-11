# 圍棋關卡模版優化與 Google File API 全面替代 RAG 計畫書 (極度詳細版)

本計畫書旨在對 Learn8 專案的知識庫檢索與圍棋題目生成機制進行徹底的架構升級。
我們將貫徹你的想法：**「全部改用上傳至 Google 伺服器的方式 (100% Google File API Native)」**。這意指我們將淘汰專案中原有的本地純文字提取與 Chroma 向量庫（RAG），改為不論是在**大綱規劃（Syllabus Generation）**還是**單元關卡生成（Lesson Generation）**時，都將原始檔案直接綁定給 Google Gemini 進行原生多模態解析。

同時，我們將從「第一性原理」出發，**廢除冗餘的 8 個專門題型組件，收攏為 2 個通用互動組件**，並搭配**動態尺寸圍棋規則引擎**進行即時校驗與答案修正。

---

## 1. 架構變革：從「本地 RAG」全面轉為「Google File API 原生託管」

### 1.1 過去的架構痛點 (Local Text RAG Limit)
1. **純文字化失真**：PDF/PPTX 教材經過本地解析（如 MarkItDown）後，所有的圍棋盤面圖解、排版與表格全部丟失。AI 只看得到碎片化的文字，看不到關鍵的棋形插圖，無法進行「臨摹」或「圖文對齊」。
2. **上下文碎片化**：文字大綱規劃與關卡生成均受到 token 上限限制，使得教材段落被粗暴切碎（chunking），破壞了圍棋教學邏輯的連續性。

### 1.2 全面升級方案：Google File API 統一管線
我們將建立一個**統一的 Google 檔案託管與綁定機制 (Unified Google File Agent)**：

```
                    ┌────────────────────────┐
                    │  用戶上傳 PDF/PPTX 教材 │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ 計算 SHA-256 Hash 碼    │
                    └───────────┬────────────┘
                                │
                                ▼
                     [ 檢查資料庫快取 ]
                     ├── ⭕ 已存在 ➔ 複用 Google File 名稱 (URI)
                     └── ❌ 未存在 ➔ 呼叫 google.generativeai.upload_file()
                                 │
                                 ▼
                             [ 寫入 DB ]
                     (映射關係: File Hash ➔ Google File URI)
                                 │
                                 ▼
       ┌─────────────────────────┴─────────────────────────┐
       ▼                                                   ▼
┌──────────────────────────────┐           ┌──────────────────────────────┐
│  大綱規劃 (Syllabus Agent)   │           │   關卡生成 (Course Architect) │
├──────────────────────────────┤           ├──────────────────────────────┤
│ 1. 綁定 Google File URI       │           │ 1. 綁定 Google File URI       │
│ 2. 讓 AI 看整本書規畫大綱    │           │ 2. 指定單元標題, VLM 尋找對應  │
│    (無 RAG 切片限制)          │           │    插圖頁面還原棋盤             │
└──────────────────────────────┘           └──────────────────────────────┘
```

#### 大綱規劃（Syllabus Generation）的轉變：
* **以前**：讀取上傳檔案的純文字，拼接成 `full_text_context` 字串，拼在 Prompt 中傳遞。限制最多幾萬字元，大本的 PDF 無法全部帶入。
* **以後**：調用 `google_adapter.py` 中的 `bind_files(full_paths)`，將整本教材 PDF 的 Google 託管引用傳入。Syllabus Agent 能夠進行全書級的多模態大綱規劃，完美抓住圖文並茂的章節重點。

#### 單元關卡生成（Lesson Stage Generation）的轉變：
* **以前**：使用 Chroma 向量庫檢索與單元名稱最相似的幾十行文字，當作 context 丟給 LLM。LLM 只能「閉眼猜測」棋盤狀態。
* **以後**：完全廢除 ChromaDB 檢索。將該課程綁定的 Google File URI 直接附在關卡生成 API 中。Gemini 直接從整本教材 PDF 中搜尋該單元主題（例如「第一章：數氣」），透過 VLM 視覺比對直接讀取該頁的圍棋圖解，並在輸出的 JSON 中輸出高度精確、與教材完全一致的 $N \times M$ 盤面。

---

## 2. 第一性原理：圍棋組件重構方案 (Unified Components)

為了不讓前端與後端因 8 個題型而碎片化，我們將交互模型收攏為 2 大通用組件：

### 2.1 組件 A：`GoBoardCoordinate` (單點落子組件)
* **適用題型**：提子 (Capture)、逃跑 (Escape)、連接 (Connect)、分斷 (Cut)、打劫 (Ko)、禁入點 (NoEntry)、死活題急所。
* **交互行為**：學員在前端棋盤上點擊某個交叉點，前端將該座標（如 `C4`）發送至後端。
* **後端校驗**：比對落子座標是否在後端動態計算出的 `acceptableAnswers` 集合中。
* **資料 Schema 範例**：
  ```json
  {
    "component": "GoBoardCoordinate",
    "config": {
      "data": {
        "question": "黑棋下在哪裡可以把兩塊被切斷的黑子連接起來？",
        "board": {
          "size": 5,
          "black": ["B4", "D4"],
          "white": [],
          "marks": []
        },
        "playerColor": "B",
        "expectedAnswer": "C4",
        "acceptableAnswers": ["C4"],
        "explanation": "下在 C4 可以將左邊的 B4 與右邊的 D4 連接成一條棋串。"
      }
    }
  }
  ```

### 2.2 組件 B：`GoBoardNumeric` (數值回答組件)
* **適用舊題型**：數氣 (Count Liberties)、數目/地盤 (Count Territory)。
* **交互行為**：前端呈現棋盤，學員輸入整數答案（如 `3`）。
* **後端校驗**：比對學員的輸入數值與 `expectedAnswer` 是否一致。
* **資料 Schema 範例**：
  ```json
  {
    "component": "GoBoardNumeric",
    "config": {
      "data": {
        "question": "數數看，被標記（黃色標記為 X）的黑棋共有幾口氣？",
        "board": {
          "size": 5,
          "black": ["C4"],
          "white": [],
          "marks": ["C4"]
        },
        "expectedAnswer": "4",
        "explanation": "被標記的黑子在四周上下左右各有 1 個空點，共有 4 口氣。"
      }
    }
  }
  ```

---

## 3. 解決 AI 生成痛點：棋盤資料格式優化

### Q：這種 `[".....", "..X..", "....."]` 的矩陣字元字串形式，AI 能夠生成得好嗎？
**答案是：可以生成，但很容易因為「數錯點點」而出現小瑕疵（如某一列長度變成 4，或座標錯位）。**

為了讓 AI 生成達到 **100% 穩定且絕無語法與排版錯誤**，我們設計了以下**對 AI 極度友善的優化方案**：

### 💡 最佳實踐：座標清單表達法 (Coordinate Placement List)
我們不再強迫 AI 去輸出密密麻麻的「點點矩陣」字串，而是讓 AI 直接輸出**圍棋標準座標的棋子落點列表**。

#### 1. 新型 Board Schema
AI 生成的 `board` 結構定義為：
```json
"board": {
  "size": 9,               // 棋盤尺寸 (5, 9, 13, 19 等)
  "black": ["C4", "E4"],   // 黑子落點座標列表
  "white": ["D3"],         // 白子落點座標列表
  "marks": ["C4"]          // 需要疊加特殊符號/黃色標記 (X) 的座標
}
```

#### 2. 為什麼這個格式對 AI 而言「極度容易生成且不會出錯」？
1. **天然防錯**：LLM 在處理密集的符號（如數十個連續的 `.B.W.`）時極易產生幻覺或少數一個點。而 `["C4", "E4"]` 是明確的語義化 token，AI **絕對不會拼錯座標字串**。
2. **與教材直接語意對齊**：圍棋教材文字本來就是寫「黑子 C4、白子 D3」。AI 可以直接將教材中的對話與說明映射到這個 JSON 陣列中，不用在腦中做複雜的「座標轉點點矩陣」二維圖案編碼。
3. **無縫適配前端與後端**：
   * **後端引擎**：後端 `GoRulesEngine` 在初始化時，會自動根據給定的 `size` 生成一個 $N \times N$ 的空點矩陣，然後把 `black` 列表中的座標填入 `B`，`white` 填入 `W`，`marks` 填入 `X`。
   * **向下相容**：如果遇到歷史題目中傳統的 `[".....", "..X.."]` 陣列，後端引擎和前端也能相容解析。

---

## 4. 「組件 A與 B」設計的完善度評估 (Design Robustness Check)

針對「這兩個組件的設計是否足夠完善」進行第一性原理的深度校驗，我們已確保其架構高階收攏且高度相容：

### 4.1 邊界漏洞與解決方案

#### 邊界 1：標記與指示符號（Annotations & Marks）
* **加固**：如第 3 節所述，引進 `marks` 陣列（例如 `"marks": ["C4"]`），對應舊題型中的 `X`。前端 [GoBoardQuestion.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/components/lesson-session/GoBoardQuestion.tsx) 的繪圖引擎會自動在這些座標疊加特殊的標記符號，與教材圖解完美一致。

#### 邊界 2：多步對弈（Tsumego / Multi-turn Play）
* **評估**：當前 Learn8 所有題目均為單步死活或基本規則（吃子、逃跑）。
* **加固**：我們在設計上預留一個第三組件 `GoBoardScenario` 的插槽。未來若要升級多步對弈，只需前端維持目前的棋盤渲染，但將 `onComplete` 改為「與後端進行多輪對弈傳輸」，其資料結構與 A/B 完全相容。

#### 4.2 前端適配性向下相容修正
為了讓前端 `GoBoardQuestion.tsx` 與新組件無縫接軌，我們將修改其內部判定條件：
```typescript
// 以前
const isNumericAnswerMode = componentType === "GoCountLiberties" || componentType === "GoCountTerritory";
const isLibertiesMode = componentType === "GoCountLiberties";

// 改為適配新組件
const isNumericAnswerMode = componentType === "GoBoardNumeric" || componentType === "GoCountLiberties" || componentType === "GoCountTerritory";
const isLibertiesMode = componentType === "GoBoardNumeric" || componentType === "GoCountLiberties";
```
這確保了即使我們後續全面改用 `GoBoardNumeric`，既有已生成的歷史關卡也不會發生崩潰，具有**向下相容性**。

---

## 5. 具體修改檔案清單與進度表 (File Changes Checklist)

| 序號 | 動作 | 檔案路徑 | 說明 |
| :--- | :--- | :--- | :--- |
| 1 | **[NEW]** | `backend/app/services/domain/learning/lesson_components/go_rules_engine.py` | 實作動態尺寸的 BFS 氣數與座標計算器，並支援座標列表的二維還原解析。 |
| 2 | **[NEW]** | `backend/data/game_modules/GoBoardCoordinate.yaml` | 通用座標點擊型組件定義。 |
| 3 | **[NEW]** | `backend/data/game_modules/GoBoardNumeric.yaml` | 通用數值輸入型組件定義。 |
| 4 | **[DELETE]**| 舊的 8 個 `Go*.yaml` 檔案 | 移除舊有的冗餘組件定義。 |
| 5 | **[MODIFY]**| `backend/app/services/ai_engine/clients/google_adapter.py` | 重構 `bind_files` 改用 `genai.upload_file` 並處理緩存。 |
| 6 | **[MODIFY]**| `backend/app/services/ai_engine/agents/course_architect.py` | 廢除原本的 `apply_go_puzzle_bank`，改接 `GoRulesEngine` 進行即時校驗補正；並將原本的 Chroma 檢索逐步替換為綁定的 Google File 對象。 |
| 7 | **[MODIFY]**| `backend/app/services/domain/learning/lesson_components/evaluators.py` | 判分器重構，改為調用 `GoRulesEngine` 來檢驗學員作答。 |
| 8 | **[MODIFY]**| `backend/app/services/infra/scheduler/workers/syllabus_worker.py` | 修改大綱背景 Worker，傳入對象改為 Google File API 託管對象。 |
| 9 | **[MODIFY]**| `frontend/src/components/lesson-session/GoBoardQuestion.tsx` | 適配 `GoBoardCoordinate` 與 `GoBoardNumeric` 的新渲染規則、座標物件解析與向下相容。 |
| 10| **[MODIFY]**| `backend/tests/test_go_board_components.py` | 編寫新測試，涵蓋 9x9 等不同棋盤大小的落子與數氣驗證。 |
