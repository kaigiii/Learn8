# Plan - Syllabus Refinement Context Enrichment & Cleanup
# 計劃 - 大綱微調上下文增強與冗餘清理

This plan outlines the implementation of loading context materials (via Google File API or RAG) during the syllabus edit/refinement phase, aligning it with the `AI_SYLLABUS_EDIT_USE_FILE_API` setting. It also cleans up the unused `rag_engine` parameter in `SyllabusAgent`.

本計劃旨在實作在大綱編輯/微調階段載入上下文材料（透過 Google File API 或 RAG），使其與 `AI_SYLLABUS_EDIT_USE_FILE_API` 設定保持一致。同時清理 `SyllabusAgent` 中未使用的 `rag_engine` 參數。

---

## 1. Core Changes | 核心變更

### A. Context Enrichment for Refinement (大綱編輯上下文增強)
* **Location**: `refine_course_syllabus` in `backend/app/services/ai_engine/agents/course_architect.py`
* **Behavior**:
  1. Fetch uploaded files in the course folder using `self.file_service.list_files`.
  2. If `settings.AI_SYLLABUS_EDIT_USE_FILE_API` is `True` and files exist, upload and bind them directly using the Google File API on `self.provider`.
  3. If `False`, query local RAG chunks using `self.rag_engine.query_context` with the syllabus topic/user feedback, and bind the files locally as plain text.
  4. Inject the retrieved context/file status into the auditor's system prompt so the editor can respect source materials when modifying the syllabus.

### B. Clean Up SyllabusAgent Redundant RAG Parameter (清理大綱 Agent 的 RAG 依賴)
* **Location**: `backend/app/services/ai_engine/agents/syllabus_agent.py`
* **Behavior**:
  * Remove `rag_engine: RAGEngine` from `SyllabusAgent.__init__` and remove `self.rag_engine = rag_engine` since it is unused dead code.
  * Update dependency injections (`get_syllabus_agent`) and callers (like `syllabus_worker.py`) to match the cleaned-up constructor signature.

---

## 2. Proposed File Modifications | 預期修改檔案

### [MODIFY] [course_architect.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_engine/agents/course_architect.py)
* Refactor `refine_course_syllabus` to scan the course folder, apply file binding (Google File API or local plain text), query RAG context if File API is disabled, and inject it into the prompt.
* Update `SyllabusAgent` instantiation to `SyllabusAgent(self.provider)`.

### [MODIFY] [syllabus_agent.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_engine/agents/syllabus_agent.py)
* Clean up `__init__` signature and `get_syllabus_agent` FastAPI dependency to remove RAG engine dependency.

### [MODIFY] [syllabus_worker.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/infra/scheduler/workers/syllabus_worker.py)
* Simplify agent instantiation: `agent = SyllabusAgent(provider)`.

### [MODIFY] [config.py](file:///Users/kaigiii/Coding/Learn8/backend/app/core/config.py)
* Add `AI_SYLLABUS_EDIT_USE_FILE_API: bool = True` to the application configurations.

### [MODIFY] [.env](file:///Users/kaigiii/Coding/Learn8/backend/.env)
* Add `AI_SYLLABUS_EDIT_USE_FILE_API=True` setting to local environment variables.

---

## 3. Verification Plan | 驗證計劃

### Automated Tests
Run pytest to verify that all unit and visibility tests pass successfully under clean conditions:
```bash
env -u GOOGLE_API_KEY -u GEMINI_API_KEY pytest tests
```
