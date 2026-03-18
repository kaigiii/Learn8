# Learn8

Learn8 是一個 AI 驅動的學習平台，將上傳資料、問卷、RAG 與遊戲化 lesson stages 串成一條完整學習流程。

目前專案採前後端分離架構：

- `frontend/`: Next.js 16 + TypeScript
- `backend/`: FastAPI + SQLAlchemy + Chroma
- `postgres`: 用於主資料庫與 job status 推播

## 核心流程

1. 使用者建立 project
2. 上傳文件到 project scope
3. 後端解析文件並寫入 Chroma
4. 生成 questionnaire
5. 問卷答案整理成 learner profile
6. 以 topic + profile + project context 生成 syllabus
7. 點選 node 生成 lesson stages
8. 作答後依結果前進，並在 lesson 結束後視需要附加 remedial stages

## 技術棧

### Frontend

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tailwind CSS
- Framer Motion
- React Flow

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- ChromaDB
- LangChain / LangGraph
- Google Gemini API

## 本地啟動

### Docker

這是目前最直接的啟動方式。

1. 建立後端環境檔：

```bash
cp backend/.env.example backend/.env
```

2. 編輯 `backend/.env`，至少填入：

```bash
GOOGLE_API_KEY=your_key
SECRET_KEY=your_secret
```

3. 啟動：

```bash
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
```

請確認 `.env` 中的 `DATABASE_URL` 指向可用的 PostgreSQL。

啟動：

```bash
python3.12 -m uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

前端預設會連到：

```bash
http://localhost:8000/api/v1
```

如需覆蓋，可自行設定：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 目前實作中的主要功能

- JWT login / dev login
- project CRUD
- project draft 保存
- project file upload / delete
- 文件解析與向量化
- questionnaire generation
- learner profile summarization
- syllabus generation / refinement
- node-based lesson generation
- remedial stage generation
- Feynman-style answer grading
- SSE job progress streaming

## Stage Components

目前前端已註冊的互動組件：

- `MultipleChoice`
- `Ordering`
- `MatchingPairs`
- `FeynmanMirror`

後端對應的 YAML 定義位於：

```text
backend/game_modules/
```

前端註冊入口位於：

```text
frontend/src/features/stage-player/components/ComponentRegistry.tsx
```

## AI Pipeline

目前 AI 調用分成 5 條主要路徑，輸入與輸出如下。

### 1. Questionnaire Generation

用途：

- 先針對特定 `topic` 與 project 內容生成探索問卷

帶入資訊：

- `topic`
- `project_id`
- project scope 下已上傳的檔案內容與向量資料

輸出：

- `questions: Question[]`
- 前端再把問卷答案送回 backend，整理成 `LearnerProfile`
- `LearnerProfile` 會寫入 `projects.profile_json`

### 2. Syllabus Generation

用途：

- 根據使用者主題、學習者摘要與 project context 生成 `CoursePath`

帶入資訊：

- `topic`
- `project_id`
- `profile_summary` from questionnaire submission
- project file full-text context
- RAG / vector retrieval context

輸出：

- `CoursePath`
- 持久化為 `courses.syllabus_json`
- 扁平化 node 狀態寫入 `nodes`

### 3. Lesson Generation

用途：

- 點選 syllabus node 後，為單一 node 生成一組 `LessonStage[]`

帶入資訊：

- `topic`
- `node.id`
- `node.title`
- `node.description`
- learner profile summary
- RAG context
- game module registry prompt menu 與 schema reference

輸出：

- `LessonStage[]`
- 持久化為 `lessons.stage_json`
- 若已有合法 cache，後端會優先回傳 cache

### 4. Remedial Generation

用途：

- lesson 結束後，將整包錯題一次交給 AI 生成補救教學

帶入資訊：

- `topic`
- `failedStages[]`
- 每筆 failed record 內含原始 `LessonStage`、`userInput`、`isCorrect`
- `nodeId`
- `projectId`

輸出：

- AI 自行決定數量的 remedial `LessonStage[]`
- 透過 `REMEDIAL_GEN` job + SSE 回傳
- 持久化到 `lesson_remedials`
- 重新打開同一個 node 時，會和主 lesson stages 合併回傳

### 5. Feynman Grading

用途：

- 對 `FeynmanMirror` 的自由回答做 AI 評分

帶入資訊：

- `topic`
- `user_explanation`
- RAG context

輸出：

- `isCorrect: boolean`
- `feedback: string`

## SSE Jobs

目前以下流程都採用 background job + SSE：

- questionnaire generation
- syllabus generation
- lesson generation
- remedial generation

通用模式：

1. API 先建立 `generation_jobs` 紀錄
2. 回傳 `job_id`
3. 背景 worker 執行 AI / RAG 流程
4. worker 透過 PostgreSQL `LISTEN/NOTIFY` 推送進度
5. 前端訂閱 `/api/v1/jobs/{job_id}/stream`
6. 完成後從 `result_data` 取回最終 payload

## 目錄結構

```text
Learn8/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── chroma_db/
│   ├── game_modules/
│   └── uploads/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── stores/
│       └── types/
└── docker-compose.yml
```

## 注意事項

- README 以目前程式碼為準，不保留舊版規劃性描述
- backend 的 job streaming 依賴 PostgreSQL `LISTEN/NOTIFY`，不是任意資料庫都可替代
- backend 啟動時仍會執行 `Base.metadata.create_all()`，目前偏開發模式
- 前端目前上傳 UI 實際上只開放 PDF，但 backend 的文件解析能力比 UI 更寬

## 相關文件

- [BACKEND_DOCS.md](BACKEND_DOCS.md)
