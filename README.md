# Learn8

Learn8 是一個 AI 驅動的學習平台，把 `course draft -> file upload / RAG -> questionnaire -> learner profile -> syllabus -> lesson -> remedial` 串成一條完整學習流程。

目前 repo 只有兩個主要程式碼根目錄：

- `frontend/`: Next.js 前端
- `backend/`: FastAPI 後端

## 文件導覽

如果你想快速找到不同深度的資訊，建議這樣讀：

- 專案總覽與啟動方式：本檔 [README.md](/Users/kaigiii/Coding/Learn8/README.md)
- 後端完整架構、lifecycle、ledger、job、測試與維運說明：[BACKEND_DOCS.md](/Users/kaigiii/Coding/Learn8/BACKEND_DOCS.md)

推薦閱讀路徑：

1. 第一次進專案：先看 `README`
2. 要改 API / model / worker / migration：接著看 `BACKEND_DOCS`
3. 要排查 credits / XP / job recovery：直接跳 `BACKEND_DOCS` 裡對應章節

你可以把目前文件分成兩層理解：

- `README`：跨前後端的產品與開發入口
- `BACKEND_DOCS`：偏內部工程文件，細到可直接用來維護與排障

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

## 快速定位

如果你現在是帶著具體任務進來，可以直接跳這些區塊：

- 本地開發：看 `本地啟動`
- 後端測試與 AI 開關：看 `Backend Tests`
- 前端分層：看 `前端架構`
- 後端分層：看 `後端架構`
- AI / RAG 流程：看 `AI Pipeline`

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

#### Backend Tests

預設測試模式不會呼叫真實 AI，避免在本地開發或 CI 中持續消耗 token。
建議把這套規則當成團隊預設：

- 本機日常開發：跑 non-AI tests
- PR / CI：只跑 non-AI tests
- 只有在你要驗證 provider 串接、prompt smoke、或真實外部行為時，才手動跑 AI tests

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python3.12 -m pytest tests -q
```

如果你想手動跑會真的呼叫 AI provider 的 smoke tests：

```bash
cd backend
LEARN8_RUN_AI_TESTS=1 python3.12 -m pytest tests -m ai -q
```

測試策略：

- 一般測試：使用 fake LLM / fake RAG，不耗 token
- `@pytest.mark.ai`：只有你明確開啟時才會跑真 AI
- 適合放進 CI 的預設模式：`python3.12 -m pytest tests -q`
- 測試從 `backend/pytest.ini` 讀取 marker 規則
- `LEARN8_RUN_AI_TESTS` 沒開時，AI smoke tests 會自動 skip

CI 目前也遵守同一規則：

- backend CI：只跑不耗 token 的 pytest
- frontend CI：跑 TypeScript type check
- 真 AI smoke tests：預設不進 CI

常用情境對照：

- 想確認本地改動沒壞後端核心行為：`python3.12 -m pytest tests -q`
- 想只看某一個檔案：`python3.12 -m pytest tests/test_user_ledger.py -q`
- 想驗證真 AI provider 仍可用：`LEARN8_RUN_AI_TESTS=1 python3.12 -m pytest tests -m ai -q`
- 想看 CI 會跑什麼：查看 [ci.yml](/Users/kaigiii/Coding/Learn8/.github/workflows/ci.yml)

如果你的 Python 環境是系統管理型環境，`pip install` 可能會被拒絕。這時建議優先使用虛擬環境：

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python3.12 -m pytest tests -q
```

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
- backend schema 變更目前正式依賴 Alembic，不再使用啟動時自動 `create_all()`
- credits / XP / level 目前以 backend 為權威狀態，前端只做同步與展示
- backend ledger 與 `Idempotency-Key` 已接上 top-up / spend / reward 流程，重試請盡量沿用同一 request key
- backend 測試預設不呼叫真實 AI；要耗 token 的 smoke tests 必須手動開 `LEARN8_RUN_AI_TESTS=1`
- 前端 upload UI 目前只開放 PDF，但 backend parser 能力比 UI 更寬

## 相關文件

- [BACKEND_DOCS.md](BACKEND_DOCS.md)
