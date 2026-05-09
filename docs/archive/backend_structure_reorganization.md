# 後端架構優化：Service 層重新分類計劃書 (Backend Structure Optimization Plan)

## 1. 現狀評估 (Current State)

目前的 `app/services` 目錄呈現「扁平且雜亂」的狀態：
- **頂層檔案**：`audio_service.py`, `course_service.py`, `user_service.py` 放在根目錄。
- **過度膨脹的 `commons`**：裡面塞滿了使用者經濟系統、檔案處理、進度追蹤等多種不相關的邏輯。
- **多樣化的資料夾**：`ai_agents`, `llm_clients`, `workers`, `jobs` 並列，缺乏清晰的層次感（哪些是業務邏輯？哪些是基礎建設？）。

---

## 2. 目標架構 (Proposed Structure)

我們將採用 **領域驅動 (Domain-Driven)** 與 **功能分類 (Functional Grouping)** 相結合的方式進行重組：

### A. 業務領域層 (Business Services) - `app/services/domain/`
處理核心業務規則與跨模型的複雜邏輯。
- `domain/user/`: 整合 `user_service.py`, `user_economy.py`, `user_progress.py`, `activity_logger.py`。
- `domain/course/`: 整合 `course_service.py`, `course_lifecycle.py`, `audio_service.py` (語音是課程的一部分)。
- `domain/learning/`: 整合 `lesson_persistence.py`, `lesson_components/`。

### B. AI 引擎層 (AI Engine) - `app/services/ai_engine/`
負責與 LLM 互動與 AI 工作流。
- `ai_engine/clients/`: (原 `llm_clients`) 各種模型供應商的封裝。
- `ai_engine/agents/`: (原 `ai_agents`) 具備特定任務能力的 Agent。
- `ai_engine/workflows/`: (原 `workflows`) 課程生成、課綱設計等 SOP。
- `ai_engine/kb/`: (原 `knowledge_base`) 向量檢索與知識庫。

### C. 基礎建設層 (Infrastructure) - `app/services/infra/`
非業務相關的技術支撐。
- `infra/files/`: (原 `file_service.py`) 檔案上傳、雲端存儲。
- `infra/scheduler/`: (原 `jobs`, `workers`) 定時任務與背景非同步處理。
- `infra/media/`: (原 `media_catalog.py`) 媒體資源管理。

---

## 3. 搬遷對照表 (Migration Mapping)

| 原始路徑 | 新路徑 | 備註 |
| :--- | :--- | :--- |
| `services/user_service.py` | `services/domain/user/service.py` | 改名為 service.py 更簡潔 |
| `services/commons/user_*.py` | `services/domain/user/*.py` | |
| `services/course_service.py` | `services/domain/course/service.py` | |
| `services/audio_service.py` | `services/domain/course/audio.py` | |
| `services/commons/file_service.py` | `services/infra/files/service.py` | |
| `services/llm_clients/` | `services/ai_engine/clients/` | |
| `services/ai_agents/` | `services/ai_engine/agents/` | |

---

## 4. 實施細節 (Implementation Strategy)

### 第一階段：建立新目錄並搬遷核心
1. 建立 `app/services/domain/user/`, `app/services/domain/course/`, `app/services/infra/` 等。
2. 搬遷檔案並更新內部的 `import` 語句。

### 第二階段：更新 API 層引用
1. 全面搜尋並替換 `from app.services.*` 為新的路徑。

### 第三階段：清理 `commons`
1. 將殘留的工具函式移至 `app/core/utils/` 或對應的 domain 資料夾下。

---

## 5. 預期效益
- **導航效率**：開發者能迅速定位到是「業務改動」還是「技術底層改動」。
- **模組解耦**：Domain 之間界線明確，減少循環依賴。
- **擴充性**：新增功能（如 Arena 競技場）可以直接在 `domain/` 下開新資料夾，不會干擾其他模組。
