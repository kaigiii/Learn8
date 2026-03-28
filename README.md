# Learn8

Learn8 是一個 AI 驅動的學習平台，把 `course draft -> file upload / RAG -> questionnaire -> learner profile -> syllabus -> lesson -> remedial` 串成一條完整學習流程。

目前 repo 只有兩個主要程式碼根目錄：

- `frontend/`: Next.js 前端
- `backend/`: FastAPI 後端

## 核心流程

1. 建立 draft course
2. 上傳文件到 course scope
3. 後端解析文件、切 chunk、寫入 Chroma
4. 建立 questionnaire generation job
5. 問卷答案摘要成 learner profile，寫回 course
6. 建立 syllabus generation job，產出 course path 與 nodes
7. 使用者進入 node，建立 lesson generation job
8. 進入 lesson session，逐題提交答案
9. 後端判定 `result`
10. 若有 failed stages，進入 remedial generation
11. remedial 完成後，lesson / node 才算真正完成

## 技術棧

### Frontend

- Next.js 14
- React 18
- TypeScript
- Zustand
- Tailwind CSS 3
- Framer Motion

### Backend

- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- ChromaDB
- Pydantic 2
- LangChain / LangGraph
- Google Gemini
- PostgreSQL `LISTEN/NOTIFY` + SSE

## 本地啟動

### Docker

```bash
cp backend/.env.example backend/.env
docker-compose up --build
```

啟動後：

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`

### 手動開發

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3.12 -m alembic upgrade head
python3.12 -m uvicorn app.main:app --reload --port 8000
```

請確認：

- `.env` 已填入 `GOOGLE_API_KEY`
- `DATABASE_URL` 指向可用的 PostgreSQL

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

若要啟動 duo socket server：

```bash
cd frontend
npm run dev:server
```

前端預設 API：

```text
http://localhost:8000/api/v1
```

如需覆蓋：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 前端架構

前端目前採用這個分層：

- `src/app/`: route-owned page modules
- `src/components/`: shared UI
- `src/features/`: 跨 route 的完整業務模組
- `src/lib/`: auth / jobs / navigation / API helpers
- `src/stores/app/`: app-global state
- `src/stores/session/`: flow/session state

### 目前主要 page modules

- `src/app/(dashboard)/home/`
- `src/app/(dashboard)/store/`
- `src/app/auth/login/`
- `src/app/auth/welcome/`
- `src/app/courses/[courseId]/`
- `src/app/questionnaire/`

### 目前保留在 `features/` 的模組

- `src/features/arena/`: lesson player / stage renderer / remedial flow
- `src/features/profile/`: shared profile settings dialog
- `src/features/questionnaire/`: questionnaire flow hooks

## 後端架構

後端主幹在 `backend/app/`：

- `api/`: route 與依賴注入
- `core/`: config / security / shared exceptions
- `db/`: SQLAlchemy base / session / registry
- `models/`: `user.py`, `course.py`, `lesson.py`, `job.py`
- `schemas/`: auth / course / questionnaire / lesson schemas
- `services/`: ai agents / workers / RAG / commons / workflows

目前實際 endpoint 模組：

- `auth.py`
- `courses.py`
- `syllabus.py`
- `lessons.py`
- `jobs.py`
- `system.py`

## AI Pipeline

### Questionnaire Generation

用途：

- 依 `topic + course context` 生成探索型問卷

輸入：

- `topic`
- `course_id`
- course files / RAG context

輸出：

- `questions`
- job `result_data.questions`

### Questionnaire Submission / Learner Profile

用途：

- 將問卷答案摘要成 learner profile

輸入：

- `questions`
- `submission`
- `topic`

輸出：

- learner profile summary
- 寫回 `courses.profile_json`

### Syllabus Generation

用途：

- 依 topic、learner profile、course context 生成 `CoursePath`

輸入：

- `topic`
- `course_id`
- `profile_summary`
- course file full-text context
- RAG context

輸出：

- `CoursePath`
- 寫入 `courses.syllabus_json`
- 扁平化 node 狀態寫入 `nodes`

### Lesson Generation

用途：

- 為單一 node 生成 `LessonStage[]`

輸入：

- `topic`
- `LessonNode`
- learner profile
- course / file / RAG context
- component registry prompt menu

輸出：

- `LessonStage[]`
- 寫入 `lessons.stage_json`
- 若 cache 合法，後端優先回傳 cache

### Answer Submission / Evaluation

用途：

- 對每一題提交做標準化與判定

輸入：

- `sessionId`
- `stageId`
- `userInput`
- `context_topic`

輸出：

- `SubmissionResponse`
- `result`: `correct | incorrect | skipped`
- `message`
- `evaluation`

### Remedial Generation

用途：

- 將同一 lesson session 中的 failed stages 打包成補救教學

輸入：

- `topic`
- `sessionId`
- `nodeId`
- `courseId`
- `failedStages[]`

輸出：

- remedial `LessonStage[]`
- 寫入 `lesson_remedials`
- session 切換到 remedial phase

## SSE Jobs

目前以下流程都走 background job + SSE：

- questionnaire generation
- syllabus generation
- lesson generation
- remedial generation

通用模式：

1. API 建立 `generation_jobs`
2. 回傳 `job_id`
3. 背景 worker 執行 AI / RAG 工作
4. worker 推送狀態到 PostgreSQL `LISTEN/NOTIFY`
5. 前端訂閱 `/api/v1/jobs/{job_id}/stream`
6. 前端可用 `/api/v1/jobs/active` 做 resume / retry / stale recovery

## 目錄結構

```text
Learn8/
├── backend/
│   ├── alembic/
│   ├── app/
│   ├── game_modules/
│   ├── chroma_db/
│   ├── uploads/
│   └── logs/
├── frontend/
│   ├── server/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       └── stores/
└── docker-compose.yml
```

## 注意事項

- `frontend/` 是目前使用中的前端
- backend 的 job streaming 依賴 PostgreSQL `LISTEN/NOTIFY`
- backend 啟動時仍有 `Base.metadata.create_all()`，正式環境應以 Alembic 為主
- 前端 upload UI 目前只開放 PDF，但 backend parser 能力比 UI 更寬

## 相關文件

- [BACKEND_DOCS.md](BACKEND_DOCS.md)
