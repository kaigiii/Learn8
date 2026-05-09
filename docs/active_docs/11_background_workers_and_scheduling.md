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

Learn8 採用 **PostgreSQL + API Worker** 的輕量化非同步架構，不依賴外部繁重的消息隊列：

### 1.1 `generation_jobs` 資料表
作為任務的持久化層，記錄每個任務的：
- `job_id`: 全局唯一 UUID。
- `status`: `pending`, `running`, `completed`, `failed`。
- `progress`: 0-100 的數值。
- `worker_type`: 指定由哪個專屬 Worker 處理（如 `syllabus`, `lesson`）。

### 1.2 `JobRegistry` (任務註冊中心)
位於 `app.infra.scheduler.job_registry`：
- **職責**：管理所有註冊的 Job 實例，提供 `get_job(id)` 與 `update_progress()` 等 API 給 Worker 調用。
- **通知機制**：每當進度更新時，會觸發 Postgres 的 `NOTIFY` 事件，SSE 端點接到通知後立即將數據推播至前端。

---

## 👷 2. 專屬 Worker 職責分工

### 2.1 Syllabus Worker (大綱生成器)
- **觸發時機**：用戶提交主題或文件後。
- **邏輯**：串接 `PlannerAgent` 與 `AuditorAgent` 進行迭代優化，最終寫入 `courses.syllabus_json`。

### 2.2 Lesson Worker (關卡內容生成器)
- **觸發時機**：大綱落盤後，或手動點擊「刷新內容」時。
- **邏輯**：逐個節點調用 `ArchitectAgent` 生成題型組件，並同步觸發 `AudioService` 預建音訊。

---

## 🛡️ 3. 異常處理與超時機制

- **重試策略 (Retry Strategy)**：對於網路性質的錯誤（如 OpenAI API Timeout），Worker 會執行最多 3 次的指數退避重試（Exponential Backoff）。
- **孤兒任務清理 (Orphaned Job Cleanup)**：系統啟動時會自動掃描處於 `running` 超過 1 小時的任務，將其重置為 `failed` 並記錄日誌，防止死結。

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
