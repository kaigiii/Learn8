# Learna v3 (NeoLearn 3.0) 🪐

> **從教科書到無限遊戲：將靜態知識轉化為沉浸式學習路徑的 AI 平台。**

**Learna v3** 是一個次世代的適性化學習系統 (Adaptive Learning System)，它結合了 **RAG (Retrieval-Augmented Generation)**、**Agentic Workflow** 與 **遊戲化教學法**，旨在解決傳統線上學習缺乏互動性與個人化的痛點。

透過上傳您的 PDF 講義或教科書，Learna 的 AI 架構師會自動消化內容，建構出專屬於您的結構化課程大綱，並隨選生成 (On-Demand Generation) 豐富的互動式學習單元。

---

## 🏗️ 系統架構與設計 (Architecture)

本專案採用現代化的前後端分離架構，強調**資料隔離**、**模組化設計**與**可擴展性**。

### 核心技術堆疊 (Tech Stack)

| 領域 | 技術/工具 | 用途 |
|:---|:---|:---|
| **Frontend** | **Next.js 14+ (App Router)** | 高效能的 SSR/Client Component 渲染架構 |
| | **TypeScript** | 嚴格型別檢查，確保前後端資料契約 (Data Contract) 一致 |
| | **Zustand** | 輕量級全域狀態管理 (Auth, Project Context) |
| | **Tailwind CSS & Framer Motion** | 現代化 UI 設計與流暢的轉場動畫 |
| | **React Flow** | 課程地圖 (Syllabus Map) 視覺化引擎 |
| **Backend** | **FastAPI (Python 3.10+)** | 高並發、非同步的 RESTful API 服務 |
| | **SQLAlchemy & SQLite** | 關聯式資料儲存 (使用者、專案、課程結構) |
| | **ChromaDB** | 本地向量資料庫 (Vector Database) 用於 RAG |
| | **LangChain & LangGraph** | LLM 編排與狀態機流程控制 |
| | **Google Gemini API** | 核心 LLM 推論引擎 (`gemini-2.5-flash`) |

### 資料流與設計模式 (Design Patterns)

1.  **Feature-Sliced Design (Frontend)**:
    前端代碼庫依照功能特性 (`src/features/`) 進行切分，例如 `auth`, `course-map`, `stage-player`。每個 Feature 擁有獨立的 Components, Hooks 與 API 邏輯，避免傳統依照 `components/`, `api/` 分層導致的耦合。

2.  **Service-Repository Pattern (Backend)**:
    後端業務邏輯封裝於 `app/services/` (如 `SyllabusAgent`, `RAGEngine`)，與 API 路由層 (`app/api/`) 分離。資料庫操作則透過 ORM Models (`app/models/`) 進行。

3.  **Project-Based Isolation (Security)**:
    系統設計了嚴格的資料隔離機制。每個 **專案 (Project)** 擁有獨立的：
    -   實體檔案沙盒 (`uploads/{user_id}/{project_uuid}/`)
    -   向量索引空間 (ChromaDB Filter)
    -   SQL 關聯記錄
    這確保了不同學習主題或不同使用者的資料互不干擾，也不會發生 RAG 檢索時的上下文污染 (Context Contamination)。

---

## ✨ 核心功能詳解 (Key Features)

### 1. 🤖 AI Syllabus Architect (課程大綱架構師)
-   **雙階段生成策略**:
    1.  **Blueprint Generation**: 先規劃宏觀的單元 (Units) 結構，確保教學邏輯通順。
    2.  **RAG-Enhanced Expansion**: 針對每個單元，AI 會深入檢索您的 PDF 文件，生成具有 3-5 句詳細描述的學習節點 (Nodes)。
-   **動態微調 (Chat with Architect)**: 不滿意大綱？您可以直接與架構師對話 (e.g., *"增加一個關於量子糾纏的單元"* )，系統會即時修正課程地圖。

### 2. 🎮 Adaptive Stage Player (適性化播放器)
學習不再是單向的閱讀。每個學習節點 (Node) 都是一個由多個 **階段 (Stages)** 組成的微型課程：
-   **Instruction (教學)**: 
    -   *SpatialAnatomy*: 互動式圖像解剖。
    -   *TextToken*: 關鍵概念重組。
