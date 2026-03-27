# Learn8 Backend Docs

這份文件以目前 `backend/app/`、`backend/game_modules/`、以及已經接上的新版前端資料流為準，整理後端架構、實際主流程、核心資料模型、長任務機制與維護注意事項。

## 1. 後端定位

Learn8 後端目前負責：

- 使用者認證與個人資料
- project CRUD、draft、project file 管理
- 文件解析、切 chunk、寫入 Chroma
- questionnaire generation / submission
- learner profile summary
- syllabus generation / refine
- lesson generation
- lesson session / attempt / failed stage persistence
- remedial generation
- Feynman grading
- job 狀態追蹤、SSE stream、active job resume / retry

## 2. 技術棧

- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- Pydantic 2
- ChromaDB
- LangChain / LangGraph
- Google Gemini / LMStudio abstraction
- PostgreSQL `LISTEN/NOTIFY` + SSE

## 3. 目前真實主流程

### 3.1 Project Workspace Flow

1. 使用者建立 project
2. 上傳文件到 `uploads/<user_id>/<project_folder>/`
3. `DocumentProcessor` 解析文件
4. `RAGEngine` 切 chunk 並寫入 Chroma
5. 建立 questionnaire generation job
6. 提交 questionnaire，整理 learner profile，寫回 `projects.profile_json`
7. 建立 syllabus generation job
8. 產出 `CoursePath`，寫入 `courses.syllabus_json`
9. 扁平化 node 狀態同步寫入 `nodes`
10. 使用者點選 node，建立 / 恢復 lesson session
11. lesson 完成後，若有 failed stages，進入 remedial generation

### 3.2 Lesson / Remedial Flow

目前 lesson 不再只是「生成 stages 然後前端自己玩完」；它已經是 session-driven flow。

大致流程：

1. lesson generation 產出 primary `LessonStage[]`
2. 建立 `lesson_sessions`
3. 前端提交每一題答案到 `/lessons/submit-answer`
4. 後端標準化 `userInput` 並計算 `result`
5. `incorrect` 會寫入 `lesson_failed_stages`
6. `skipped` 會被記錄，但不進 failed stage queue
7. primary 結束後，若 session 有 pending failed records，建立 `REMEDIAL_GEN`
8. remedial stages 寫入 `lesson_remedials`
9. session 切換到 remedial phase
10. remedial 完成後，session 才標記 `completed`
11. node status 與解鎖由後端在 session 完成點處理

### 3.3 Background Job Flow

適用於 questionnaire / syllabus / lesson / remedial generation：

1. API endpoint 建立 `generation_jobs`
2. 回傳 `job_id`
3. 背景 worker 執行 LLM / RAG 工作
4. worker 透過 `job_notifier` 更新 job 狀態
5. PostgreSQL `pg_notify('job_channel', ...)`
6. `/jobs/{job_id}/stream` 以 SSE 推送狀態
7. `/jobs/active` 提供前端 resume / reconcile
8. stale job 可透過 retry endpoint 重新排程

## 4. 目錄結構

### `backend/app/main.py`

應用程式入口。

職責：

- 建立 FastAPI app
- 設定 CORS
- 掛載 `api_router`
- 啟動時執行 `Base.metadata.create_all(bind=engine)`

注意：

- `create_all()` 目前仍偏開發模式便利用法
- 正式環境資料表演進應以 Alembic migration 為主

### `backend/app/api/`

API 層，負責：

- route 定義
- 權限驗證
- request parsing
- 呼叫 services / workers

重要檔案：

- `dependencies.py`
- `v1/api.py`

### `backend/app/api/v1/endpoints/`

目前實際有用的 endpoint 模組：

- `auth.py`
- `projects.py`
- `project_files.py`
- `questionnaire.py`
- `courses.py`
- `syllabus.py`
- `lessons.py`
- `jobs.py`
- `system.py`

### `backend/app/core/`

核心設定與跨模組共用能力：

- `config.py`
- `security.py`
- `exceptions.py`
- `component_loader.py`

其中 `component_loader.py` 會讀取：

```text
backend/game_modules/*.yaml
```

用途：

- 給 `lesson_schema.py` 做 component validation
- 給 AI prompt layer 注入可用題型資訊

### `backend/app/db/`

資料庫基礎層：

- `base.py`
- `registry.py`
- `session.py`

### `backend/app/models/`

ORM models：

- `user.py`
- `project.py`
- `course.py`
- `lesson.py`
- `job.py`

