# Learn8 Backend Docs

這份文件以目前 `backend/app/` 的實際程式碼為準，整理後端架構、主流程、核心檔案與維護注意事項。

舊版文件的主要問題是：

- 以「逐檔 docstring 彙編」為主，不利於理解真實執行路徑
- 混入已過時命名，例如 `schemas/auth.py`，但現況為 `auth_schema.py`
- 把主流程模組、輔助模組、維護用端點放在同一層級描述
- 有些描述和現行程式碼不一致，例如資料庫假設、課綱生成流程與 prompt 來源

本文件改成「架構優先、流程優先、現況優先」。

## 1. 後端總覽

後端技術棧：

- Web framework: FastAPI
- ORM: SQLAlchemy
- Schema validation: Pydantic
- LLM provider abstraction: Google Gemini / LMStudio
- RAG: Chroma + Google embeddings
- Workflow: LangGraph
- 非同步長任務回報: BackgroundTasks + PostgreSQL `LISTEN/NOTIFY` + SSE

後端主要負責：

- 使用者認證與個人資料
- 專案建立、刪除、草稿保存
- 文件上傳、解析、向量化
- 問卷生成與 learner profile 摘要
- syllabus 生成、修正、持久化
- lesson stage 生成、補救教學、答題評估
- job 狀態追蹤與即時推播

## 2. 目前實際的主流程

### 2.1 Project Workspace Flow

1. 使用者建立 project
2. 上傳文件到 `uploads/<user_id>/<project_folder>/`
3. 文件經 `DocumentProcessor` 解析後寫入 Chroma
4. 生成 questionnaire
5. 提交 questionnaire 生成 learner profile，寫入 `projects.profile_json`
6. 以 topic + profile + project context 生成 syllabus
7. syllabus 寫入 `courses`，node 狀態同步寫入 `nodes`
8. 使用者點選 node 後生成 lesson stages
9. 使用者作答，必要時產生 remedial stage

### 2.2 長任務 Flow

適用於 questionnaire / syllabus / lesson generation：

1. API endpoint 建立 `generation_jobs` 紀錄
2. 回傳 `job_id`
3. 背景 worker 執行 LLM / RAG 工作
4. worker 呼叫 `job_notifier._notify_job_update()`
5. PostgreSQL `pg_notify('job_channel', ...)`
6. `/jobs/{job_id}/stream` 透過 SSE 把進度推給前端

注意：

- 這套即時回報依賴 PostgreSQL `LISTEN/NOTIFY`
- 若使用 SQLite，SSE 這條路徑不會正常運作

## 3. 目錄結構與定位

### `backend/app/main.py`

應用程式入口。

職責：

- 建立 FastAPI app
- 設定 CORS
- 載入 `api_router`
- 啟動時執行 `Base.metadata.create_all(bind=engine)`

注意：

- `create_all()` 偏開發期便利用法，正式環境應以 Alembic migration 為主

### `backend/app/api/`

API 層，負責：

- 路由定義
- 權限驗證
- 請求參數解析
- 呼叫 service / worker

重要檔案：

- `dependencies.py`: `get_db()`、`get_current_user()`
- `v1/api.py`: 組合所有 domain routers

### `backend/app/api/v1/endpoints/`

目前實際有用的 endpoint 模組：

- `auth.py`: 註冊、登入、dev login、`/me`、點數 topup
- `projects.py`: project CRUD、draft 儲存/讀取
- `project_files.py`: 上傳、列出、刪除專案文件
- `questionnaire.py`: 問卷生成與提交
- `courses.py`: 查課程、查課程細節、更新 node 狀態
- `syllabus.py`: 生成 syllabus、refine syllabus
- `lessons.py`: 生成 lesson、提交答案、補救教學 / Feynman grading
- `jobs.py`: SSE job stream、active job recovery
- `system.py`: 危險維護端點，例如 reset DB、clear files

### `backend/app/core/`

核心設定與跨模組共用能力。

- `config.py`: 環境變數與全域設定
- `security.py`: JWT、password hash / verify
- `exceptions.py`: 自訂例外
- `prompts.py`: 課程、補救、Feynman 等 prompt
- `component_loader.py`: 讀取 `backend/game_modules/*.yaml`

補充：

- `component_loader.py` 不是死檔案，會被 `core/prompts.py` 與 `schemas/lesson_schema.py` 間接使用
- 它的用途是把前後端互動組件的能力與 schema 要求注入 LLM prompt / schema validation 流程

### `backend/app/db/`

