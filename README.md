# Learn8

> **從教科書到無限遊戲：將靜態知識轉化為沉浸式學習路徑的 AI 平台。**

**Learn8** 是一個次世代的適性化學習系統 (Adaptive Learning System)，結合 **RAG (Retrieval-Augmented Generation)**、**Agentic Workflow** 與 **遊戲化教學法**，解決傳統線上學習缺乏互動性與個人化的痛點。

透過上傳各類文件（PDF, TXT, CSV, DOCX 等），Learn8 的 AI 架構師會自動消化內容，建構出專屬於您的結構化課程大綱，並隨選生成豐富的互動式學習單元。

## ⚡ 快速開始 (Quick Start)

無需複雜安裝，使用 Docker 一鍵啟動：

```bash
# 1. 複製環境設定
cp .env.example .env

# 2. 編輯 .env 填入 GOOGLE_API_KEY
# (範例: GOOGLE_API_KEY=AIzaSy...)

# 3. 啟動服務
docker-compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/docs

---

## 📑 目錄

1. [系統架構](#-系統架構-architecture)
2. [核心功能](#-核心功能-key-features)
3. [安裝指南](#-安裝指南-installation)
4. [使用手冊](#-使用手冊-user-manual)
5. [模組擴充指南 (Adding/Removing Components) ⭐](#-模組擴充與移除指南-components-guide)
6. [系統流程](#-系統流程-workflows)
7. [目錄結構](#-目錄結構-directory-structure)
8. [API 參考](#-api-參考-api-reference)

---

## 🏗️ 系統架構 (Architecture)

本專案採用現代化的前後端分離架構，強調**資料隔離**、**模組化設計**與**可擴展性**。

### 核心技術堆疊 (Tech Stack)

| 領域 | 技術/工具 | 用途 |
|:---|:---|:---|
| **Frontend** | **Next.js 16+ (App Router)** | 高效能的 SSR/Client Component 渲染架構 |
| | **TypeScript** | 嚴格型別檢查，確保前後端資料契約一致 |
| | **Zustand + Persist** | 輕量級全域狀態管理 (Auth, Project Context)，持久化至 LocalStorage |
| | **Tailwind CSS & Framer Motion** | 現代化 UI 設計與流暢的轉場動畫 |
| | **React Flow** | 課程地圖 (Syllabus Map) 視覺化引擎 |
| **Backend** | **FastAPI (Python 3.10+)** | 高並發、非同步的 RESTful API 服務 |
| | **SQLAlchemy & SQLite** | 關聯式資料儲存 (使用者、專案、課程結構) |
| | **ChromaDB** | 本地向量資料庫 (Vector Database) 用於 RAG |
| | **LangChain & LangGraph** | LLM 編排、動態路由與狀態機流程控制 |
| | **PyMuPDF & docx2txt** | 支援多模態文件攝取 (Multi-modal Document Ingestion) |
| | **Google Gemini API** | 核心 LLM 推論引擎 (`gemini-2.5-flash`) |

### 設計模式 (Design Patterns)

1. **Feature-Sliced Design (Frontend)**:
   前端代碼庫依照功能特性 (`src/features/`) 進行切分，例如 `auth`, `course-map`, `stage-player`, `dashboard`。每個 Feature 擁有獨立的 Components, Hooks 與 API 邏輯，避免傳統架構的高耦合。

2. **Domain-Based Endpoints (Backend)**:
   API 路由按領域拆分為獨立模組 (`projects.py`, `project_files.py`, `courses.py` 等)。

3. **Service Layer Pattern**:
   後端業務邏輯封裝於 `app/services/` (如 `SyllabusAgent`, `RAGEngine`, `ActivityLogger`)，與 API 路由層分離。

---

## ✨ 核心功能 (Key Features)

### 1. 🤖 AI Syllabus Architect (課程大綱架構師)
- **多模態文件攝取**: 支援上傳 `.pdf`, `.txt`, `.md`, `.csv`, `.docx` 等多種格式，系統會自動切換對應的 LangChain Loader 進行解析。
- **雙階段生成策略**: 先規劃宏觀單元 (Blueprint Generation)，再透過 **RAG** 擴展詳細的學習節點 (Nodes)。
- **Metadata Context Injection**: 檢索出的知識塊會自動標註來源 (例如 `[Source: document.pdf]`)，大幅降低 LLM 幻覺，提升教學準確度。

### 2. 🎮 Adaptive Stage Player (適性化播放器)
學習不再是單向閱讀！每個知識點由 AI 動態指派最適合的「互動遊戲組件」：

| 模組類型 | 組件名稱 | 功能描述 |
|:---------|:---------|:---------|
| **Instruction** | TextToken | 關鍵概念重組與高亮 |
| | SpatialAnatomy | 互動式空間/視覺圖解解析 (如: 細胞結構) |
| | PatternMatcher | 概念或定義的配對連線 |
| **Practice** | LogicChain | 邏輯步驟的因果排列 |
| | Sequencer | 時序或流程步驟排列 |
| **Assessment**| TaxonomyMatrix | 知識點的分類拖曳矩陣 |
| | FeynmanMirror | 費曼技巧模擬器，由 AI 助教嚴格評分 |
| **Incentive** | DilemmaSolver | 道德兩難或情境策略選擇 |

### 3. 🧠 Smart RAG Engine (智慧檢索引擎)
結合混合搜尋與查詢擴展，並支援 **Google Gemini File API Toggle**，可於 `.env` 中切換使用本地端記憶體注入或原生的 Gemini File Context 技術。

---

## 🛠️ 模組擴充與移除指南 (Components Guide) ⭐

Learn8 的核心精神是高度模組化。您可以無痛地為系統增加新的「遊戲玩法」（組件），或拔除不適用的組件。
**系統後端已經全面重構為 YAML 驅動架構**，您「不需要」去修改後端的複雜 Python Pydantic 契約或手動撰寫 Prompt。

### 🟢 如何新增一個遊戲組件 (Adding a Component)

假設我們要新增一個名為 `DragSort` (拖曳排序) 的練習組件。

#### 【後端作業: 只需要寫設定檔】

**Step 1: 建立 YAML 模組定義**
在 `backend/game_modules/` 目錄下建立 `DragSort.yaml`，告訴 AI 這款遊戲是做什麼的，以及它應該吐出什麼 JSON 資料：

```yaml
name: DragSort
module: Practice
description: If the goal is to order items by priority or physical weight.
schema_requirements: |
  config.data MUST contain:
  - items: A list of objects containing:
    - id: string ID
    - content: The text to be sorted
