# ⚙️ 背景任務調度與任務系統 (Background Workers & Scheduling)

本文件詳細說明 Learn8 如何處理耗時的 AI 任務與數據處理任務，解析任務佇列、背景 Worker 以及實時 Job 狀態追蹤的底層機制。

---

## 🌟 0. 產品價值與 UX 亮點 (Product Value)

非同步任務系統是實現「大規模 AI 教學」的基石：

- **反應靈敏的介面 (Responsive UI)**：學員在發起生成後，不需要停留在旋轉的載入圖示前。後端非同步處理讓學員能自由切換頁面，而進度則透過通知系統隨時反饋。
- **高可靠的任務保障 (Fault-Tolerant Generation)**：即便 AI 模型連線暫時不穩定，背景 Worker 的重試機制（Retry Logic）能保證任務在後續恢復，確保內容生成不中斷。
- **透明的進度追蹤 (Progress Transparency)**：透過詳細的任務狀態（Pending, Running, Retrying），學員能清楚知道 AI 目前正在「問卷分析」還是「大綱優化」，消除了等待的焦慮感。

---

## 🏗️ 1. 任務架構核心 (Task Architecture)

Learn8 採用 **PostgreSQL + FastAPI BackgroundTasks + LISTEN/NOTIFY** 的輕量化非同步架構，不依賴外部繁重的消息隊列：

### 1.1 `generation_jobs` 資料表
作為任務的持久化與狀態中心，記錄每個任務的：
- `job_id`: 全局唯一 UUID。
- `status`: `pending` (等待中) -> `running` (執行中) -> `completed` (已完成) 或 `failed` (已失敗)。
- `progress`: 0-100 的即時進度百分比。
- `worker_type`: 指定由哪個專屬 Worker 處理（`syllabus`, `lesson`, `questionnaire`）。
- `result_data`: 儲存產出的 JSON 結果數據（如問卷題目或大綱數據）。
- `error_message`: 記錄失敗時的 Exception 堆疊軌跡。

### 1.2 `JobRegistry` (任務註冊與通知中心)
- **職責**：管理所有註冊的 Job 實例，提供 `get_job(id)` 與 `update_progress()` 等 API。
- **LISTEN/NOTIFY 即時通信**：每當 Worker 呼叫 `update_progress()` 更新進度時，系統會自動在 PostgreSQL 觸發 `NOTIFY generation_job_progress, '{job_id}'` 事件。FastAPI SSE 監聽線程接收到此 Notify 信號後，會立刻從資料庫讀取最新狀態並透過 SSE (Server-Sent Events) 推播至前端。

---

## 👷 2. 專屬 Worker 職責與工作流程 (Workers & Pipeline)

### 2.1 Syllabus Worker (大綱生成器)
- **觸發時機**：學員提供主題並上傳教材檔案後。
- **工作細節**：
  1. 讀取學員上傳的文件，並依據 `.env` 選擇轉檔引擎（如 **MarkItDown**）。
  2. 調用 `PlannerAgent` 生成第一版 CoursePath 大綱草稿。
  3. 迭代調用 `AuditorAgent` 對大綱執行批判性修正與原子變更（最多迭代 `MAX_SYLLABUS_AUDIT_REFLECTIONS` 次）。
  4. 完成後寫入 `courses.syllabus_json` 並解鎖第一章的學習節點。

### 2.2 Lesson Worker (關卡內容生成器)
- **觸發時機**：學員解鎖新關卡或點擊「刷新內容」時。
- **工作細節**：
  1. **圖片資源加載**：查詢該課程在資料庫中的所有 `CourseMediaAssetModel` 資產，構建 `media_catalog`。
  2. **多模態大腦生成**：調用 `AIArchitectService`，若有圖片資源，自動讀取本地實體圖片檔案，轉為 Base64 並以多模態 `HumanMessage` 丟給 Gemini VLM。
  3. **圖片路徑後處理**：AI 生成的 `LessonStage[]` 若使用了圖片（帶有 `mediaIndex`），Worker 會透過 `build_media_index_map` 找出對應的實體圖片 API 路徑，自動重寫為 `/api/v1/courses/files/images/...` 的靜態網址並寫入 `mediaUrl`。
  4. **音訊預合成**：在生成投影片的同時，觸發 `AudioService` 針對各個 Stage 內文發起語音快取預合成，減少學員上課時的加載等待時間。

### 2.3 Questionnaire Worker (問卷生成器)
- **觸發時機**：課程建立初期。
- **工作細節**：
  1. 基於 RAG 向量檢索獲取課程主題的相關背景片段。
  2. 呼叫大語言模型為學員生成 3 道量身定制的診斷問答題目，寫入 `generation_jobs` 成果欄中，供前端渲染。

---

## 🛡️ 3. 異常處理與超時保護 (Error Handling & Timeout)

- **自動重試策略 (Retry Strategy)**：對於網路暫時性中斷（如 OpenAI/Gemini API 連線超時），Worker 會執行最多 3 次的指數退避重試（Exponential Backoff）。
- **孤兒任務清理 (Orphaned Job Cleanup)**：系統啟動時會自動掃描處於 `running` 超過 1 小時的任務，將其重置為 `failed` 並記錄日誌，防止死結。
- **Job 取消機制**：在 `lesson_worker` 生成過程中，會定期檢查 `_is_cancelled(db, job_id)`。如果學員取消了任務，Worker 會立即安全退出並清理臨時檔案。

---

## 📡 4. 前端 SSE 監聽示例

前端透過監聽以下流來獲取即時狀態：
```javascript
const eventSource = new EventSource(`/api/v1/jobs/${jobId}/stream`);
eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    console.log(`目前進度: ${data.progress}% - ${data.message}`);
};
```