資料庫基礎層。

- `base.py`: SQLAlchemy Base
- `session.py`: `engine` 與 `SessionLocal`
- `registry.py`: 匯入所有 model，讓 `create_all()` 能建立資料表

### `backend/app/models/`

ORM models，對應資料表。

- `user.py`: 使用者與 credits、profile 欄位
- `project.py`: 專案、檔案實體路徑、profile、draft
- `course.py`: syllabus 與扁平化 node 狀態
- `lesson.py`: 生成後的 lesson stages 與 lesson attempts
- `job.py`: 背景任務狀態追蹤

### `backend/app/schemas/`

Pydantic schemas，供 API request/response 與 LLM structured output 使用。

現況檔名如下：

- `auth_schema.py`
- `project_schema.py`
- `questionnaire_schema.py`
- `course_schema.py`
- `lesson_schema.py`

注意：

- 舊文件中的 `schemas/auth.py`、`schemas/course.py` 等名稱已不準確
- `lesson_schema.py` 不只給 API 用，也承接 LLM 回傳 lesson stage 的驗證

### `backend/app/services/`

商業邏輯與基礎設施層。

子目錄定位：

- `ai_agents/`: syllabus / lesson / questionnaire 相關 AI orchestration
- `knowledge_base/`: 文件解析與 RAG
- `llm_clients/`: LLM provider abstraction
- `workers/`: 長任務背景執行
- `workflows/`: LangGraph workflow
- `commons/`: file service、activity logger

## 4. 核心資料模型

### `UserModel`

用途：

- 認證主體
- 儲存 credits
- 儲存基本個人資料欄位

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
- `NodeModel` 保存扁平化 node 狀態，方便快速更新與查詢

重要欄位：

- `topic`
- `title`
- `syllabus_json`
- `node_id`
- `status`
- `data`

### `LessonModel` / `LessonAttempt`

用途：

- 保存 node 對應的 stage list
- 保存使用者作答紀錄

注意：

- `LessonAttempt.is_correct` 目前是 `String`，不是 `Boolean`

### `JobModel`

用途：

- 保存背景任務狀態
- 作為 SSE 狀態來源

重要欄位：

- `job_type`
- `status`
- `progress`
- `message`
- `result_data`

## 5. API 模組說明

### `auth.py`

處理：

- register / login / dev-login
- 讀取與更新 `/me`
- 刪除帳號
- credits topup

注意：

- `dev-login` 會自動建立 `dev@learn8.ai`

### `projects.py`

處理：

- project 建立、列出、更新、刪除
- draft 保存與載入

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

其中 learner profile 會寫回 `ProjectModel.profile_json`

### `syllabus.py`

主職責：

- syllabus 生成
- syllabus refine

生成路徑：

1. 檢查是否已有相同 topic 的課程可直接回傳
2. 檢查點數
3. 收集 project 檔案全文摘要
4. 建立 `SYLLABUS_GEN` job
5. 背景 worker 執行 `SyllabusAgent`

refine 路徑：

- 透過 `services/workflows/syllabus_workflow.py` 的 LangGraph 執行單步 refine

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
- 接收答案提交
- 判斷 `proceed` 或 `remedial`

特別邏輯：

- 如果 DB 中已存在該 node / topic / user / project 的 lesson，會直接回傳 cached stages
- `FeynmanMirror` 會走 AI grading，而不是只用前端判斷

### `jobs.py`

主職責：

- 以 SSE 推送 job 狀態
- 在前端重整後恢復 active job

技術依賴：

- `asyncpg`
- PostgreSQL `LISTEN/NOTIFY`

### `system.py`

用途：

- 維護與除錯

風險：

- 提供 reset database 與 clear files 這類高風險操作
- 文件應明確標註為管理用途，不應視為一般產品 API

## 6. AI / RAG / Workflow 層

### `services/ai_agents/syllabus_agent.py`

目前 syllabus 生成的主路徑。

流程：

1. 先生成高階 blueprint
2. 對每個 unit 做 RAG-based expansion
3. 組出 `CoursePath`
4. 將第一個 node 設為 `available`

特性：

- unit expansion 具並發控制
- prompt 定義直接在這個檔案內

### `services/ai_agents/course_architect.py`

處理：

- refine syllabus
- generate lesson from node
- generate remedial stage
- grade Feynman attempts

注意：

- `generate_course_syllabus()` 目前存在，但 syllabus 主流程實際上是由 `SyllabusAgent` 負責，不是這個方法

### `services/ai_agents/questionnaire_agent.py`

