# Learn8

Learn8 是一個 AI 驅動的學習平台，把 `course draft -> file upload / RAG -> questionnaire -> learner profile -> syllabus -> lesson -> remedial` 串成一條完整學習流程。

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
- 測試與 AI 開關：看 `docs/TESTING.md`
- 前端分層：看 `docs/FRONTEND_ARCHITECTURE.md`
- 後端分層：看 `docs/BACKEND_ARCHITECTURE.md`
- AI / RAG 流程：看 `docs/AI_PIPELINE.md`

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

## 先安裝什麼

- `Python 3.12`
- `Node.js 20`
- `PostgreSQL 14+`
- (選用) `Docker` / `Docker Compose`

## 本地啟動

### Docker（最快）

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

### 手動（開發）

Backend：

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3.12 -m alembic upgrade head
python3.12 -m uvicorn app.main:app --reload --port 8000
```

Frontend：

```bash
cd frontend
npm install
npm run dev
```

啟動後：

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`

環境變數補充：

- `.env` 需填 `GOOGLE_API_KEY` 與 `DATABASE_URL`
- 前端 API 預設 `http://localhost:8000/api/v1`

## 前端架構

前端分層與主要模組位置的快速導覽：

- `docs/FRONTEND_ARCHITECTURE.md`

## 後端架構

後端分層、主要 API 模組與責任邊界的總覽：

- `docs/BACKEND_ARCHITECTURE.md`

## 新增題型

新增前後端題型的完整流程、對齊與驗證清單：

- `docs/QUESTION_TYPES.md`

## AI Pipeline

AI 生成流程與資料落地方式的實作對齊摘要：

- `docs/AI_PIPELINE.md`

## 相關文件

- [BACKEND_DOCS.md](BACKEND_DOCS.md)
- `docs/QUESTION_TYPES.md`
- `docs/TESTING.md`
- `docs/AI_PIPELINE.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `docs/BACKEND_ARCHITECTURE.md`
