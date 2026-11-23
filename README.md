# Learn8

Learn8 是一個先進且完整的 **AI 驅動型學習平台**。透過大語言模型（LLM）、向量語義檢索（RAG）、多代理人大綱審核與高擬真度語音合成技術，將 `Course Draft -> File Upload / RAG -> Questionnaire -> Learner Profile -> Syllabus -> Lesson -> Remedial` 串聯成極致流暢的學習閉環！

## 核心特色與亮點

- **多代理人協作大綱生成 (Planner & Auditor Agents)**：不單靠單次 Prompt 生成大綱，而是透過規劃者與審核者兩大 AI 代理人多輪迭代微調，確保課程結構兼具深度與邏輯流暢度。
- **可插拔式學習組件 (Pluggable Components)**：基於 YAML 驅動的動態組件架構，可根據需求隨時擴充、熱插拔多樣化的學習體驗（如 `ExplainerMedia`, `FeynmanMirror` 等），並自動與 AI 考官綁定。
- **異步 SSE Job 佇列與中斷重連**：生成任務全部異步處理，經由 PostgreSQL `LISTEN/NOTIFY` 實時推播進度。
- **實時競技場與 Elo 天梯排行**：支援多學員 WebSocket 實時對戰搶答，並提供基於 Elo 標準的天梯積分排行榜！
- **高擬真 VoxCPM 語音助教**：提供聲音設計、可控與極致音色克隆三大模式，隨時預建題目的精準發音快取。

## 核心學習流程

1. **建立課程草稿**：學員提交想探索的主題（Topic）或自訂學習偏好。
2. **教材文件上傳與 RAG 提取**：後端讀取 PDF/Markdown 全文，切分 Chunk 並將向量特徵寫入 ChromaDB 本地持久化資料庫。
3. **動態探索診斷問卷**：AI 依主題與知識庫提取的 Context 生成 3 道探索型問卷。
4. **生成學員畫像 (Learner Profile)**：分析問卷回答，摘要出專屬的學習風格與能力層次。
5. **多代理人生成知識大綱**：`SyllabusAgent` 的 **Planner** 與 **Auditor** 進行最多 N 次的對答與修正迭代，產出完整的單元與知識地圖節點（Units & Nodes）。
6. **關卡題目生成**：為節點生成動態組合的學習組件序列。
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
- **WebSockets** (競技場實時對戰與社交聊天網關)
- **Redis 5** (高併發快取層與 Pub/Sub 消息分發)
- **Pydantic 2** (大綱 Schema 驗證與模型定義)
- **LangChain / LangGraph** (多代理人協作與 RAG 核心)
- **Google Gemini** & **OpenAI LLM APIs**
- **VoxCPM Engine** (基於 PyTorch 的 Zero-shot 高擬真語音合成)
- **ChromaDB** & **Vector Embeddings** (向量語義特徵庫與語義檢索)
- **Document Parsing** (`MarkItDown`, `PyMuPDF`, `pdfplumber`) (PDF / Word / PPT / Excel 教材解析)
- **Security Architecture** (JWT 認證, Bcrypt 密碼雜湊, OAuth2 規範)
- **PyYAML** & **JSON Repair** (YAML 題型解析與 JSON 輸出修復)

## 安裝與執行

完整步驟（Docker 一鍵啟動、手動安裝、選用功能、測試、常見問題）見 **[INSTALLATION.md](INSTALLATION.md)**。
使用的第三方程式庫、外部服務與開發工具見 **[THIRD_PARTY_LIBRARIES.md](THIRD_PARTY_LIBRARIES.md)**。

快速啟動（Docker）：

```bash
cp backend/.env.example backend/.env   # 填入 GOOGLE_API_KEY
docker compose up --build
docker compose exec backend python -m alembic upgrade head
```

- Frontend: `http://localhost:13104`
- Backend API docs: `http://localhost:13105/docs`

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

- [安裝與執行說明](./INSTALLATION.md)
- [第三方程式庫與開發工具清單](./THIRD_PARTY_LIBRARIES.md)
- [MUSE 2 腦波模組說明](./muse2/README.md)