### `backend/app/schemas/`

Pydantic schemas：

- `auth_schema.py`
- `project_schema.py`
- `questionnaire_schema.py`
- `course_schema.py`
- `lesson_schema.py`

### `backend/app/services/`

商業邏輯與基礎設施層：

- `ai_agents/`
- `knowledge_base/`
- `llm_clients/`
- `workers/`
- `workflows/`
- `commons/`

## 5. 核心資料模型

### `UserModel`

用途：

- 認證主體
- 儲存 credits
- 儲存基本個人資料

重要欄位：

- `email`
- `hashed_password`
- `credits`
- `full_name`
- `job_title`
- `education_level`
- `daily_learning_goal_minutes`

### `ProjectModel`

用途：

- Learn8 的核心隔離單位
- 綁定上傳文件、RAG context、learner profile、draft

重要欄位：

- `name`
- `folder_name`
- `profile_json`
- `draft_json`

### `CourseModel` / `NodeModel`

用途：

- `CourseModel` 保存完整 syllabus JSON
- `NodeModel` 保存扁平化 node 狀態

重要欄位：

- `topic`
- `title`
- `syllabus_json`
- `node_id`
- `status`
- `data`

### `LessonModel`

用途：

- 保存 node 對應的 primary lesson stage list

### `LessonSessionModel`

用途：

- 管理一次 lesson / remedial playthrough 的流程狀態

目前承載：

- primary stages
- remedial stages
- active phase
- session status

### `LessonAttempt`

用途：

- 保存每一題提交紀錄

注意：

- 目前前端 / API contract 的主要結果語意是 `result`
- 不應再把它理解為單純 `is_correct: bool`

### `LessonFailedStageModel`

用途：

- 保存待補救的 failed stage queue

注意：

- `incorrect` 會進 queue
- `skipped` 不進 queue

### `LessonRemedialModel`

用途：

- 保存 AI 生成出的 remedial stage pack

### `JobModel`

用途：

- 保存背景任務狀態
- 作為 SSE / active job recovery 的來源

重要欄位：

- `job_type`
- `status`
- `progress`
- `message`
- `result_data`

## 6. API 模組說明

### `auth.py`

處理：

- register / login / dev-login
- `/me`
- delete account
- credits topup

### `projects.py`

處理：

- project 建立、列出、更新、刪除
- draft 讀寫

刪除 project 時也會：

- 刪除實體檔案資料夾
- 清除對應 RAG embeddings

### `project_files.py`

處理：

- 列出 project files
- 上傳文件
- 刪除單一文件

上傳流程：

1. `FileService.save_upload_file()`
2. `RAGEngine.ingest_document()`

### `questionnaire.py`

分兩段：

- `POST /projects/{id}/questionnaire`: 建立背景 job，生成題目
- `POST /projects/{id}/questionnaire/submit`: 將答案摘要成 learner profile

### `syllabus.py`

主職責：

- syllabus generation
- syllabus refine

生成路徑：

1. 檢查是否已有相近課程可直接回傳
2. 檢查點數
3. 收集 project context
4. 建立 `SYLLABUS_GEN`
5. 背景 worker 執行 `SyllabusAgent`

### `courses.py`

主職責：

- 取得課程清單
- 取得課程細節
- 更新 node 狀態

node 完成時會做自動解鎖：

- 優先解鎖同 unit 的下一個 node
- 若 unit 結束，解鎖下一個 unit 的第一個 node

### `lessons.py`

主職責：

- 依 node 生成 lesson stages
- 建立 / 恢復 lesson session
- 接收答案提交
- 記錄 attempts
- 記錄 failed stages
- 觸發 remedial generation

特別邏輯：

- 若 DB 中存在合法 cache，可直接回傳 cached stages
- 若 cache 含不合法或已淘汰 component，會忽略 cache 重新生成
- `FeynmanMirror` 由後端 AI grading
- `SubmissionResponse` 的主結果欄位為 `result`
- `result` 目前包含：
  - `correct`
  - `incorrect`
  - `skipped`
- `skipped` 不進 failed stage queue

### `jobs.py`

主職責：

- 以 SSE 推送 job 狀態
- 提供 active job recovery
- 提供 stale / retryable job handling

目前重要能力：

- `/jobs/{job_id}/stream`
- `/jobs/active`
- `/jobs/{job_id}/retry`

### `system.py`

用途：

- 維護與除錯

風險：

- 含 reset database、clear files 這類高風險操作

## 7. AI / RAG / Workflow 層

