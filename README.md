# Learna v3 (NeoLearn 3.0) 🚀

**Learna v3** 是一個次世代的 AI 驅動學習平台，旨在將靜態的知識（PDF、文件）轉化為動態、遊戲化的學習路徑。結合了 RAG (Retrieval-Augmented Generation)、Agentic Workflow 與遊戲化教學法，提供高度客製化的學習體驗。

---

## ✨ 核心功能 (Core Features)

### 1. 🧠 專案級 RAG (Project-Based RAG)
- **資料隔離**：每個專案 (Project) 擁有獨立的知識庫，上傳的 PDF 僅在該專案內生效，確保資料隱私。
- **自動清理**：刪除專案時，系統會自動清除 SQL 紀錄、實體檔案以及 ChromaDB 中的向量記憶，絕無殘留。
- **Google Gemini 驅動**：使用 `gemini-2.5-flash` 進行高效的文本嵌入 (Embeddings) 與生成。

### 2. 🤖 Agentic Syllabus Generator (AI 課綱架構師)
- **藍圖生成**：首先生成高層次的課程藍圖 (Blueprint)。
- **遞迴擴展**：針對每個單元 (Unit)，AI Agent 會自動檢索 RAG 知識庫，擴展出詳細的學習節點 (Nodes)。
- **智慧敘述**：每個節點都包含 3-5 句話的詳細上下文描述，確保課程內容的連貫性。

### 3. 🎮 遊戲化學習組件 (Gamified Components)
不僅僅是閱讀文本，學習過程包含多種互動模式：
- **SpatialAnatomy**: 空間解剖，用於可視化結構拆解。
- **TextToken**: 關鍵字提取與重組。
- **PatternMatcher**: 視覺與數據模式識別。
- **VariableBalancer**: 變數平衡，理解動態關係。
- **LogicChain**: 邏輯鏈條排序。
- **FeynmanMirror**: 費曼技巧模擬，AI 扮演費曼來評分您的解釋。
- **DilemmaSolver**: 決策模擬。

### 4. 🔄 多階段課程 (Multi-Stage Lessons)
- 每個學習節點不再只是單一頁面，而是由 AI 動態生成的一系列「階段 (Stages)」。
- 包含「教學 (Instruction)」、「練習 (Practice)」、「測驗 (Assessment)」與「補救教學 (Remedial)」的完整迴圈。

---

## 🛠️ 技術架構 (Tech Stack)

### Backend (後端)
- **Framework**: FastAPI (Python)
- **Database**: SQLite (關聯資料), ChromaDB (向量資料)
- **AI Orchestration**: LangChain, LangGraph (for Refinement)
- **LLM**: Google Gemini API via `langchain-google-genai`

### Frontend (前端)
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS, Framer Motion (Animations)
- **State Management**: Zustand

---

## 🚀 快速開始 (Quick Start)

### 前置需求
- Python 3.10+
- Node.js 18+
- Google Gemini API Key (申請：[aistudio.google.com](https://aistudio.google.com/))

### 1. 後端設定 (Backend)

```bash
cd backend

# 1. 建立虛擬環境 (建議)
python -m venv venv
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate   # Windows

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 設定環境變數
cp .env.example .env
# 編輯 .env 填入您的 GOOGLE_API_KEY

# 4. 啟動伺服器
uvicorn app.main:app --reload --port 8000
```

後端將運行於：`http://localhost:8000` (API Docs: `/docs`)

### 2. 前端設定 (Frontend)

```bash
cd frontend

# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.example .env
# 確保 NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# 3. 啟動開發伺服器
npm run dev
```

前端將運行於：`http://localhost:3000`

---

## 📂 專案結構 (Project Structure)

```
.
├── backend/
│   ├── app/
│   │   ├── api/            # API Endpoints (Routes)
│   │   ├── core/           # Config & Prompts
│   │   ├── models/         # SQL Models (User, Project, Course)
│   │   ├── schemas/        # Pydantic Schemas
│   │   └── services/       # Business Logic
│   │       ├── llm/        # AI Agents & Architect
│   │       ├── rag_engine.py # RAG Core Logic
│   │       └── file_service.py # File Management
│   ├── chroma_db/          # Vector Database Storage
│   └── learna.db           # SQLite Database
│
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js Pages
│   │   ├── components/     # UI Components
│   │   ├── features/       # Game Components (StagePlayer)
│   │   ├── stores/         # Zustand Stores
│   │   └── lib/            # Utilities (API Client)
```

---

## 💡 使用指南 (Usage)

1.  **登入**：使用 Dev Login 快速進入系統。
2.  **建立專案**：在 Dashboard 點擊 "New Project"，為您的學習主題建立一個專屬空間。
3.  **上傳知識**：進入專案，上傳相關的 PDF 文件（AI 會自動進行 RAG 處理）。
4.  **生成課程**：
    - 輸入課程主題 (Topic)。
    - AI Agent 會掃描專案內的文件。
    - 生成一份包含多個單元的大綱。
5.  **開始學習**：
    - 點擊大綱中的節點。
    - AI 會即時生成該節點的互動課程內容。
    - 完成挑戰解鎖下一個節點！

---

## ⚠️ 注意事項

- **API 配額**：使用免費版 Gemini API 時請注意 Rate Limit (429 Errors)。
- **資料安全**：RAG 資料存儲於本地 `chroma_db`，請勿直接刪除該資料夾，建議透過 UI 刪除專案以觸發自動清理機制。

---

