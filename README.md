# Learn8

Learn8 是一個先進且完整的 **AI 驅動型學習平台**。透過大語言模型（LLM）、向量語義檢索（RAG）、多代理人大綱審核與高擬真度語音合成技術，將 `Course Draft -> File Upload / RAG -> Questionnaire -> Learner Profile -> Syllabus -> Lesson -> Remedial` 串聯成極致流暢的學習閉環！

## 核心特色與亮點

- **多代理人協作大綱生成 (Planner & Auditor Agents)**：不單靠單次 Prompt 生成大綱，而是透過規劃者與審核者兩大 AI 代理人多輪迭代微調，確保課程結構兼具深度與邏輯流暢度。
- **5 大核心關卡組件**：每個主題節點強制包含 5 大精心設計的學習體驗（`ExplainerMedia`, `FeynmanMirror`, `MatchingPairs`, `MultipleChoice`, `Ordering`），並與 AI 自動考官綁定。
- **異步 SSE Job 佇列與中斷重連**：生成任務全部異步處理，經由 PostgreSQL `LISTEN/NOTIFY` 實時推播進度。
- **實時競技場與 Elo 天梯排行**：支援多學員 WebSocket 實時對戰搶答，並提供基於 Elo 標準的天梯積分排行榜！
- **高擬真 VoxCPM 語音助教**：提供聲音設計、可控與極致音色克隆三大模式，隨時預建題目的精準發音快取。

## 核心學習流程

1. **建立課程草稿**：學員提交想探索的主題（Topic）或自訂學習偏好。
2. **教材文件上傳與 RAG 提取**：後端讀取 PDF/Markdown 全文，切分 Chunk 並將向量特徵寫入 ChromaDB 本地持久化資料庫。
3. **動態探索診斷問卷**：AI 依主題與知識庫提取的 Context 生成 3 道探索型問卷。
4. **生成學員畫像 (Learner Profile)**：分析問卷回答，摘要出專屬的學習風格與能力層次。
5. **多代理人生成知識大綱**：`SyllabusAgent` 的 **Planner** 與 **Auditor** 進行最多 N 次的對答與修正迭代，產出完整的單元與知識地圖節點（Units & Nodes）。
6. **關卡題目生成**：為節點生成 5 大固定的學習組件。
7. **作答與評估**：學員進入關卡逐題提交作答，後端動態對比或透過 AI 評量費曼（Feynman）論述。
8. **錯題補救複習 (Remedial Phase)**：若在作答中答錯，系統自動觸發背景任務，針對錯題生成補救教學關卡。
9. **解鎖節點與發放獎勵**：通關後解鎖下一知識地圖節點，同時發放 XP 經驗值與 Credits 點數，寫入不可竄改的用戶帳本！
10. **社群分享與競技 PK**：學員可一鍵分享、Sandbox Fork 好友課程，或在競技場（Arena）中實時搶答、挑戰全站天梯排行榜！
## 技術棧

### Frontend

- **Next.js 14** (App Router 支援)
- **React 18** & **React DOM**
- **TypeScript 5**
- **Zustand 4** (全局狀態管理)
- **Tailwind CSS 3** & **Autoprefixer / PostCSS**
- **Framer Motion 12** (流暢 UI 微動畫)
- **React Easy Crop** & **React Icons**

### Backend

- **FastAPI** (異步高效能 Web API)
- **SQLAlchemy 2** (大綱地圖與多資料表連動)
- **Alembic** (資料庫無縫遷移)
- **PostgreSQL** (`psycopg2-binary`, `asyncpg`)
- **PostgreSQL `LISTEN/NOTIFY` + SSE** (非同步背景 Job 進度推送)
- **Redis 5** (高併發快取層)
- **Pydantic 2** (大綱 Schema 驗證)
- **LangChain / LangGraph** (多代理人核心)
- **Google Gemini** & **OpenAI LLM APIs**
- **ChromaDB** (`langchain-chroma`) & **PyMuPDF / PyPDF** (向量語義特徵庫與文件解析)
- **PyYAML** & **JSON Repair** (YAML 題型解析與 JSON 輸出修復)

## 先安裝什麼

- `Python 3.12+`
- `Node.js 20+`
- `PostgreSQL 14+`
- `Redis 6+`
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

## Linux 安裝 Redis

  ```bash
  sudo apt update
  sudo apt install redis-server -y
  ```
## Redis 防火牆設置
  ```bash
  sudo ufw allow 6379
  ```

## windows wsl 啟動 redis
  ```bash
  sudo service redis-server start
  ```
## 常用指令 (Useful Scripts)

所有的腳本建議在 `backend` 目錄下執行：

- **完整重置資料庫**：清空所有資料表並重新建立 Schema（開發與測試首選）。
  ```bash
  python3.12 -m scripts.full_reset_db
  ```
- **資料庫遷移**：將資料庫結構更新至最新版本。
  ```bash
  python3.12 -m alembic upgrade head
  ```

## 相關文件

- [1. 題型組件管理與增刪指南](docs/active_docs/1_component_management.md)
- [2. API 服務與 VoxCPM 微服務指南](docs/active_docs/2_api_service_guide.md)
- [3. 個人化課程生成流與核心流程功能](docs/active_docs/3_personalization_generation.md)
- [4. 競技場功能與對決流程](docs/active_docs/4_arena_flows.md)
- [5. 自製與自訂課程流程指南](docs/active_docs/5_custom_courses_flows.md)
- [6. 全站技術架構與亮點總覽](docs/active_docs/6_architecture_overview.md)

