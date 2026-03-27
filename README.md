# Learn8

Learn8 是一個 AI 驅動的學習平台，把 `project -> file upload / RAG -> questionnaire -> learner profile -> syllabus -> lesson -> remedial` 串成一條完整學習流程。

目前 repo 內同時存在兩套前端：

- `frontend_new/`: 目前主要開發中的新版前端
- `frontend/`: 舊版前端，仍然被 `docker-compose.yml` 使用

後端為 `backend/`，採用 FastAPI、SQLAlchemy、PostgreSQL、Chroma，並以 background job + SSE 提供長任務進度與恢復能力。

## 專案現況

### 主要程式碼來源

- 主前端: `frontend_new/`
- 舊前端: `frontend/`
- 後端: `backend/`

### 目前真實的核心流程

1. 使用者建立 project
2. 上傳文件到 project scope
3. 後端解析文件、切 chunk、寫入 Chroma
4. 建立 questionnaire generation job
5. 問卷答案摘要成 learner profile，寫回 project
6. 建立 syllabus generation job，產出 course 與 nodes
7. 使用者進入 node，建立 lesson generation job
8. 進入 lesson session，逐題提交答案
9. 後端根據 `result` 判定答題結果
10. 若有 failed stages，進入 remedial generation
11. remedial 完成後才算 lesson / node 真正完成

## 技術棧

### Frontend (`frontend_new`)

- Next.js 14
- React 18
- TypeScript
- Zustand
- Tailwind CSS 3
- Framer Motion
- Socket.IO client（duo 模式）

### Backend

- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- ChromaDB
- Pydantic 2
- LangChain / LangGraph
- Google Gemini

## 本地啟動

### 1. Docker

目前 `docker-compose.yml` 仍然接的是 **舊版 `frontend/`**，不是 `frontend_new/`。

啟動方式：

```bash
cp backend/.env.example backend/.env
docker-compose up --build
```

啟動後：

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`

注意：

- Docker compose 目前主要適合驗證後端與舊版前端整體啟動
- 若你在開發新版 UI，請使用下面的手動開發方式

### 2. 手動開發

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

#### Frontend (`frontend_new`)

```bash
cd frontend_new
npm install
npm run dev
```

若要啟動 duo socket server：

```bash
cd frontend_new
npm run dev:server
```

前端預設連線：

```text
http://localhost:8000/api/v1
```

如需覆蓋：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 前端架構

新版前端目前採這個分層：

- `src/app/`: route-owned page modules
- `src/components/`: shared UI
- `src/features/`: 跨 route 的完整業務模組
- `src/lib/`: auth / jobs / navigation / API helpers
- `src/stores/app/`: app-global state
- `src/stores/session/`: flow/session state

### 目前實際的 page modules

- `src/app/(dashboard)/home/`
- `src/app/(dashboard)/store/`
- `src/app/auth/login/`
- `src/app/auth/welcome/`
- `src/app/courses/[courseId]/`
- `src/app/questionnaire/`

### 保留在 `features/` 的模組

- `src/features/arena/`: lesson player / stage renderer / remedial flow
- `src/features/profile/`: shared profile settings dialog

## Lesson Stage Components

目前前後端共同註冊的互動題型：

- `MultipleChoice`
- `Ordering`
- `MatchingPairs`
- `FeynmanMirror`

### 後端定義

```text
backend/game_modules/
```

### 新版前端註冊入口

```text
frontend_new/src/features/arena/renderers/index.ts
```

### 前端題型 UI

```text
frontend_new/src/components/arena/
```

## AI Pipeline

### 1. Questionnaire Generation

用途：

- 針對 `topic + project context` 生成探索型問卷

輸入：

- `topic`
- `project_id`
- project files / RAG context

輸出：

- `questions`
- job `result_data.questions`

### 2. Questionnaire Submission / Learner Profile

用途：

- 將問卷答案摘要成 learner profile

輸入：

- `questions`
- `submission`
- `topic`

輸出：

- learner profile summary
- 寫回 `projects.profile_json`

### 3. Syllabus Generation

用途：

- 依 topic、learner profile、project context 生成 `CoursePath`

輸入：

- `topic`
- `project_id`
- `profile_summary`
- project file full-text context
- RAG context

輸出：

- `CoursePath`
- 寫入 `courses.syllabus_json`
- 扁平化 node 狀態寫入 `nodes`

### 4. Lesson Generation

用途：

- 為單一 node 生成 `LessonStage[]`

輸入：

- `topic`
- `LessonNode`
- learner profile
- project / file / RAG context
- component registry prompt menu

輸出：

- `LessonStage[]`
- 寫入 `lessons.stage_json`
- 若 cache 合法，後端優先回傳 cache

### 5. Answer Submission / Evaluation

用途：

- 對使用者每一題的提交做標準化與判定

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

### 6. Remedial Generation

用途：

- 將同一 lesson session 中的 failed stages 打包成補救教學

輸入：

- `topic`
- `sessionId`
- `nodeId`
- `projectId`
- `failedStages[]`

輸出：

- 一整包 remedial `LessonStage[]`
- 寫入 `lesson_remedials`
- session 切換到 remedial phase

### 7. Feynman Grading

用途：

- 對 `FeynmanMirror` 的 learner explanation 做 AI 評分

輸入：

- learner explanation
- topic
- stage prompt
- sample answer

輸出：

- grading result
- feedback
- `result`

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
│   └── ... legacy frontend
├── frontend_new/
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

- `frontend_new/` 才是目前主要開發中的新版前端
- `docker-compose.yml` 目前仍接 `frontend/`
- backend 的 job streaming 依賴 PostgreSQL `LISTEN/NOTIFY`
- backend 啟動時仍有 `Base.metadata.create_all()`，正式環境仍應以 Alembic 為主
- 前端 upload UI 目前只開放 PDF，但 backend parser 能力比 UI 更寬

## 相關文件

- [BACKEND_DOCS.md](BACKEND_DOCS.md)
- [LEGACY_FRONTEND.md](LEGACY_FRONTEND.md)
