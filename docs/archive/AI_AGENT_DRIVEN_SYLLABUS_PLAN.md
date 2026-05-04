# 課程大綱生成重構：AI Agent 驅動與工具式批次編輯 (Tool-use) 架構提案

## 1. 背景與動機
目前系統的課程大綱生成採用兩階段式：
1. 先生成高階藍圖 (`Blueprint Units`)。
2. 並行檢索 (`RAG`) 展開每個單元底下的節點 (`Nodes`)。

雖然此模式產出速度快，但在整體課程一致性、上下文延續上，容易發生單元間銜接不順暢或內容重複的情況。
原先系統內建一個舊版的架構編輯器（`AIArchitectService.refine_course_syllabus`），但每次微調都需將整份 JSON 大綱重新輸出，消耗高額 Token 且容易導致輸出格式出錯。

本提案規劃：
- **Multi-Agent 協作架構**：將生成與審查/編輯職責解耦。
- **批次編輯與精確插入 (Tool-use)**：Auditor Agent 可呼叫專屬工具批次更新或新增單元、節點，並可精確指定插入順序（如在某節點之後），無需重新生成整份資料。
- **多回合自我迭代與流程控制**：為 Agent A 與 Agent B 配備完善的交接、自我反思迴圈函數。
- **健全性與使用者體驗優化**：新增防範無限迴圈的回合上限、動態進度回傳機制、以及最終結構驗證。
- **前端對接與環境變數管理**：健全與前端組件渲染的通信介面，並將關鍵係數與模型設定外置於 `.env`。
- **廢棄舊版架構**：移除 `refine_course_syllabus` 中冗長的重新生成邏輯，統一由工具式 Agent 來接管。

---

## 2. 系統輸入與輸出欄位定義

為確保重構後功能不漏缺，以下對應現有 Schema (`CoursePath`, `RefineSyllabusRequest`) 之原始輸入輸出欄位：

### 2.1 原始輸入欄位 (`Input Parameters`)
- **`topic`** (str): 課程主題名稱
- **`currentSyllabus`** (`CoursePath`): 目前課程的大綱結構
  - `courseTitle` (str): 課程名稱
  - `description` (Optional[str]): 課程描述
  - `units` (List[`Unit`]): 包含單元資訊的列表：
    - `unitId` (str): 單元唯一識別碼
    - `unitTitle` (str): 單元標題
    - `unitDescription` (str): 單元描述
    - `nodes` (List[`LessonNode`]): 單元內的小節節點：
      - `id` (str): 節點唯一識別碼
      - `title` (str): 小節標題
      - `description` (str): 小節詳細描述
      - `status` (Enum): 狀態（`locked`, `available`, `completed`）
- **`userFeedback`** (str): 使用者提出的微調/修改要求
- **`history`** (List[Dict[str, str]]): 歷史紀錄對話列表（選填）

### 2.2 原始輸出欄位 (`Output Parameters`)
- **`CoursePath`**: 修改微調過後的新課程大綱結構（欄位格式與上方輸入之 `currentSyllabus` 完全相同）。

---

## 3. Agent 架構、流程控制與自我迭代工具

### 3.1 Agent A: 課程規劃師 (Course Planner Agent)
- **職責**：一次性生成包含大綱與細部節點的完整課程大綱草稿（Draft）。
- **流程控制工具**：
  - `handover_to_auditor()`: 規劃師確認草稿完成後，交接給 Auditor Agent。

### 3.2 Agent B: 課程審查與編輯師 (Syllabus Auditor Agent)
- **職責**：對 Agent A 生成的草稿進行評估，呼叫工具進行局部編輯，並支援自我反思（Self-reflection）校正，直到達到最佳品質。
- **流程控制與迭代工具**：
  - `request_self_reflection(critique: str)`: 當審核結果仍有瑕疵，或認為自身在一回合內尚未微調、修剪完全時，可傳入自我批評與反思指導，觸發新一回合的 Agent B 審核編輯。
  - `finish_syllabus_review()`: 完成課程審查與最終變更，正式結束流程。

---

## 4. 完整編輯工具定義 (`batch_modify_syllabus`)

為了能覆蓋所有課程地圖的可編輯資訊，批次編輯工具將支援以下所有動作（Actions）：

### 4.1 動作選項 (Action Types for Tool)
1. **`UPDATE_COURSE_METADATA`**
   - `courseTitle` (str): 編輯課程主標題。
   - `description` (str): 編輯課程總描述。