-   **Practice (練習)**: 
    -   *VariableBalancer*: 調整參數觀察結果 (物理/經濟模型)。
    -   *LogicChain*: 排列邏輯步驟。
-   **Assessment (評量)**: 
    -   *FeynmanMirror*: 費曼技巧模擬，您解釋概念，AI 助教給予評分與回饋。
    -   *DilemmaSolver*: 道德或策略兩難情境模擬。
-   **Remedial (補救)**: 
    -   若在測驗中失敗，系統會自動生成「補救教學」階段，換個方式講解直到您學會為止。

### 3. 🧠 Smart RAG Engine (智慧檢索引擎)
-   **Hybrid Search**: 結合關鍵字搜尋與向量語意搜尋。
-   **Query Expansion**: 自動將您的查詢擴展為多個相關問題，捕捉更多潛在知識。
-   **Source Attribution**: AI 生成的內容皆基於您上傳的文件，減少幻覺 (Hallucination)。

---

## 🚀 安裝與執行指南 (Installation Guide)

### 💎 快速啟動 (Docker Quick Start)

我們強烈建議使用 Docker 進行一鍵部署，以確保環境一致性。

```bash
# 1. 設定環境變數
cp .env.example .env
# [重要] 打開 .env 檔案並填入您的 GOOGLE_API_KEY
# 範例: GOOGLE_API_KEY=AIzaSyD...

# 2. 啟動服務 (同時包含前後端)
docker-compose up --build
```

**服務位置:**
-   **Frontend**: `http://localhost:3000`
-   **Backend**: `http://localhost:8000/docs`

> ⚠️ **注意**: 啟動前請確保您沒有其他服務佔用 Port 3000 或 8000 (例如本地開發中的 npm run dev)。

---

### 🛠️ 手動開發設置 (Manual Setup for Developers)

若您需要進行程式碼修改，可依照以下步驟分開啟動：

