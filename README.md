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
8. 作答後依結果前進或插入 remedial stage

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