處理：

- 生成多選問卷
- 將問卷回答摘要成 learner profile

### `services/knowledge_base/document_processor.py`

文件讀取入口。

會依副檔名路由到不同 parser，目前已註冊：

- `.pdf`
- `.txt`
- `.md`
- `.csv`
- `.json`
- `.py`
- `.js`
- `.tsx`

### `services/knowledge_base/parsers/`

用途：

- PDF 與文字檔解析

重點檔案：

- `pdf_router.py`: 根據設定選擇 basic / vision / hybrid
- `pdf_basic.py`
- `pdf_vision.py`
- `pdf_hybrid.py`
- `text.py`

### `services/knowledge_base/rag_engine.py`

用途：

- 文件切 chunk
- 寫入 Chroma
- 相似度檢索
- project/file 範圍刪除

重要行為：

- metadata 含 `project_id` 與 `source`
- 查詢結果會注入 `[Source: xxx]`
- query expansion 目前是可選功能，不是預設開啟

### `services/llm_clients/`

用途：

- 封裝 LLM provider 差異

重要檔案：

- `base_provider.py`: provider interface 與共用 context injection
- `factory.py`: 依設定建立 provider
- `google_adapter.py`: Gemini provider
- `lmstudio_adapter.py`: LMStudio provider

### `services/workers/`

用途：

- 執行長任務

重要檔案：

- `questionnaire_worker.py`
- `syllabus_worker.py`
- `lesson_worker.py`
- `job_notifier.py`

說明：

- `job_notifier.py` 是三種 worker 共用的狀態更新樞紐

### `services/workflows/syllabus_workflow.py`

用途：

- 目前只承接 syllabus refine 的 LangGraph workflow

注意：

- 它不是一個大型多節點 workflow，目前只有單一步驟 `refine`

## 7. 哪些檔案是核心，哪些不是

### 核心主流程檔案

- `main.py`
- `api/dependencies.py`
- `api/v1/endpoints/projects.py`
- `api/v1/endpoints/project_files.py`
- `api/v1/endpoints/questionnaire.py`
- `api/v1/endpoints/syllabus.py`
- `api/v1/endpoints/courses.py`
- `api/v1/endpoints/lessons.py`
- `api/v1/endpoints/jobs.py`
- `services/ai_agents/syllabus_agent.py`
- `services/ai_agents/course_architect.py`
- `services/ai_agents/questionnaire_agent.py`
- `services/knowledge_base/document_processor.py`
- `services/knowledge_base/rag_engine.py`
- `services/workers/*.py`

### 存在但不是主生成路徑的模組

- `api/v1/endpoints/system.py`: 管理用途
- `services/workflows/syllabus_workflow.py`: 只處理 refine
- `core/component_loader.py`: 支援動態 component registry，不是 API 主流程入口
- `course_architect.py` 內的 `generate_course_syllabus()`: 存在，但非目前 syllabus 主路徑

### 不應納入文件主體的內容

- `__pycache__/`
- `.pyc`
- 舊命名或猜測式檔名

## 8. 目前文件維護準則

之後更新這份文件時，請遵守以下原則：

1. 以實際 import 與執行路徑為準，不以檔名推測功能
2. 優先描述「主流程」而不是逐檔複製註解
3. 若某檔案存在但非主路徑，直接標註，不要假裝它是核心
4. 若某功能依賴特殊基礎設施，必須寫清楚
   例如：`jobs.py` 依賴 PostgreSQL，而不是任意 SQLAlchemy database
5. schema 檔案名稱需以目前檔名為準
   例如：`auth_schema.py`，不是 `auth.py`

## 9. 目前值得注意的技術風險

- `main.py` 啟動時直接 `create_all()`，和 Alembic 並存時容易讓 schema 管理失焦
- `config.py` 內 `SECRET_KEY` 有預設值，若部署漏設會有安全風險
- `jobs.py` 依賴 PostgreSQL `LISTEN/NOTIFY`，但文件若仍寫 SQLite 會誤導
- `system.py` 提供高風險管理操作，應避免暴露在非管理環境
- `LessonAttempt.is_correct` 目前是字串欄位，不是布林

## 10. 結論

目前 backend 不是單純 CRUD API，而是由以下三條主軸構成：

- `Project + File + RAG`
- `Questionnaire + Learner Profile + Syllabus`
- `Lesson Generation + Submission + Remedial + SSE Jobs`

理解這三條主軸，比逐檔背誦 docstring 更接近這個專案的真實架構。
