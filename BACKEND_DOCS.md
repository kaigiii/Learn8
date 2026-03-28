# Learn8 Backend Docs

這份文件以目前 `backend/app/` 的實作為準，整理後端架構、course-only 資料模型、背景任務、AI / RAG 流程與維護注意事項。

## 1. 後端定位

Learn8 後端目前負責：

- 使用者認證與個人資料
- course draft CRUD
- course file 管理
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

## 3. 核心資料模型

目前資料模型以 `course` 為核心，不再有額外的 project / journey 容器層。

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

### `CourseModel`

用途：

- course draft 容器
- file / RAG scope
- learner profile scope
- syllabus 與 node 的父層

重要欄位：

- `topic`
- `title`
- `status`
- `folder_name`
- `draft_json`
- `profile_json`
- `syllabus_json`

### `NodeModel`

用途：

- 保存扁平化 node 狀態

重要欄位：

- `course_id`
- `node_id`
- `title`
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

- 主要結果語意是 `result`
- 不應再把它理解為單純 `is_correct: bool`

### `LessonFailedStageModel`

用途：

- 保存待補救的 failed stage queue

注意：

- `incorrect` 會進 queue
- `skipped` 不進 queue

### `LessonRemedialModel`

用途：

- 保存 AI 生成出的 remedial pack

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
- `course_id`

## 4. Course Lifecycle

course 狀態目前以 `CourseStatus` 管理，主要狀態為：

- `draft`
- `questionnaire_ready`
- `profiling`
- `generating`
- `ready`
- `archived`

目前由 `services/commons/course_lifecycle.py` 集中管理：

- 哪些狀態可改 draft
- 哪些狀態可生成 questionnaire
- 哪些狀態可提交 questionnaire
- 哪些狀態可生成 syllabus
- 哪些狀態才可進入 learning flow

## 5. 主要流程

### 5.1 Course Draft Flow

1. 使用者建立 draft course
2. 上傳文件到 `uploads/<user_id>/<course_folder>/`
3. `DocumentProcessor` 解析文件
4. `RAGEngine` 切 chunk 並寫入 Chroma
5. 建立 questionnaire generation job
6. 提交 questionnaire，整理 learner profile，寫回 `courses.profile_json`
7. 建立 syllabus generation job
8. 產出 `CoursePath`，寫入 `courses.syllabus_json`
9. 扁平化 node 狀態同步寫入 `nodes`
10. 使用者點選 node，建立 / 恢復 lesson session
11. lesson 完成後，若有 failed stages，進入 remedial generation

### 5.2 Lesson / Remedial Flow

1. lesson generation 產出 primary `LessonStage[]`
2. 建立 `lesson_sessions`
3. 前端提交答案到 `/lessons/submit-answer`
4. 後端標準化 `userInput` 並計算 `result`
5. `incorrect` 會寫入 `lesson_failed_stages`
6. `skipped` 會被記錄，但不進 failed stage queue
7. primary 結束後，若 session 有 pending failed records，建立 `REMEDIAL_GEN`
8. remedial stages 寫入 `lesson_remedials`
9. session 切換到 remedial phase
10. remedial 完成後，session 才標記 `completed`
11. node status 與解鎖由後端在 session 完成點處理

### 5.3 Background Job Flow

適用於 questionnaire / syllabus / lesson / remedial generation：

1. API endpoint 建立 `generation_jobs`
2. 回傳 `job_id`
3. 背景 worker 執行 LLM / RAG 工作
4. worker 透過 `job_notifier` 更新 job 狀態
5. PostgreSQL `pg_notify('job_channel', ...)`
6. `/jobs/{job_id}/stream` 以 SSE 推送狀態
7. `/jobs/active` 提供前端 resume / reconcile
8. stale job 可透過 retry endpoint 重新排程

## 6. 目錄結構

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
- `courses.py`
- `syllabus.py`
- `lessons.py`
- `jobs.py`

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
- `course.py`
- `lesson.py`
- `job.py`

### `backend/app/schemas/`

Pydantic schemas：

- `auth_schema.py`
- `course_schema.py`
- `questionnaire_schema.py`
- `lesson_schema.py`