### `services/ai_agents/syllabus_agent.py`

目前 syllabus generation 主路徑。

流程：

1. 先生成高階 blueprint
2. 對每個 unit 做 RAG-based expansion
3. 組出 `CoursePath`
4. 將第一個 node 設為 `available`

### `services/ai_agents/course_architect.py`

處理：

- refine syllabus
- generate lesson from node
- generate remedial pack
- grade Feynman attempts

補充：

- remedial generation 目前是整包 failed records 一次送 AI
- 不是逐題逐次呼叫

### `services/ai_agents/questionnaire_agent.py`

處理：

- 生成問卷
- 將答案摘要成 learner profile

### `services/knowledge_base/document_processor.py`

文件讀取入口。

目前已註冊：

- `.pdf`
- `.txt`
- `.md`
- `.csv`
- `.json`
- `.py`
- `.js`
- `.tsx`

### `services/knowledge_base/rag_engine.py`

用途：

- 文件切 chunk
- 寫入 Chroma
- 相似度檢索
- project / file scope 刪除

### `services/llm_clients/`

用途：

- 封裝 LLM provider 差異

重要檔案：

- `base_provider.py`
- `factory.py`
- `google_adapter.py`
- `lmstudio_adapter.py`

### `services/workers/`

用途：

- 執行長任務

重要檔案：

- `questionnaire_worker.py`
- `syllabus_worker.py`
- `lesson_worker.py`
- `job_notifier.py`

## 8. AI 調用程序與 I/O

### Questionnaire Generation

入口：

- `POST /api/v1/projects/{project_id}/questionnaire`

輸入：

- `topic`
- `project_id`
- project files / RAG context

輸出：

- `questions`
- job `result_data.questions`

### Questionnaire Submission

入口：

- `POST /api/v1/projects/{project_id}/questionnaire/submit`

輸入：

- `topic`
- `submission`
- `questions`

輸出：

- learner profile
- 寫回 `projects.profile_json`

### Syllabus Generation

入口：

- `POST /api/v1/syllabus/generate-syllabus`

輸入：

- `topic`
- `project_id`
- `profile_summary`
- project full-text context
- RAG context

輸出：

- `CoursePath`
- 寫入 `courses.syllabus_json`
- 扁平化 node 寫入 `nodes`
- job `result_data.course_id`

### Lesson Generation

入口：

- `POST /api/v1/lessons/generate-lesson-from-node`

輸入：

- `topic`
- `LessonNode`
- learner profile
- project context
- RAG context
- component prompt menu / schema reference

輸出：

- `LessonStage[]`
- 寫入 `lessons.stage_json`
- job `result_data.stages`

### Answer Submission

入口：

- `POST /api/v1/lessons/submit-answer`

輸入：

- `sessionId`
- `stageId`
- `userInput`
- `context_topic`

輸出：

- `SubmissionResponse`
- `result`
- `message`
- `evaluation`

### Remedial Generation

入口：

- `POST /api/v1/lessons/generate-remedial-stages-async`

輸入：

- `topic`
- `sessionId`
- `nodeId`
- `projectId`
- `failedStages[]`

輸出：

- remedial `LessonStage[]`
- 持久化到 `lesson_remedials`
- job `result_data.stages`

### Feynman Grading

入口：

- `POST /api/v1/lessons/submit-answer`

輸入：

- learner explanation
- topic
- prompt
- sample answer

輸出：

- grading
- feedback
- `result`

## 9. Job / SSE 狀態管理

目前 job 系統除了基本 stream 外，還支援：

- scoped active job lookup
- stale job detection
- retryable job flow
- remedial generation recovery

前端會依據：

- `job_type`
- `project_id`
- `node_id`
- `session_id`

對應回正確流程，而不是只憑單一 active job 猜測。

## 10. 維護注意事項

- backend 的 SSE 依賴 PostgreSQL `LISTEN/NOTIFY`
- SQLite 不適合作為完整開發替代方案
- Alembic migration 是正式 schema source of truth
- `game_modules/*.yaml` 與 `lesson_schema.py` / AI prompts 有強耦合
- 若新增題型，至少要同步考慮：
  - `backend/game_modules/*.yaml`
  - `lesson_schema.py` component validation
  - `lessons.py` submit / evaluation 邏輯
  - `course_architect_prompts.py` 題型生成規格

## 11. 相關文件

- [README.md](README.md)
- [LEGACY_FRONTEND.md](LEGACY_FRONTEND.md)