#### 1. 後端 (Backend)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # 記得填入 API Key
uvicorn app.main:app --reload --port 8000
```

#### 2. 前端 (Frontend)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

---

## 💡 使用者操作手冊 (User Manual)

### 1. 登入與開發者模式
Learna v3 目前處於開發預覽階段。在登入畫面，您可以點擊下方的 **"⚡ Dev Login"** 按鈕，系統將使用預設的測試帳號 (`dev@learna.ai`) 自動登入，無需註冊。

### 2. 儀表板與專案管理
-   **建立專案**: 進入 Dashboard，您可以直接開始一個新主題。
-   **上傳文件 (關鍵)**: 點擊 "Upload Material" 區域，拖曳您的 PDF 教科書、論文或講義。這是 AI 生成高品質課程的基礎。

### 3. 生成與學習
1.  **輸入主題**: 在 "Choose Topic" 欄位輸入您想學習的主題 (例如 *"Renaissance Art History"* 或 *"Basic Thermodynamics"*)。
2.  **生成大綱**: 點擊 "Generate Path"。AI 大約需要 20-40 秒進行架構規劃與 RAG 檢索。
3.  **開始旅程**: 生成完成後，您會看到視覺化的課程地圖。點擊任意 **藍色節點**，開始您的互動學習單元。
4.  **對話微調**: 若發現大綱缺少某些內容，打開右下角的聊天室，告訴 AI 架構師 *"Please add a section about Da Vinci"*。

---

## 🔄 系統運作流程 (System Workflows)

### 1. 內容輸入與處理 (Content Ingestion)
1.  **上傳**: 使用者上傳 PDF -> `POST /upload-pdf`
2.  **儲存**: `FileService` 將檔案存至 `uploads/`
3.  **向量化 (RAG)**: `RAGEngine` 讀取 -> Chunking -> Embedding -> 存入 ChromaDB (以 `project_id` 隔離)

### 2. 課程大綱生成 (Syllabus Architecture)
1.  **觸發**: 使用者輸入主題 -> `POST /generate-syllabus`
2.  **規劃**: `SyllabusAgent` 結合 Prompt 與主題
3.  **生成**: LLM 回傳 JSON 結構 (單元 Units -> 節點 Nodes)
4.  **建構**: 系統解析 JSON 並轉換為 Graph 結構存入 DB

### 3. 單元課程生成 (Just-in-Time Generation)
1.  **點擊**: 使用者點擊學習節點
2.  **快取檢查**: 確認 DB 是否已存在該節點內容
3.  **生成的藝術 (AI)**: 若無快取，AI 根據節點描述 + RAG 檢索內容 -> 生成互動元件設定 (Config)
4.  **渲染**: 前端 `ComponentRegistry` 根據 Config 動態載入 React 組件 (如 `TaxonomyMatrix`, `FeynmanMirror`)

### 4. 互動與評量 (Interaction Loop)
1.  **互動**: 使用者完成遊戲/練習 -> 點擊 Submit
2.  **分析**: 後端 `POST /submit-answer` -> 記錄數據 (`lesson_attempts`)
3.  **回饋**:
    -   **Rule-Based**: 直接比對正確答案 (如排序題)
    -   **AI-Based**: LLM 扮演助教進行評分 (如費曼解釋題)
4.  **導航**: 通過 -> 解鎖下一節點；失敗 -> 觸發補救教學 (Remedial Node)

---

## 🛠️ 開發者指南：單元課程生成引擎 (Developer Guide: Unit Lesson Generation Engine)

Learna v3 的核心魔力在於 **"Just-in-Time Learning Generation"**。本節將深入剖析系統如何從一個簡單的「節點描述」生成出完整的互動課程，以及如何擴展新的遊戲組件。

### 1. 核心工作流 (Core Workflow)

當使用者在課程地圖上點擊一個節點 (Node) 時的完整資料流：

1.  **觸發 (Trigger)**: 前端呼叫 `POST /api/v1/lessons/generate-lesson-from-node`。
2.  **檢索與生成 (RAG + LLM)**:
    -   後端 `SyllabusAgent` 會先去 ChromaDB 檢索與該節點描述相關的 PDF 內容片段。
    -   將檢索內容 (Context) + 節點主題 (Topic) 餵給 Google Gemini 模型。
    -   要求 LLM 輸出符合 `List[LessonStage]` Schema 的 JSON 結構。
3.  **解析與儲存**:
    -   Pydantic 驗證 JSON 格式。
    -   將生成結果存入 SQLite `lessons` 表格 (以便下次快速讀取，節省 Token)。
4.  **前端渲染 (Rendering)**:
    -   前端接收 `LessonStage[]` 陣列。
    -   `StageRenderer.tsx` 負責狀態管理 (進度條、上一頁/下一頁)。
    -   `ComponentRegistry.tsx` 根據 `stage.component` 字串動態載入對應的 React 組件。

### 2. 資料結構 (Data Artifacts)

所有的學習內容都以 Polymorphic JSON 格式儲存。一個 `LessonStage` 包含：

```typescript
interface LessonStage {
  stageId: string;
  topic: string; // 該階段的小標題
  module: 'Instruction' | 'Practice' | 'Assessment'; // 模組類型
  component: string; // 關鍵映射欄位，如 'StartNode', 'MultipleChoice', 'FeynmanMirror'
  config: {
    data: any; // 組件專屬資料 (如題目內容、圖片 URL)
    initialState: any; // 初始互動狀態
  };
  // ... validation & feedback
}
```

### 3. 如何擴充新的遊戲組件？

若您想加入一個新的互動模式 (例如：Drag-and-Drop 排序遊戲)，請遵循以下步驟：

#### Step 1: 前端實作 (Frontend)
1.  在 `src/features/stage-player/components/practice/` 建立 `DragSort.tsx`。
2.  實作組件邏輯，接收 `stage` 與 `onSubmit` props。
3.  **註冊組件**: 打開 `src/features/stage-player/components/ComponentRegistry.tsx`，將字串 `'DragSort'` 映射到您的新組件。

#### Step 2: 後端定義 (Backend)
1.  (Optional) 在 `app/schemas/lesson.py` 定義 `DragSortConfig` 的 Pydantic 模型，以獲得更強的型別檢查。
2.  **更新 Prompt**: 修改 `app/services/llm/prompts_library.py` (或相關 Prompt 檔案)，告訴 AI：「現在你有一個新工具叫 'DragSort'，它的 JSON 格式長這樣...」。

#### Step 3: 更新 Agent
確保 `generate_lesson_from_node` 函式知道何時該使用這個新組件 (例如：當教材內容涉及「順序、步驟」時)。

### 4. 評量與補救機制 (Assessment & Remedial Loop)

後端 `/submit-answer` Endpoint 不僅僅是記錄分數：
-   **Static Grading**: 對於簡單題型 (選擇、填空)，直接比對 JSON 中的 `validation` 規則。
-   **AI Grading**: 對於 `FeynmanMirror` (費曼技巧) 等開放式問答，後端會再次呼叫 LLM 扮演助教進行評分。
-   **Remedial Path**: 若判定失敗 (`isCorrect: false`)，系統會觸發 `generate_remedial_stage`，即時生成一個「簡化版」的教學階段插入到使用者的學習路徑中，實現真正的適性化教學。

---

## 📂 專案目錄結構詳解 (Directory Structure)

### Backend (`/backend`)

| 路徑 | 說明 |
|:---|:---|
| `app/api/v1/` | API 路由定義，按資源分類 (`courses.py`, `lessons.py`, `auth.py`)。 |
| `app/core/` | 系統核心設定 (`config.py`) 與全域 Prompt 模板 (`prompts.py`)。 |
| `app/models/` | SQLAlchemy 資料庫模型定義 (`User`, `Project`, `Course`, `Node`)。 |
| `app/schemas/` | Pydantic 資料驗證與序列化模型 (Request/Response DTOs)。 |
| `app/services/` | **核心業務邏輯層**。 |
| ├── `llm/` | LLM 相關服務，包含 `SyllabusAgent` (大綱生成) 與 `Architect`。 |
| ├── `rag_engine.py` | RAG 引擎，處理文件切分、向量化與檢索。 |
| └── `file_service.py` | 檔案系統操作與路徑安全管理。 |
| `chroma_db/` | ChromaDB 的持久化儲存目錄 (由系統自動生成)。 |
| `uploads/` | 使用者上傳檔案的儲存目錄 (按 User/Project 分類)。 |

### Frontend (`/frontend`)

| 路徑 | 說明 |
|:---|:---|
| `src/app/` | Next.js App Router 頁面 (`page.tsx`, `layout.tsx`)。 |
| `src/features/` | **功能模組目錄** (Feature Slices)。 |
| ├── `auth/` | 認證相關組件 (`LoginForm`)。 |
| ├── `stage-player/` | 課程播放器核心 (`StageRenderer`, `ComponentRegistry`)。 |
| ├── `course-map/` | 課程地圖視覺化 (`SyllabusMap`, `NodeDrawer`)。 |
| └── `dashboard/` | 主控台邏輯 (`Dashboard.tsx`)。 |
| `src/stores/` | Zustand 全域狀態定義 (`useAuthStore`, `useProjectStore`)。 |
| `src/lib/` | 通用工具函式庫 (`api-client.ts`, `utils.ts`)。 |
| `src/types/` | TypeScript 型別定義 (`lesson.ts`)，與後端 Schema 對應。 |
| `src/components/ui/` | 共用基礎 UI 元件 (Button, Input, Card 等)。 |

---

## 🤝 貢獻與開發 (Contributing)

我們歡迎任何形式的貢獻！若您想參與開發：
1.  Fork 此專案。
2.  建立您的 Feature Branch (`git checkout -b feature/AmazingFeature`)。
3.  提交您的修改 (`git commit -m 'Add some AmazingFeature'`)。
4.  推送到 Branch (`git push origin feature/AmazingFeature`)。
5.  開啟 Pull Request。

特別歡迎針對 **Prompt Engineering** (讓 AI 教學更生動) 與 **New Game Components** (新的學習互動模式) 的貢獻。

---

**Built with ❤️ by the Learna Team.**