```
*(伺服器重啟後，`component_loader.py` 會自動將此設定注入給 AI 架構師。)*

#### 【前端作業: 實作與註冊】

**Step 2: 建立 React 實體檔案**
在 `frontend/src/features/stage-player/components/stages/practice/` 下建立 `DragSort.tsx`。
您需要接收 `stage` 屬性 (包含 config, validation) 並在使用者完成時呼叫 `onComplete(true)`。

**Step 3: 將實體組件註冊進渲染中心**
打開 `frontend/src/features/stage-player/components/ComponentRegistry.tsx`：
1. Import 您的新組件。
2. 將其加入 `COMPONENT_REGISTRY` 字典中：
   ```tsx
   import { DragSort } from './stages/practice/DragSort'; // 👈 新增引入

   export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
       // ... 其他組件
       'DragSort': DragSort, // 👈 新增映射
   };
   ```

**(選擇性) Step 4: TypeScript 型別**
若您需要嚴格的前端型別檢查，可至 `frontend/src/types/lesson.ts` 的 `ComponentType` 補上 `'DragSort'` 字串。

---

### 🔴 如何移除一個遊戲組件 (Removing a Component)

移除變得非常簡單。

**Step 1: 剝奪 AI 的知識庫**
直接刪除 `backend/game_modules/TargetComponent.yaml`。
系統重啟後，AI 就不會再產生這個組件。

**Step 2: 前端解註冊**
- 打開 `frontend/src/features/stage-player/components/ComponentRegistry.tsx`，刪除 `import` 宣告與註冊字典。
- 實體刪除 React 檔案 (如 `TargetComponent.tsx`)。

---

## 🚀 安裝指南 (Installation)

### Docker 快速啟動 (推薦)

```bash
# 1. 設定環境變數
cp .env.example .env
# [重要] 填入 GOOGLE_API_KEY
# 範例: GOOGLE_API_KEY=AIzaSyD...

