# Learna v3 系統文件

本文件詳細說明 Learna v3 專案的架構、啟動方式及系統運作流程。

## 1. 啟動指令

### 前端 (Frontend)
前端專案位於 `frontend` 目錄，使用 Next.js 框架。

```bash
cd frontend
npm install  # 若尚未安裝依賴
npm run dev
```
啟動後預設運行於 `http://localhost:3000`。

### 後端 (Backend)
後端專案位於 `backend` 目錄，使用 FastAPI 框架。
**注意**：請確保您已安裝 Python 依賴（如 `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic` 等）。

```bash
cd backend
# 使用 uvicorn 啟動，並指向 app.main:app
uvicorn app.main:app --reload
```
啟動後 API 預設運行於 `http://127.0.0.1:8000`。
API 文件可於 `http://127.0.0.1:8000/docs` 查看。

---

## 2. 後端專案架構詳解

後端核心程式碼位於 `backend/app`，其結構如下：

### 根目錄與配置
- **`main.py`**: 應用程式入口點。初始化 FastAPI 實例 (`app`)，設定 middleware (CORS)，掛載 API 路由，並在啟動時建立資料庫表格。
- **`core/`**:
    - **`config.py`**: 系統配置設定 (Settings)，讀取環境變數 (如 LLM Provider, API Keys)。
    - **`prompts.py`**: 存放 LLM 使用的 Prompt 模板。
    - **`security.py`**: 安全相關邏輯（如密碼 Hash、Token 驗證）。

### API 層 (`api/`)
- **`api/v1/api.py`**: 路由彙整，將各個 endpoint router 包含進來。
- **`api/v1/endpoints/`**:
    - **`auth.py`**: 處理使用者登入、註冊、Token 發放。
    - **`courses.py`**: 課程相關 API。核心功能包括生成課綱 (`/generate-syllabus`)、獲取課程列表、更新節點狀態。
    - **`lessons.py`**: 單元/課程內容的詳細操作。
    - **`projects.py`**: 專案管理（此處可能涉及不同學習專案的隔離）。
    - **`system.py`**: 系統層級操作或健康檢查。
- **`api/deps.py`**: 依賴注入 (Dependency Injection)，如 `get_db` (資料庫連線), `get_current_user` (身份驗證)。

### 資料層 (`db/`, `models/`, `schemas/`)
- **DB 連線**:
    - **`db/base.py`**: 匯入所有 Model 以便 Alembic 或 `create_all` 識別。
    - **`db/base_class.py`**:定義 SQLAlchemy 的 declarative base。
    - **`db/session.py`**: 建立資料庫引擎 (Engine) 與 SessionLocal。
- **Models (資料庫模型)**:
    - **`models/user.py`**: 使用者資料表定義。
    - **`models/course.py`**: 課程與節點資料表 (`CourseModel`, `NodeModel`)。
    - **`models/lesson.py`**: 課程內容細節。
    - **`models/project.py`**: 專案資料表。
- **Schemas (Pydantic 模型 - 資料驗證與序列化)**:
    - **`schemas/auth.py`**: 登入/註冊請求與回應格式。
    - **`schemas/course.py`**: 課綱結構 (`CoursePath`, `syllabus_json`) 定義。
    - **`schemas/lesson.py`**: 課程內容格式。
    - **`schemas/project.py`**: 專案資料格式。

### 服務層 (`services/`) - 核心商業邏輯
- **`services/file_service.py`**: 檔案處理邏輯。
- **`services/rag_engine.py`**: RAG (Retrieval-Augmented Generation) 引擎，負責知識庫檢索。
- **`services/syllabus_graph.py`**: 可能負責利用圖形結構或 LangGraph 來優化課綱生成流程。
- **`services/llm/` (LLM 適配層)**:
    - **`base.py`**: 定義 `BaseLLMProvider` 抽象類別，規定 `generate_text`, `generate_structured` 介面。
    - **`factory.py`**: `LLMFactory` 類別，根據 Config 設定決定實例化哪種 Provider (Google, Mock, 或 Local)。
    - **`google_adapter.py`**: Google Gemini API 的實作。
    - **`local_adapter.py`**: 本地 LLM (FreeGemini) 的實作。
    - **`mock_adapter.py`**: 測試用的假資料回傳。
    - **`architect.py`**: 高階邏輯，負責協調 LLM 生成完整課程架構 (`generate_course_syllabus`)。

- **`services/freegemini/`**:
    - 包含 FreeGemini 的具體實作邏輯（本地模型操作、LangChain 整合等）。

---

## 3. 系統運作流程

以核心功能「**生成課程課綱 (Generate Syllabus)**」為例：

### Step 1: 使用者輸入
1. 使用者在前端輸入「想要學習的主題」（例如："Python 基礎"）。
2. 前端發送 `POST /api/v1/courses/generate-syllabus` 請求，包含 `topic: "Python 基礎"`。

### Step 2: API 層接收
1. `backend/app/api/v1/endpoints/courses.py` 中的 `generate_syllabus` 函式接收請求。
2. 檢查資料庫是否已有相同 Topic 的課程（若有則直接回傳）。

### Step 3: LLM 服務調用
1. API 呼叫 `app.services.llm.architect.generate_course_syllabus(topic, ...)`。
2. `architect` 內部透過 `LLMFactory.create()` 取得當前設定的 LLM Provider (例如 `GoogleLLMProvider` 或 `FreeGeminiLLMProvider`)。
3. `architect` 組裝 Prompt（包含系統指令、JSON 結構要求）。
4. 呼叫 `provider.generate_structured(...)`。

### Step 4: LLM 處理與輸出
1. **LLM Provider** 將 Prompt 發送給模型（Google API 或本地模型）。
2. 模型回傳符合 Pydantic Schema 定義的 JSON 資料（包含 Units, Nodes, Description 等）。
3. 系統驗證回傳格式是否正確。

### Step 5: 資料持久化與回應
1. `generate_syllabus` 收到結構化的課綱物件。
2. 建立 `CourseModel` (儲存完整 JSON) 與 `NodeModel` (將每個學習節點獨立存入 DB 以追蹤狀態) 寫入 SQLite (`learna.db`)。
3. API 回傳完整的課綱 JSON 給前端。

### Step 6: 前端呈現
1. 前端接收 JSON，解析 `units` 與 `nodes`。
2. 使用 ReactFlow 或類似套件繪製學習路徑圖 (Syllabus Map)。

---

## 其他說明
- **資料庫**: 專案使用 SQLite (`learna.db`)，無需安裝額外資料庫伺服器。
- **依賴管理**: 請注意 `backend/` 下目前未發現 `requirements.txt`，請確保環境中已安裝必要的 Python 套件。
- **環境變數**: 請檢查 `backend/.env` 檔案以確保 API Key (如 `GOOGLE_API_KEY`) 已正確設定。