2. **`INSERT_UNITS`**
   - `units`: 新增的 `Unit` 列表。
   - `after_unit_id` / `before_unit_id` / `index`: 用於精確定位單元順序位置。
3. **`UPDATE_UNITS`**
   - `updates`: 包含 unit ID 及其欲更新欄位（`unitTitle`, `unitDescription`）的清單。
4. **`INSERT_NODES`**
   - `unit_id`: 單元 ID。
   - `nodes`: 新增的 `LessonNode` 列表。
   - `after_node_id` / `before_node_id` / `index`: 精確控制小節順序插入的位置。
5. **`UPDATE_NODES`**
   - `updates`: 包含 node ID 及其欲更新欄位（`title`, `description`）的清單。
6. **`DELETE_NODES`**
   - `node_ids`: 欲移除的小節 node ID 清單。

---

## 5. 健壯性與使用者體驗優化 (Robustness & UX)

為讓 Multi-Agent 重構後的服務具備生產環境等級的穩定度，特別納入以下三項防呆與優化設計：

### 5.1 設定最大反思迭代上限 (Max Recursion / Iterations Limit)
- 為避免 `request_self_reflection` 因品質反覆判斷不當而造成無限迴圈，或引發高額 API 成本。
- **設計**：背景任務中將強行設定 `MAX_REFLECTIONS = 3`。當達到上限時，Auditor Agent 將自動停止反思並將目前的結果強行送出。

### 5.2 多回合動態進度回傳 (Dynamic Progress Reporting)
- 在長達數回合的 Agent 審核編輯過程中，透過 Worker 定期更新 WebSocket/通知的進度。
- **範例**：
  - *第一回合*: `65%, "🔍 課程編輯師正審核大綱並進行初步微調中..."`
  - *第二回合 (Self-reflection)*: `80%, "🔄 課程編輯師進行自我反思與第二次微調中..."`

### 5.3 最終產物結構校驗 (Pydantic Schema Validation)
- 呼叫 `finish_syllabus_review()` 後，大綱產物必須通過 `CoursePath.model_validate()` 的嚴格校準，保障儲存與展示的格式永遠不損壞。

---

## 6. 前端展示與環境變數對接規劃

### 6.1 前端展示與互動配合 (Frontend Integration)
- **非同步狀態通知**：
  - 前端利用 WebSocket 或伺服器發送事件（SSE）監聽 `JobStatus` 的改變。
  - 當 Agent 每觸發一次微調與反思、或是執行任何工具動作（Action）時，背景 Worker 會呼叫 `_notify_job_update`，更新進度百分比與展示提示文字（如：`🛠️ 審查代理人執行變更工具：INSERT_NODES`），並透過 SSE 即時通知前端。
- **資料獲取流程**：
  - 當前端收到 `JobStatus.COMPLETED` 的通知，立即對 API `GET /api/v1/courses/{id}` 重新拉取大綱。
  - 後端可將最新的草稿大綱暫存或在 `result_data` 中即時返回，使前端在大綱生成的中間過程即可繪製出大綱預覽骨架。

### 6.2 環境變數配置 (.env & Config)
為了便於在不改動原始碼的前提下測試和調整系統參數，以下關鍵係數將外置到 `app/core/config.py` 中：
- `MAX_SYLLABUS_AUDIT_REFLECTIONS` (int, 預設為 `3`): 限制單次工作流中 Auditor Agent 的最大自我反思次數。
- `PLANNER_AGENT_MODEL` (str, 預設為目前最高性價比之 LLM): 規劃代理人專屬的推理/生成模型。
- `AUDITOR_AGENT_MODEL` (str, 預設為最精準、推理能力最強的 LLM): 審查代理人專屬的微調與決策模型。

---

## 7. 模組影響範圍與廢棄評估

### 7.1 廢棄移除舊模組
- **廢棄方法**：
  - 移除 `AIArchitectService.refine_course_syllabus`。
  - 移除舊有的 `REFINE_SYLLABUS_PROMPT` 以及相關的冗長 JSON 微調 Prompt。

### 7.2 後端 Agent 升級
- [syllabus_agent.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_agents/syllabus_agent.py)
  - 增加 Tool-use 編輯介面、交接、自我反思迴圈函數，並綁定至各個 Agent。

### 7.3 背景 Worker
- [syllabus_worker.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/workers/syllabus_worker.py)
  - 工作流改為 Generator -> Auditor -> 支援多回合 Self-Reflection -> 更新 DB。