# 2. 啟動服務 (同時包含前後端及資料庫容器)
docker-compose up --build
```

### 手動開發設置

#### 1. 後端 (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# 啟動命令
python3.12 -m uvicorn app.main:app --reload --port 8000
```

#### 2. 前端 (Next.js)
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

---

## 💡 使用手冊 (User Manual)

1. **登入**: 在登入畫面點擊 **"⚡ Dev Login"** 即可快速使用測試帳號登入。
2. **專案管理**: 點擊左側 Sidebar 的 "+" 建立專案。每個專案的文件與記憶空間都是獨立隔離的。
3. **上傳素材**: 將 PDF、TXT、CSV 或 DOCX 拖曳至上傳區，系統會自動向量化。
4. **生成大綱**: 在 Topic 欄位輸入探索主題後，點擊 Generate Path。
5. **動態微調**: 使用右下角聊天室，吩咐 AI 進行大綱的細部增減。
6. **開始闖關**: 點擊藍色節點，享受 AI 專為您生成的互動小遊戲。

---

## 🔄 系統流程 (Workflows)

### 1. 多模態內容攝取 (Multi-modal Ingestion)
```
使用者上傳檔案 (PDF, CSV, TXT, DOCX)
     │
     ▼
POST /projects/upload-document
     │
     ├─► 儲存至實體沙盒 (uploads/...)
     │
     └─► RAGEngine.ingest_document()
         ├─► 動態分析副檔名 (ext == 'pdf' -> PyMuPDFLoader; ext == 'csv' -> CSVLoader)
         ├─► Metadata Injection (加入來源檔名標籤)
         ├─► Chunking & Embedding 
         └─► 存入 ChromaDB (綁定 project_id)
```

### 2. 適性化與互動驗證 (Adaptive Loop)
```
提交關卡答案
     │
     ▼
POST /system/submit-answer
     │
     ├─► Static Grading (邏輯比對)
     ├─► AI Grading (呼叫 FeynmanMirror 助教審查)
     │
     ├─► 正確 (isCorrect = true)
     │   └─► 解鎖下一節點 (Status -> available)
     │
     └─► 錯誤 (isCorrect = false)
         └─► 觸發補救機制 (Remedial Generation)
             └─► 降級難度，生成更簡單的組件提供練習
```

---

## 📁 目錄結構 (Directory Structure)

```text
Learn8/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # 路由層 (Auth, Projects, Files, Courses, Lessons)
│   │   ├── core/              # Prompts, Config, Security
│   │   ├── models/            # SQLAlchemy ORM (SQLite)
│   │   ├── schemas/           # Pydantic 契約定義
│   │   └── services/          # 核心業務邏輯與 LLM Agents (RAG Engine)
│   ├── chroma_db/             # 向量資料庫儲存庫
│   └── uploads/               # 使用者文件隔離沙盒
└── frontend/
    ├── src/
    │   ├── app/               # Next.js 頁面與路由
    │   ├── components/        # 全域 UI 元件 (Shadcn UI, Sidebars)
    │   ├── features/          # Feature-Sliced 領域模組 (Auth, Dashboard, Stage Player)
    │   │   └── stage-player/components/ComponentRegistry.tsx  # ⭐ 組件註冊中心
    │   ├── stores/            # Zustand 全域狀態
    │   └── types/             # 共用 Interface
```

---

## 📚 API 參考 (API Reference)

快速查閱後端端點：

| 領域 | 端點 | 方法 | 說明 |
|------|------|------|------|
| **Auth** | `/auth/login` | POST | 取得 JWT Token |
| | `/auth/dev-login` | POST | 點擊即登入免密碼 |
| **Projects** | `/projects` | GET/POST | 專案列表與創建 |
| | `/projects/upload-document`| POST | 上傳多種格式文件進行 RAG 解析 |
| | `/projects/{id}/files/{name}`| DELETE | 刪除指定檔案與其向量索引 |
| **Courses** | `/courses/generate-syllabus` | POST | 呼叫 Agent 進行大綱設計 |
| | `/courses/refine-syllabus` | POST | 修改既有課程大綱 |
| **Lessons** | `/lessons/generate-lesson-from-node`| POST | 呼叫 Agent 生成關卡互動內容 |

---

## 📝 License

MIT License - 詳見 [LICENSE](LICENSE)

*Built with ❤️ by the Learn8 Team*
