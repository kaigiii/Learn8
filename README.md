# Learn8

> **從教科書到無限遊戲：將靜態知識轉化為沉浸式學習路徑的 AI 平台。**

**Learn8** 是一個次世代的適性化學習系統 (Adaptive Learning System)，結合 **RAG (Retrieval-Augmented Generation)**、**Agentic Workflow** 與 **遊戲化教學法**，解決傳統線上學習缺乏互動性與個人化的痛點。

透過上傳 PDF 講義或教科書，Learn8 的 AI 架構師會自動消化內容，建構出專屬於您的結構化課程大綱，並隨選生成豐富的互動式學習單元。

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
- **Backend**: http://localhost:8000/docs

---

## 目錄

1. [系統架構](#-系統架構-architecture)
2. [核心功能](#-核心功能-key-features)
3. [安裝指南](#-安裝指南-installation)
4. [使用手冊](#-使用手冊-user-manual)
5. [系統流程](#-系統流程-workflows)
6. [目錄結構](#-目錄結構-directory-structure)
7. [開發者指南](#-開發者指南-developer-guide)
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
| | **Recharts** | 資料視覺化圖表 (用於 VariableBalancer 等) |
| **Backend** | **FastAPI (Python 3.10+)** | 高並發、非同步的 RESTful API 服務 |
| | **SQLAlchemy & SQLite** | 關聯式資料儲存 (使用者、專案、課程結構) |
| | **ChromaDB** | 本地向量資料庫 (Vector Database) 用於 RAG |
| | **LangChain & LangGraph** | LLM 編排與狀態機流程控制 |
| | **Google Gemini API** | 核心 LLM 推論引擎 (`gemini-2.5-flash`) |

### 設計模式 (Design Patterns)

1. **Feature-Sliced Design (Frontend)**:
   前端代碼庫依照功能特性 (`src/features/`) 進行切分，例如 `auth`, `course-map`, `stage-player`, `dashboard`。每個 Feature 擁有獨立的 Components, Hooks 與 API 邏輯，避免傳統依照 `components/`, `api/` 分層導致的耦合。

2. **Domain-Based Endpoints (Backend)**:
   API 路由按領域拆分為獨立模組：
   - `projects.py` - 專案 CRUD 與草稿
   - `project_files.py` - 檔案上傳/刪除/列表
   - `questionnaire.py` - 學習者問卷
   - `courses.py` - 課程大綱生成
   - `lessons.py` - 單元內容生成

3. **Service Layer Pattern**:
   後端業務邏輯封裝於 `app/services/` (如 `SyllabusAgent`, `RAGEngine`, `ActivityLogger`)，與 API 路由層 (`app/api/`) 分離。

4. **Project-Based Isolation (Security)**:
   每個 **專案 (Project)** 擁有獨立的：
   - 實體檔案沙盒 (`uploads/{user_id}/{project_uuid}/`)
   - 向量索引空間 (ChromaDB Filter by `project_id`)
   - SQL 關聯記錄
   這確保了不同學習主題或不同使用者的資料互不干擾。

---

## ✨ 核心功能 (Key Features)

### 1. 🤖 AI Syllabus Architect (課程大綱架構師)

- **雙階段生成策略**:
  1. **Blueprint Generation**: 先規劃宏觀的單元 (Units) 結構，確保教學邏輯通順。
  2. **RAG-Enhanced Expansion**: 針對每個單元，AI 會深入檢索您的 PDF 文件，生成具有 3-5 句詳細描述的學習節點 (Nodes)。
- **動態微調 (Chat with Architect)**: 不滿意大綱？您可以直接與架構師對話 (e.g., *"增加一個關於量子糾纏的單元"* )，系統會即時修正課程地圖。

### 2. 📋 學習者問卷系統 (Learner Questionnaire)

- **AI 生成問卷**: 根據學習主題與上傳檔案，自動生成個人化問題
- **Profile 分析**: LLM 分析回答，產出：
  - 學習風格 (Visual, Auditory, Kinesthetic)
  - 經驗等級 (Beginner, Intermediate, Advanced)
  - 學習目標列表
  - 個人化摘要

### 3. 🎮 Adaptive Stage Player (適性化播放器)

學習不再是單向的閱讀。每個學習節點 (Node) 都是一個由多個 **階段 (Stages)** 組成的微型課程：

| 模組類型 | 組件名稱 | 功能描述 |
|:---------|:---------|:---------|
| **Instruction** | TextToken | 關鍵概念重組與高亮 |
| | SpatialAnatomy | 互動式圖像解剖 |
| | PatternMatcher | 配對概念連線 |
| **Practice** | VariableBalancer | 調整滑桿觀察變數變化 (物理/經濟模型) |
| | LogicChain | 排列邏輯步驟 |
| | Sequencer | 時序排列 |
| **Assessment** | TaxonomyMatrix | 分類拖曳 |
| | FeynmanMirror | 費曼技巧模擬，AI 助教評分 |
| | DilemmaSolver | 道德/策略兩難情境 |
| **Remedial** | (動態生成) | 若測驗失敗，自動生成補救教學 |

### 4. 🧠 Smart RAG Engine (智慧檢索引擎)

- **Hybrid Search**: 結合關鍵字搜尋與向量語意搜尋
- **Query Expansion**: 自動將查詢擴展為 3-4 個相關問題
- **Source Attribution**: AI 生成的內容皆基於您上傳的文件，減少幻覺

### 5. 📊 Activity Logging System (活動日誌系統)

全面的活動日誌，記錄所有用戶操作：

```
2026-01-25 21:16:24 | INFO | LOGIN | User[1:dev@learn8.ai] logged in successfully
2026-01-25 21:16:30 | INFO | PROJECT_CREATE | User[1:dev@learn8.ai] created Project[5:ML 101]
2026-01-25 21:17:00 | INFO | FILE_UPLOAD | User[1:dev@learn8.ai] uploaded to Project[5:ML 101]: [intro.pdf, data.csv]
2026-01-25 21:17:30 | INFO | QUESTIONNAIRE_GENERATE | User[1:dev@learn8.ai] started questionnaire for Project[5:ML 101] | Topic: 'Machine Learning' | Files: [intro.pdf, data.csv]
2026-01-25 21:18:00 | INFO | QUESTIONNAIRE_SUBMIT | User[1:dev@learn8.ai] submitted questionnaire for Project[5:ML 101] | Profile Summary: 'Summary: 具備程式基礎的視覺型學習者...'
2026-01-25 21:19:00 | INFO | SYLLABUS_GENERATE_START | User[1:dev@learn8.ai] started syllabus generation for Project[5:ML 101] | Topic: 'Machine Learning'
  └─ Files Context: [intro.pdf, data.csv]
  └─ RAG Context: '第一章 - 機器學習概論...'
  └─ Learner Profile: '具備程式基礎的視覺型學習者'
2026-01-25 21:22:00 | INFO | SYLLABUS_GENERATE_COMPLETE | User[1:dev@learn8.ai] completed syllabus for Project[5:ML 101] | Topic: 'Machine Learning' | Generated: 6 units, 42 lessons
  └─ Unit 1: Introduction to Machine Learning
  └─ Unit 2: Supervised Learning Algorithms
  └─ Unit 3: Unsupervised Learning
  └─ Unit 4: Neural Networks Fundamentals
  └─ Unit 5: Model Evaluation and Optimization
  └─ Unit 6: Practical Applications
```

**日誌位置**: `backend/logs/activity.log`

---

## 🚀 安裝指南 (Installation)

### Docker 快速啟動 (推薦)

```bash
# 1. 設定環境變數
cp .env.example .env
# [重要] 打開 .env 檔案並填入您的 GOOGLE_API_KEY
# 範例: GOOGLE_API_KEY=AIzaSyD...

# 2. 啟動服務 (同時包含前後端)
docker-compose up --build
```

**服務位置:**
- **Frontend**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`

> ⚠️ **注意**: 啟動前請確保沒有其他服務佔用 Port 3000 或 8000。

### 手動開發設置

#### 1. 後端 (Backend)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # 記得填入 GOOGLE_API_KEY
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

## 💡 使用手冊 (User Manual)

### 1. 登入與開發者模式
在登入畫面，點擊 **"⚡ Dev Login"** 按鈕，系統將使用預設的測試帳號 (`dev@learn8.ai`) 自動登入。

### 2. 專案管理
- **建立專案**: 在左側 Sidebar 點擊 "+" 按鈕
- **切換專案**: 點擊專案名稱
- **重命名**: 右鍵或 Hover 後點擊編輯圖示
- **刪除**: Hover 後點擊垃圾桶圖示

### 3. 上傳教材
點擊 "Upload Material" 區域，拖曳您的 PDF 教科書、論文或講義。這是 AI 生成高品質課程的基礎。

### 4. 學習者問卷 (可選)
輸入主題後，可選擇填寫 AI 生成的問卷。這有助於 AI 了解您的：
- 學習風格
- 先備知識
- 學習目標
- 時間限制

### 5. 生成課程大綱
1. 在 "Topic" 欄位輸入主題 (例如 *"Quantum Computing"*)
2. 點擊 "Generate Path"
3. AI 大約需要 20-60 秒進行架構規劃與 RAG 檢索

### 6. 開始學習
- **藍色節點**: 可用的學習單元，點擊開始
- **灰色節點**: 鎖定中，需完成前置單元
- **綠色節點**: 已完成

### 7. 對話微調
若大綱缺少內容，打開右下角聊天室，告訴 AI 架構師：
- *"Please add a section about practical applications"*
- *"這個單元太深了，可以拆分嗎？"*

---

## 🔄 系統流程 (Workflows)

### 1. 內容輸入與處理 (Content Ingestion)

```
使用者上傳 PDF
     │
     ▼
POST /projects/upload-pdf
     │
     ├─► FileService.save_upload_file()
     │   └─► 存至 uploads/{user_id}/{project_folder}/
     │
     └─► RAGEngine.ingest_pdf()
         ├─► 提取文字 (PyMuPDF)
         ├─► Chunking (512 tokens, 50 overlap)
         ├─► Embedding (Google Gemini)
         └─► 存入 ChromaDB (filter by project_id)
```

### 2. 課程大綱生成 (Syllabus Architecture)

```
使用者輸入主題
     │
     ▼
POST /courses/generate-syllabus?topic=xxx&project_id=xxx
     │
     ├─► [可選] 讀取 project.profile_json (問卷結果)
     ├─► 讀取專案內所有檔案文字
     │
     └─► SyllabusAgent.run()
         │
         ├─► Step 1: generate_blueprint()
         │   └─► LLM 生成 8-12 個 Unit 標題與描述
         │
         └─► Step 2: expand_unit() × N
             ├─► RAG 檢索相關內容
             ├─► Query Expansion (3-4 個變體查詢)
             └─► LLM 生成每個 Unit 的 Nodes (8-12 個)
     │
     ▼
存入 CourseModel + NodeModel (SQLite)
     │
     ▼
回傳 CoursePath JSON
```

### 3. 單元課程生成 (Just-in-Time Generation)

```
使用者點擊節點
     │
     ▼
POST /lessons/generate-lesson-from-node
     │
     ├─► 快取檢查 (DB 是否已存在)
     │   └─► 有 → 直接回傳
     │
     └─► LessonContentAgent.generate()
         ├─► RAG 檢索相關內容
         ├─► LLM 生成 LessonStage[] JSON
         └─► Pydantic 驗證
     │
     ▼
存入 LessonModel (SQLite)
     │
     ▼
前端 StageRenderer 根據 stage.component 動態載入組件
```

### 4. 互動與評量 (Interaction Loop)

```
使用者完成互動
     │
     ▼
POST /system/submit-answer
     │
     ├─► Static Grading (選擇、填空)
     │   └─► 比對 validation.condition
     │
     └─► AI Grading (FeynmanMirror)
         └─► LLM 扮演助教評分
     │
     ├─► isCorrect = true
     │   └─► 更新節點狀態 → 解鎖下一節點
     │
     └─► isCorrect = false
         └─► 觸發 generate_remedial_stage()
             └─► 生成簡化版教學階段
```

---

## 📁 目錄結構 (Directory Structure)

### Backend (`/backend`)

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py            # 認證 (登入、註冊、個人檔案、儲值)
│   │   │   │   ├── projects.py        # 專案 CRUD + 草稿操作
│   │   │   │   ├── project_files.py   # 檔案上傳/刪除/列表
│   │   │   │   ├── questionnaire.py   # 學習者問卷生成與提交
│   │   │   │   ├── courses.py         # 課程大綱生成與修正
│   │   │   │   ├── lessons.py         # 單元內容生成
│   │   │   │   └── system.py          # 系統功能 (答案提交)
│   │   │   ├── api.py                 # 路由中心 (註冊所有 routers)
│   │   │   └── deps.py                # 依賴注入 (get_db, get_current_user)
│   │   └── __init__.py
│   │
│   ├── core/
│   │   ├── config.py                  # 環境變數與設定
│   │   └── security.py                # JWT 與密碼雜湊
│   │
│   ├── models/                        # SQLAlchemy ORM Models
│   │   ├── user.py                    # UserModel
│   │   ├── project.py                 # ProjectModel (含 profile_json, draft_json)
│   │   ├── course.py                  # CourseModel, NodeModel
│   │   └── lesson.py                  # LessonModel
│   │
│   ├── schemas/                       # Pydantic Request/Response Schemas
│   │   ├── auth.py                    # UserCreate, UserLogin, Token
│   │   ├── project.py                 # ProjectCreate, ProjectResponse, DraftRequest
│   │   ├── course.py                  # CoursePath, LessonNode, Unit
│   │   ├── questionnaire.py           # Question, QuestionnaireSubmitRequest, LearnerProfile
│   │   └── lesson.py                  # LessonStage, ComponentType, ModuleType
│   │
│   ├── services/                      # 業務邏輯層
│   │   ├── activity_logger.py         # 活動日誌服務
│   │   ├── file_service.py            # 檔案管理 (上傳、刪除、讀取)
│   │   ├── rag_engine.py              # RAG 引擎 (向量化、檢索)
│   │   ├── document_processor.py      # PDF 文字提取
│   │   │
│   │   └── llm/                       # LLM 相關服務
│   │       ├── agents/                # AI Agents
│   │       │   ├── syllabus_agent.py  # 大綱生成 Agent
│   │       │   ├── lesson_content_agent.py  # 單元內容生成 Agent
│   │       │   └── questionnaire_agent.py   # 問卷生成 Agent
│   │       │
│   │       ├── workflows/             # LangGraph 工作流
│   │       │   └── syllabus_graph.py  # 大綱修正狀態機
│   │       │
│   │       ├── providers/             # LLM 提供者抽象
│   │       │   ├── base.py            # BaseLLMProvider
│   │       │   ├── google_provider.py # Google Gemini
│   │       │   └── llm_factory.py     # 工廠模式選擇提供者
│   │       │
│   │       └── prompts_library.py     # 所有 Prompt 模板
│   │
│   └── main.py                        # FastAPI 應用入口
│
├── logs/                              # 活動日誌 (自動生成)
│   └── activity.log
│
├── uploads/                           # 使用者檔案 (按 user/project 分類)
│   └── {user_id}/
│       └── {project_uuid}/
│           └── *.pdf
│
├── chroma_db/                         # 向量資料庫 (自動生成)
│
├── requirements.txt
└── .env.example
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── page.tsx                   # 主頁 (Dashboard + Course Map)
│   │   ├── layout.tsx                 # 全域 Layout
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── globals.css
│   │
│   ├── features/                      # 功能模組 (Feature Slices)
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   │   └── authService.ts     # 認證 API 封裝
│   │   │   └── components/
│   │   │       ├── LoginForm.tsx
│   │   │       └── RegisterForm.tsx
│   │   │
│   │   ├── course-map/
│   │   │   └── components/
│   │   │       ├── SyllabusMap.tsx    # React Flow 課程地圖
│   │   │       └── NodeDrawer.tsx     # 節點詳情抽屜
│   │   │
│   │   ├── dashboard/
│   │   │   └── components/
│   │   │       ├── Dashboard.tsx      # 主控台邏輯
│   │   │       └── ProjectWorkspace.tsx  # 專案工作區
│   │   │
│   │   └── stage-player/
│   │       ├── StageRenderer.tsx      # 階段渲染器 (進度管理)
│   │       └── components/
│   │           ├── ComponentRegistry.tsx  # 組件註冊表 ⭐
│   │           └── stages/
│   │               ├── instruction/
│   │               │   ├── TextToken.tsx
│   │               │   ├── SpatialAnatomy.tsx
│   │               │   └── PatternMatcher.tsx
│   │               ├── practice/
│   │               │   ├── VariableBalancer.tsx
│   │               │   ├── LogicChain.tsx
│   │               │   └── Sequencer.tsx
│   │               ├── assessment/
│   │               │   ├── TaxonomyMatrix.tsx
│   │               │   └── FeynmanMirror.tsx
│   │               └── incentive/
│   │                   └── DilemmaSolver.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx            # 左側專案列表
│   │   │   └── RightSidebar.tsx       # 右側檔案管理 + 個人資料
│   │   └── ui/                        # shadcn/ui 基礎元件
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       └── ...
│   │
│   ├── stores/                        # Zustand 狀態管理
│   │   ├── useAuthStore.ts            # 認證狀態 (token, user)
│   │   └── useProjectStore.ts         # 專案狀態 (currentProject, files)
│   │
│   ├── lib/
│   │   ├── api-client.ts              # Axios 封裝 (自動帶 Token)
│   │   └── utils.ts                   # 工具函式 (cn)
│   │
│   └── types/
│       └── lesson.ts                  # TypeScript 型別定義
│
├── package.json
└── .env.example
```

---

## 🛠️ 開發者指南 (Developer Guide)

### 一、新增遊戲組件 (Adding a New Stage Component)

以下以新增「**DragSort (拖曳排序)**」組件為完整範例：

#### Step 1: 前端 - 建立 React 組件

在 `frontend/src/features/stage-player/components/stages/practice/` 建立 `DragSort.tsx`：

```tsx
/**
 * 檔案名稱: features/stage-player/components/stages/practice/DragSort.tsx
 * 功能描述: 拖曳排序練習組件
 */
"use client";

import React, { useState } from 'react';
import { LessonStage } from '@/types/lesson';
import { motion, Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface DragSortProps {
    stage: LessonStage;
    onComplete: (success: boolean) => void;
}

export const DragSort: React.FC<DragSortProps> = ({ stage, onComplete }) => {
    const { config, validation, feedback } = stage;

    // 從 config.data 取得題目設定
    const { title, description, items: initialItems, correctOrder } = config.data;

    const [items, setItems] = useState<string[]>(initialItems || []);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const handleSubmit = () => {
        // 驗證順序是否正確
        const correct = JSON.stringify(items) === JSON.stringify(correctOrder);
        setIsCorrect(correct);
        setIsSubmitted(true);

        if (correct) {
            setTimeout(() => onComplete(true), 1500);
        }
    };

    const handleRetry = () => {
        setItems(initialItems);
        setIsSubmitted(false);
        setIsCorrect(null);
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{title}</h2>
            <p className="text-gray-500 mb-6">{description}</p>

            {/* 拖曳區域 */}
            <Reorder.Group
                axis="y"
                values={items}
                onReorder={setItems}
                className="space-y-2"
            >
                {items.map((item, index) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        className="p-4 bg-slate-50 rounded-lg border border-slate-200 cursor-grab active:cursor-grabbing flex items-center gap-3"
                    >
                        <span className="text-slate-400 font-mono">{index + 1}.</span>
                        <span>{item}</span>
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            {/* 提交按鈕 */}
            {!isSubmitted && (
                <Button onClick={handleSubmit} className="w-full mt-6">
                    Submit Answer
                </Button>
            )}

            {/* 結果顯示 */}
            {isSubmitted && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${
                        isCorrect
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                >
                    {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    <span>{isCorrect ? feedback.success : feedback.error}</span>
                    {!isCorrect && (
                        <Button variant="outline" size="sm" onClick={handleRetry} className="ml-auto">
                            Retry
                        </Button>
                    )}
                </motion.div>
            )}
        </div>
    );
};
```

#### Step 2: 前端 - 註冊組件

打開 `frontend/src/features/stage-player/components/ComponentRegistry.tsx`：

```tsx
// 新增 import
import { DragSort } from './stages/practice/DragSort';

// 在 COMPONENT_REGISTRY 中新增映射
export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
    'VariableBalancer': VariableBalancer,
    'LogicChain': LogicChain,
    'TaxonomyMatrix': TaxonomyMatrix,
    'TextToken': TextToken,
    'FeynmanMirror': FeynmanMirror,
    'Sequencer': Sequencer,
    'SpatialAnatomy': SpatialAnatomy,
    'DilemmaSolver': DilemmaSolver,
    'PatternMatcher': PatternMatcher,
    // 👇 新增這一行
    'DragSort': DragSort,
};
```

#### Step 3: 後端 - 定義 Schema (選用但建議)

在 `backend/app/schemas/lesson.py` 新增型別定義：

```python
# 在 ComponentType Enum 中新增
class ComponentType(str, Enum):
    VariableBalancer = 'VariableBalancer'
    LogicChain = 'LogicChain'
    # ... 其他組件
    DragSort = 'DragSort'  # 👈 新增

# 定義 Config 結構
class DragSortData(BaseModel):
    title: str
    description: str
    items: List[str]  # 初始順序 (打亂)
    correctOrder: List[str]  # 正確順序

class DragSortConfig(BaseStageConfig):
    data: DragSortData
    @field_validator('data', mode='before')
    @classmethod
    def validate_data(cls, v: Any): return parse_data_field(v)

class DragSortStage(BaseLessonStage):
    component: Literal[ComponentType.DragSort]
    config: DragSortConfig

# 更新 Union (加在 GenericStage 之前)
LessonStage = Union[
    TextTokenStage, 
    TaxonomyStage, 
    PatternMatcherStage, 
    DragSortStage,  # 👈 新增
    GenericStage
]
```

#### Step 4: 後端 - 更新 Prompt

在 `backend/app/services/llm/prompts_library.py` 告訴 AI 這個新組件的存在與格式：

```python
# 在組件庫說明中新增

COMPONENT_LIBRARY = """
Available Components:

## Practice Module:
- VariableBalancer: For understanding variable relationships
- LogicChain: For arranging logical steps
- Sequencer: For timeline/process ordering
- DragSort: For ordering items by importance, chronology, or priority  👈 新增

### DragSort Config Format:  👈 新增
{
    "data": {
        "title": "Order the steps of photosynthesis",
        "description": "Drag items to arrange them in the correct order",
        "items": ["CO2 absorption", "Light capture", "Glucose production", "O2 release"],
        "correctOrder": ["Light capture", "CO2 absorption", "Glucose production", "O2 release"]
    },
    "initialState": {}
}

## When to use DragSort:  👈 新增
- Ordering historical events
- Arranging steps of a process
- Prioritizing items
- Sequencing a workflow
"""
```

#### Step 5: 測試

1. 重啟前後端
2. 建立新專案並生成課程
3. AI 可能會自動選用 DragSort 組件
4. 或手動觸發相關內容 (如「排列步驟」)

---

### 二、新增 API 端點模組 (Adding a New Endpoint Module)

以新增「**Notes (學習筆記)**」功能為範例：

#### Step 1: 建立 Model

在 `backend/app/models/` 建立 `note.py`：

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base

class NoteModel(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    node_id = Column(String, nullable=True)  # 關聯到特定學習節點
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

#### Step 2: 建立 Schema

在 `backend/app/schemas/` 建立 `note.py`：

```python
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class NoteCreate(BaseModel):
    project_id: Optional[int] = None
    node_id: Optional[str] = None
    content: str

class NoteUpdate(BaseModel):
    content: str

class NoteResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    node_id: Optional[str]
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

#### Step 3: 建立 Endpoint

在 `backend/app/api/v1/endpoints/` 建立 `notes.py`：

```python
"""
模組名稱: app.api.v1.endpoints.notes
功能描述: 學習筆記 API (Notes Endpoints)
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.note import NoteModel
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.services.activity_logger import ActivityLogger

router = APIRouter()


@router.post("", response_model=NoteResponse)
def create_note(
    note: NoteCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_note = NoteModel(
        user_id=current_user.id,
        project_id=note.project_id,
        node_id=note.node_id,
        content=note.content
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


@router.get("", response_model=List[NoteResponse])
def get_notes(
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(NoteModel).filter(NoteModel.user_id == current_user.id)
    if project_id:
        query = query.filter(NoteModel.project_id == project_id)
    return query.order_by(NoteModel.updated_at.desc()).all()


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    note_update: NoteUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_note = db.query(NoteModel).filter(
        NoteModel.id == note_id,
        NoteModel.user_id == current_user.id
    ).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")

    db_note.content = note_update.content
    db.commit()
    db.refresh(db_note)
    return db_note


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_note = db.query(NoteModel).filter(
        NoteModel.id == note_id,
        NoteModel.user_id == current_user.id
    ).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted"}
```

#### Step 4: 註冊路由

在 `backend/app/api/v1/api.py` 新增：

```python
from app.api.v1.endpoints import auth, projects, project_files, questionnaire, courses, lessons, system, notes  # 👈 新增 notes

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# ... 其他 routers
api_router.include_router(notes.router, prefix="/notes", tags=["notes"])  # 👈 新增
```

#### Step 5: 執行遷移

```bash
# 如果使用 Alembic:
alembic revision --autogenerate -m "Add notes table"
alembic upgrade head

# 或簡單刪除 data.db 重新建立 (開發環境)
rm data.db
# 重啟後端，SQLAlchemy 會自動建立表格
```

---

### 三、擴展 Activity Logger

在 `backend/app/services/activity_logger.py` 新增日誌方法：

```python
# 在 ActivityLogger class 中新增

@staticmethod
def log_note_create(user_id: int, user_email: str, note_id: int, project_id: int = None):
    activity_logger.info(
        f"NOTE_CREATE | {ActivityLogger._format_user(user_id, user_email)} created Note[{note_id}]"
        + (f" in Project[{project_id}]" if project_id else "")
    )

@staticmethod
def log_note_delete(user_id: int, user_email: str, note_id: int):
    activity_logger.info(
        f"NOTE_DELETE | {ActivityLogger._format_user(user_id, user_email)} deleted Note[{note_id}]"
    )
```

然後在 endpoint 中調用：

```python
# 在 create_note 中
db.refresh(db_note)
ActivityLogger.log_note_create(current_user.id, current_user.email, db_note.id, note.project_id)
return db_note
```

---

### 四、刪除組件或模組

#### 刪除遊戲組件

1. **前端**: 
   - 刪除 `stages/*/ComponentName.tsx`
   - 從 `ComponentRegistry.tsx` 移除映射
2. **後端**:
   - 從 `ComponentType` Enum 移除
   - 從 `prompts_library.py` 移除說明
   - (選用) 刪除專用的 Schema class

#### 刪除 API 端點模組

1. 刪除 `endpoints/module_name.py`
2. 從 `api.py` 移除 import 和 `include_router`
3. (選用) 刪除對應的 Model 和 Schema
4. 執行資料庫遷移或手動刪除表格

---

## 📚 API 參考 (API Reference)

### Authentication

| 端點 | 方法 | 說明 | Request Body |
|------|------|------|--------------|
| `/auth/register` | POST | 註冊新帳號 | `{ email, password, full_name?, phone_number? }` |
| `/auth/login` | POST | 登入 | `{ email, password }` |
| `/auth/dev-login` | POST | 開發者快速登入 | - |
| `/auth/me` | GET | 取得當前用戶資料 | - |
| `/auth/me` | PUT | 更新個人資料 | `{ full_name?, phone_number?, ... }` |
| `/auth/me` | DELETE | 刪除帳號 | - |
| `/auth/credits/topup` | POST | 儲值點數 | `?amount=100` |

### Projects

| 端點 | 方法 | 說明 |
|------|------|------|
| `/projects` | GET | 列出用戶所有專案 |
| `/projects` | POST | 建立新專案 |
| `/projects/{id}` | PATCH | 更新專案名稱 |
| `/projects/{id}` | DELETE | 刪除專案 (含檔案與向量) |
| `/projects/{id}/draft` | GET | 取得專案草稿 |
| `/projects/{id}/draft` | PUT | 儲存專案草稿 |

### Files

| 端點 | 方法 | 說明 |
|------|------|------|
| `/projects/{id}/files` | GET | 列出專案內檔案 |
| `/projects/{id}/files/{filename}` | DELETE | 刪除檔案 |
| `/projects/upload-pdf` | POST | 上傳 PDF |

### Questionnaire

| 端點 | 方法 | 說明 |
|------|------|------|
| `/projects/{id}/questionnaire` | POST | 生成問卷問題 |
| `/projects/{id}/questionnaire/submit` | POST | 提交問卷答案 |

### Courses

| 端點 | 方法 | 說明 |
|------|------|------|
| `/courses` | GET | 列出課程 (可依 project_id 篩選) |
| `/courses/{id}` | GET | 取得課程詳情 |
| `/courses/generate-syllabus` | POST | 生成課程大綱 |
| `/courses/refine-syllabus` | POST | 修正課程大綱 |
| `/courses/{id}/node/{node_id}/status` | PATCH | 更新節點狀態 |

### Lessons

| 端點 | 方法 | 說明 |
|------|------|------|
| `/lessons/generate-lesson-from-node` | POST | 生成單元內容 |

### System

| 端點 | 方法 | 說明 |
|------|------|------|
| `/system/submit-answer` | POST | 提交答案並取得評分 |

---

## 📝 License

MIT License - 詳見 [LICENSE](LICENSE)

---

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

*Built with ❤️ by the Learn8 Team*
