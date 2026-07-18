# 圍棋關卡生成與校驗工作流 (Go Puzzle Generation & Validation Workflow)

本文件說明 Learn8 系統中圍棋關卡組件的雙 Agent 生成架構、校驗循環（程式碼判定 + 多模態 VLM 審查）以及批改評估機制。

---

## 適用範圍與組件分流 (Applicability Scope)

> [!IMPORTANT]
> **本工作流為「圍棋模版組件專屬」，並非所有學科主題都會進入圍棋 Prompt。**
> 
> 系統透過 **Placer Registry（擺放器註冊表）** 機制實現學科分流：
> 1. **圍棋相關組件 (`GoBoardCoordinate` 與 `GoBoardNumeric`)**：會註冊對應的 `place_go_board` 擺放器。只有當 AI 課程設計師生成這兩類關卡組件時，才會啟動本篇所述的「座標翻譯、實體盤面繪製、三層規則與 VLM 校驗」流程。
> 2. **非圍棋學科組件 (如歷史、科學、寫程式、一般課後問答、Feynman 互動等)**：沒有註冊擺放器，生成時會**直接繞過**此棋盤擺放與 VLM 校驗流程，以維持極低的 API 延遲與 Token 消耗，防範 Prompt 語意污染。

---

## 工作流總覽 (Workflow Overview)

一本教科書等級的圍棋關卡生成，遵循**雙 Agent 管道流程**，並結合了**三層防禦性校驗反饋循環**：

```mermaid
flowchart TD
    A[開始: 生成關卡節點] --> B[Agent 1: AI 課程設計師 Course Content Architect]
    B -->|生成半結構化文字藍圖與目標| C[Agent 2: 棋盤擺放器 Board Placer]
    
    subgraph 重試循環 (最多 3 次)
        C -->|使用 CoT 思考鏈輸出座標| D[Tier 1 & 2: Python 程式碼規則驗證]
        D -->|失敗: 越界/重疊/自殺| E[將錯誤寫入 previous_errors]
        E -->|重試| C
        
        D -->|通過: 短路求值成功| F[使用 Pillow 渲染棋盤配置成 PNG 圖片]
        F --> G[Tier 3: Gemini VLM 多模態視覺審查]
        G -->|失敗: 語意與圖文不符| E
    end
    
    G -->|通過| H[合併座標與解答寫入資料庫]
    E -->|重試 3 次皆失敗| I[回滾: 重新呼叫 Agent 1 構建新藍圖]
    I --> B
    
    H --> J[學生提交答案]
    J --> K[圍棋盤面批改評估器]
    K -->|資料庫有 acceptableAnswers| L[執行大小寫不敏感比對]
    K -->|acceptableAnswers 為空 / 歷史舊資料| M[後備機制: 比對 expectedAnswer]
    L --> N[返回批改結果]
    M --> N
```

---

## 1. 生成管線 (雙 Agent 架構)

### 第一階段：AI 課程設計師 Agent 1 (Course Content Architect)
- **角色**：關卡教學內容與題目規劃者。
- **職責**：依據小節主題設計學習關卡（Stages），若為圍棋題型則設計好文字題意、玩家執子顏色與**半結構化的盤面文字藍圖 (board_blueprint)**。
- **輸入**：課程小節主題、教材/RAG 知識庫上下文。

### 第二階段：棋盤擺放器 Agent 2 (Board Placer)
- **角色**：實體座標映射與定位者。
- **職責**：將 Agent 1 設計的文字藍圖翻譯成具體的 2D 座標 JSON 欄位（`black`, `white`, `marks`, `expectedAnswer`, `acceptableAnswers`, `puzzleType`）。
- **思考鏈 (CoT)**：透過 Pydantic schema 的欄位順序限制（將 `thoughtProcess` 定義在最前欄位），強制模型必須「先寫出文字推理鏈與座標計算」後，才輸出具體的座標列表。

---

## 2. 三層防禦性校驗循環 (Defense in Depth)

Agent 2 輸出座標後，在寫入資料庫前必須通過嚴格的三層校驗審查。

### 第一二層：本地 Python 程式碼校驗
- **物理與邊界檢查**：驗證所有座標皆在棋盤網格內（如 9x9 棋盤的 A1 至 I9），且黑白子沒有重疊。
- **規則與狀態邏輯**：使用 `GoRulesEngine` 檢驗圍棋規則合法性（例如：提子題在落子後對手棋子是否真的變為 0 氣；禁入點在落子前是否確實為自殺點等）。
- **短路求值 (Short-circuiting)**：若第一二層的程式碼檢查出錯，會直接宣告校驗失敗，**立刻跳過第三層 VLM 呼叫**，以節省 Token 成本與 API 延遲。

### 第三層：多模態視覺校驗 (Gemini VLM)
- **實體棋盤渲染**：程式碼使用 Pillow 將生成的座標網格繪製為 PNG 圖片，並於四周標上明顯的座標標籤（A-T, 1-N），提供精準的視覺參照。
- **AI 裁判 (Multimodal)**：將圖片與題意文字一併送給 Gemini VLM 模型，使用英文 CoT 提示詞引導其進行核對。
- **語意吻合驗證**：審查圖片配置是否符合教學目的（例如：連接題在落子後，是否確實將兩邊黑子在視覺上相連；黑白子有沒有畫反）。

### 錯誤回饋重試與回滾
- 若任一層校驗未通過，系統會將具體出錯原因記錄在 `previous_errors` 中。
- 重新呼叫 Agent 2，使其能根據歷史錯誤資訊進行「修正-檢查」自我修正（最多 3 次）。
- 若 3 次嘗試皆宣告失敗，則**回滾至第一階段**，由 Agent 1 重新規劃全新的題目文字藍圖。

---

## 3. 批改與評估引擎

當學生在前端互動提交答案後，由 [evaluators.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/domain/learning/lesson_components/go/evaluators.py) 進行批改：

### 去關鍵字座標匹配
為提升泛化批改能力，系統**不再**使用程式碼寫死關鍵字判定（如依靠題目出現「吃」或「斷」來切換規則）：
- 若資料庫欄位存在 `acceptableAnswers` 列表，學生的落子坐標會與其進行大小寫不敏感的直接比對。

### 歷史數據相容防線 (Backward Compatibility)
若讀取到舊有的歷史關卡（資料庫無 `acceptableAnswers`）：
- 系統會自動回退為大小寫不敏感地比對唯一正確答案 `expectedAnswer`，確保重構不會影響歷史存量資料的批改正確性。