### `backend/app/services/`

商業邏輯與基礎設施層：

- `ai_agents/`
- `knowledge_base/`
- `llm_clients/`
- `workers/`
- `workflows/`
- `commons/`

## 7. API 模組說明

### `auth.py`

處理：

- register / login / dev-login
- `/me`
- delete account
- credits topup

### `courses.py`

處理：

- course 建立、列出、更新、刪除
- draft 讀寫
- file list / upload / delete
- questionnaire generation / submission
- node 狀態更新

刪除 course 時也會：

- 刪除實體檔案資料夾
- 清除對應 RAG embeddings

### `syllabus.py`

主職責：

- syllabus generation
- syllabus refine

生成路徑：

1. 驗證 course 狀態是否允許生成
2. 檢查點數
3. 收集 course context
4. 建立 `SYLLABUS_GEN`
5. 背景 worker 執行 `SyllabusAgent`

### `lessons.py`

主職責：

- 依 node 生成 lesson stages
- 建立 / 恢復 lesson session
- 接收答案提交
- 記錄 attempts
- 記錄 failed stages
- 觸發 remedial generation
- 處理 lesson tutor 對話

特別邏輯：

- 若 DB 中存在合法 cache，可直接回傳 cached stages
- 若 cache 含不合法或已淘汰 component，會忽略 cache 重新生成
- `FeynmanMirror` 由後端 AI grading
- `SubmissionResponse` 的主結果欄位為 `result`
- `result` 目前包含 `correct | incorrect | skipped`

### `jobs.py`

主職責：

- 以 SSE 推送 job 狀態
- 提供 active job recovery
- 提供 stale / retryable job handling

目前重要能力：

- `/jobs/{job_id}/stream`
- `/jobs/active`
- `/jobs/{job_id}/retry`
- `/jobs/{job_id}/cancel`

## 8. AI / RAG / Workflow 層

### `services/ai_agents/questionnaire_agent.py`

處理：

- 生成問卷
- 將答案摘要成 learner profile

### `services/ai_agents/syllabus_agent.py`

處理：

- 生成 `CoursePath`
- 對 unit 做 RAG-based expansion

### `services/ai_agents/course_architect.py`

處理：

- refine syllabus
- generate lesson from node
- generate remedial pack
- grade Feynman attempts
- lesson tutor 回答

### `services/knowledge_base/document_processor.py`

文件讀取入口。

目前已註冊常見文字與程式碼檔，並包含 PDF 處理能力。

### `services/knowledge_base/rag_engine.py`

用途：

- 文件切 chunk
- 寫入 Chroma
- 相似度檢索
- course / file scope 刪除

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

## 9. 主要 I/O

### Questionnaire Generation

入口：

- `POST /api/v1/courses/{course_id}/questionnaire`

輸入：

- `topic`
- `course_id`
- course files / RAG context

輸出：

- `questions`
- job `result_data.questions`

### Questionnaire Submission

入口：

- `POST /api/v1/courses/{course_id}/questionnaire/submit`

輸入：

- `topic`
- `submission`
- `questions`

輸出：

- learner profile
- 寫回 `courses.profile_json`

### Syllabus Generation

入口：

- `POST /api/v1/syllabus/generate-syllabus`

輸入：

- `topic`
- `course_id`
- `profile_summary`
- course full-text context
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
- course context
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
- `courseId`
- `failedStages[]`

輸出：

- remedial `LessonStage[]`
- 持久化到 `lesson_remedials`
- job `result_data.stages`

## 10. 維護注意事項

- backend 的 SSE 依賴 PostgreSQL `LISTEN/NOTIFY`
- Alembic migration 是正式 schema source of truth
- `game_modules/*.yaml` 與 `lesson_schema.py` / AI prompts 有強耦合
- 若新增題型，至少要同步考慮：
  - `backend/game_modules/*.yaml`
  - `lesson_schema.py` component validation
  - `lessons.py` submit / evaluation 邏輯
  - prompt 規格與前端 renderer

## 11. 相關文件

- [README.md](README.md)
