# Learn8 後端架構與檔案說明 (Backend Docstrings)

這份文件彙整了 `backend/app/` 目錄下各個 Python 檔案的頂層模組註解（Docstrings）。原始檔案中的註解已被移除以保持程式碼簡潔。

## `main.py`

```text
模組名稱: app.main
功能描述: 後端應用程式入口點 (Application Entry Point)

這是整個 FastAPI 後端服務的啟動檔案。負責初始化應用程式實例、
掛載中介軟體 (Middleware)、建立資料庫連線以及註冊 API 路由。

主要流程:
    1. 建立資料庫表格: `Base.metadata.create_all` (用於開發階段自動建表)。
    2. 初始化 FastAPI App: 設定標題與版本。
    3. 設定 CORS: 允許跨域請求 (目前設定為允許所有來源 "*" 用于開發)。
    4. 註冊路由: 將 `api_router` 掛載到 `/api/v1` 路徑下。

啟動方式:
    通常由 Uvicorn 執行此檔案: `uvicorn app.main:app --reload`
```

## `core/component_loader.py`

```text
Module: app.core.component_loader
Description: Dynamically loads game module configurations from YAML files.
This replaces hardcoded Pydantic schemas and prompts, allowing users to
add new game components simply by dropping a new YAML file.
```

## `core/config.py`

```text
模組名稱: app.core.config
功能描述: 應用程式全域設定檔 (Application Configuration)

此模組負責管理後端應用程式所有的環境變數與設定參數。
使用 Pydantic 的 BaseSettings 類別來進行環境變數的讀取與驗證，
確保在不同環境 (Developer, Production) 下能安全地切換設定。

主要類別:
    - Settings: 設定模型，定義了所有可用的環境變數及其預設值。

主要屬性 (Attributes):
    - PROJECT_NAME (str): 專案名稱 (預設: "Learn8")
    - API_V1_STR (str): API 版本前綴 (預設: "/api/v1")
    - SECRET_KEY (str): 用於 JWT 加密簽名的密鑰 (應由 .env 讀取)
    - ALGORITHM (str): 加密演算法 (預設: "HS256")
    - ACCESS_TOKEN_EXPIRE_MINUTES (int): Access Token 的有效時間 (分鐘)
    - DATABASE_URL (str): 資料庫連線字串 (預設: SQLite)
    - GOOGLE_API_KEY (str): Google Gemini API 金鑰
    - LLM_PROVIDER (str): LLM 供應商選擇 (google | lmstudio)
    - GEMINI_MODEL (str): 使用的模型版本 (預設: "gemini-2.5-flash")

內部類別:
    - Config: 指定環境變數讀取規則 (大小寫敏感、讀取 .env 檔案)

實例化物件:
    - settings: 全域可用的設定實例，供其他模組 import 使用。
```

## `core/exceptions.py`

(無模組說明 / No Docstring)

## `core/prompts.py`

```text
模組名稱: app.core.prompts
功能描述: 系統提示詞庫 (System Prompts Repository)

此模組集中管理所有用於 LLM (Large Language Module) 的 System Prompts。
這些提示詞定義了 AI Agent 的角色、目標、輸出格式 (JSON Schema) 以及教學策略。
修改此處的 Prompts 將直接影響課程生成、大綱規劃與教學互動的品質。

主要常數 (Constants):
    - REFINE_SYLLABUS_PROMPT:
        功能: 用於根據使用者回饋 (Feedback) 來修正現有的課程大綱。
        角色: Learn8 Architect
        輸入: 當前大綱 JSON、使用者回饋文字。
        輸出: 修正後的 CoursePath JSON。

    - SYSTEM_PROMPT (Legacy):
        功能: NeoLearn 2.0 舊版生成邏輯，定義了遊戲化組件矩陣 (Component Matrix)。
        包含詳細的組件選擇規則 (Instruction, Practice, Assessment, Incentive)。

    - SYLLABUS_SYSTEM_PROMPT:
        功能: 用於生成課程藍圖 (Blueprint)。
        角色: Course Architect
        任務: 將主題拆解為單元 (Units) 與節點 (Nodes)。
        關鍵: 必須為每個節點規劃 "Instructional Goal" 與 "Recommended Component"。

    - NODE_SYSTEM_PROMPT:
        功能: 用於生成單一節點的詳細課程內容 (Lesson Stages)。
        角色: Content Creator
        任務: 設計多階段的學習路徑 (Multi-stage Learning Path)。
        策略: 決定該節點需要包含「教學」、「練習」還是「測驗」模組。

    - REMEDIAL_SYSTEM_PROMPT:
        功能: 生成補救教學內容 (Remedial Content)。
        觸發: 當使用者在某個階段失敗 (Fail) 時。
        策略: 切換為更簡單的 Instruction 或 Practice 模式。

    - SYSTEM_PROMPT_FEYNMAN:
        功能: 費曼技巧模擬器 (Feynman Technique Simulator)。
        角色: Richard Feynman (物理學家)
        任務: 評估學生對於概念的解釋是否準確且通俗易懂。
        輸出: 包含 isCorrect (布林值) 與 feedback (費曼語氣的評語)。
```

## `core/security.py`

```text
模組名稱: app.core.security
功能描述: 安全認證工具組 (Security & Authentication Utilities)

此模組提供後端安全相關的核心功能，包括密碼加密雜湊 (Hashing) 與 
JWT (JSON Web Token) 的簽發與驗證。

主要依賴:
    - jose (python-jose): 用於處理 JWT 的編碼與解碼。
    - passlib (bcrypt): 用於安全的密碼雜湊處理。
    - app.core.config: 讀取 SECRET_KEY 與 ALGORITHM 設定。

全域變數:
    - pwd_context: CryptContext 實例，配置使用 bcrypt 演算法。

主要函式 (Functions):
    1. create_access_token(subject: str | Any, expires_delta: timedelta = None) -> str
        - 功能: 產生 JWT Access Token。
        - 參數:
            - subject: Token 的主體 (通常是 User ID 或 Username)。
            - expires_delta: (選填) Token 有效期限，若未填則使用預設值。
        - 回傳: 編碼後的 JWT 字串。

    2. verify_password(plain_password: str, hashed_password: str) -> bool
        - 功能: 驗證明文密碼是否與雜湊密碼匹配。
        - 參數:
            - plain_password: 使用者輸入的明文密碼。
            - hashed_password: 資料庫中儲存的雜湊密碼。
        - 回傳: 驗證成功回傳 True，否則 False。

    3. get_password_hash(password: str) -> str
        - 功能: 將明文密碼進行雜湊加密。
        - 參數:
            - password: 明文密碼。
        - 回傳: 加密後的雜湊字串 (用於存入資料庫)。
```

## `models/course.py`

```text
模組名稱: app.models.course
功能描述: 課程體系資料模型 (Course & Node Models)

定義了構成課程大綱核心結構的資料表。

資料表 (Tables):
    1. courses (CourseModel)
        - 描述: 儲存課程大綱 (Syllabus) 的基本資訊。
        - 欄位:
            - topic: 使用者輸入的學習主題 (如 "Introduction to Python")。
            - syllabus_json: 完整的大綱結構 JSON (包含所有 Units 和 Nodes 的結構樹)。
            - project_id: 所屬專案 ID (外鍵)。

    2. nodes (NodeModel)
        - 描述: 扁平化儲存課程中的每一個學習節點 (Lesson Node)。
        - 目的: 方便快速查詢節點狀態，而不需要解析龐大的 syllabus_json。
        - 欄位:
            - node_id: 節點唯一識別碼 (如 "unit-1-node-2")。
            - status: 學習狀態 (locked | available | completed)。
            - data: 節點的詳細中繼資料 (Metadata)。

關聯性:
    - Course 與 Project 為多對一關係。
    - Node 與 Course 為多對一關係。
```

## `models/job.py`

(無模組說明 / No Docstring)

## `models/lesson.py`

```text
模組名稱: app.models.lesson
功能描述: 課程內容與學習紀錄模型 (Lesson Content & Attempts)

定義了實際生成的教學內容以及學生的答題紀錄。

資料表 (Tables):
    1. lessons (LessonModel)
        - 描述: 儲存 AI 針對特定節點 (Node) 生成的詳細教學內容。
        - 欄位:
            - node_id: 對應的節點 ID。
            - course_topic: 課程主題上下文。
            - stage_json: 核心欄位，儲存多階段 (Multi-stage) 的課程內容 List。
              包含教學 (Instruction)、練習 (Practice)、測驗 (Assessment) 等階段的完整設定。

    2. lesson_attempts (LessonAttempt)
        - 描述: 記錄學生在互動過程中的每一次答題嘗試。
        - 用途: 用於數據分析、學習歷程追蹤，以及 AI 補救教學的依據。
        - 欄位:
            - stage_id: 嘗試的階段 ID。
            - user_input: 學生的輸入內容 (可能是選項、程式碼或文字解釋)。
            - is_correct: 答題是否正確。
```

## `models/project.py`

```text
模組名稱: app.models.project
功能描述: 專案資料模型 (Project Model)

定義了使用者的專案 (Workspace) 概念。
專案是 Learn8 的核心隔離單位，所有的上傳檔案 (PDF) 與 RAG 向量索引
都基於 Project 進行實體隔離。

資料表 (Tables):
    1. projects (ProjectModel)
        - 欄位:
            - name: 顯示給使用者看的專案名稱。
            - folder_name: 系統內部使用的資料夾名稱 (UUID)，確保唯一性與路徑安全。
            - user_id: 專案擁有者。

安全機制:
    - folder_name 必須是唯一的，且通常由系統自動生成 (UUID4)，
      避免使用者輸入惡意路徑或發生名稱衝突。
```

## `models/user.py`

```text
模組名稱: app.models.user
功能描述: 使用者資料模型 (User Model)

定義了系統中的使用者帳戶資訊。

資料表 (Tables):
    1. users (UserModel)
        - 欄位:
            - email: 使用者信箱 (唯一識別)。
            - hashed_password: 加密後的密碼 (絕不明文儲存)。
        
備註:
    目前系統的設計偏向 MVP (Minimum Viable Product)，
    因此使用者模型較為精簡，未來可擴充加入 Profile、Preferences 等欄位。
```

## `schemas/auth.py`

```text
模組名稱: app.schemas.auth
功能描述: 認證資料架構 (Authentication Schemas)

定義與使用者註冊、登入及權杖 (Token) 相關的 Pydantic 模型。
負責 API 請求主體 (Request Body) 的驗證與序列化。

主要模型:
    1. Token
        - 用途: 回傳給前端的 JWT 資訊。
        - 欄位: access_token, token_type (Bearer)。

    2. UserCreate
        - 用途: 註冊新使用者時的請求格式。
        - 欄位: email, password (明文，後端會加密)。

    3. UserLogin
        - 用途: 使用者登入時的請求格式。
```

## `schemas/course.py`

```text
模組名稱: app.schemas.course
功能描述: 課程與大綱資料架構 (Course Syllabus Schemas)

定義課程結構的 Pydantic 模型，這是學習路徑的核心骨架。
採用巢狀結構：CoursePath -> Units -> Nodes。

主要模型:
    1. LessonNode (學習節點)
        - 描述: 課程從中最小的學習單位。
        - 欄位:
             - status: 節點狀態 (locked/available/completed)。
             - recommended_component: AI 建議使用的遊戲化組件 (如 TextToken)。
             - instructional_goal: 該節點的具體教學目標。

    2. Unit (學習單元)
        - 描述: 由多個節點組成的章節。

    3. CoursePath (完整大綱)
        - 描述: 整個課程的藍圖。

    4. RefineSyllabusRequest
        - 用途: 使用者要求 AI "修正大綱" 時的請求格式。
        - 欄位: userFeedback (使用者的修改意見)。
```

## `schemas/lesson.py`

```text
模組名稱: app.schemas.lesson
功能描述: 遊戲化課程內容架構 (Gamified Lesson Content Schemas)

這是系統中最複雜的 Schema 模組，定義了 "Lesson Stage" (課程階段) 的多態性結構。
利用 Pydantic 的 Union 與 Discriminator 機制，支援多種不同的遊戲化組件配置。

主要枚舉 (Enums):
    - ModuleType: 教學模組類型 (Instruction, Practice, Assessment, Incentive)。
    - ComponentType: 前端 UI 組件類型 (TextToken, TaxonomyMatrix, PatternMatcher 等)。
    - SkinType: 介面風格 (Scientific, Classic, Code)。
    - ValidationType: 答案驗證邏輯 (Exact, Regex, Logic)。

核心模型 (Stage Models):
    - LessonStage (Union): 代表任意一種階段類型。
    - TextTokenStage: 針對 TextToken 組件的設定。
    - TaxonomyStage: 針對 TaxonomyMatrix 組件的設定。
    - PatternMatcherStage: 針對 PatternMatcher 組件的設定。

互動模型:
    - SubmissionRequest: 前端提交答案的格式。
    - SubmissionResponse: 後端回傳的判定結果 (包含 nextAction, remedialStage)。
```

## `schemas/project.py`

```text
模組名稱: app.schemas.project
功能描述: 專案管理資料架構 (Project Management Schemas)

定義專案 (Project) 的建立與回傳格式。

主要模型:
    1. ProjectCreate
        - 用途: 建立新專案時只需要提供名稱 (name)。
        - 備註: folder_name 由後端自動生成，不需要前端提供。

    2. ProjectResponse
        - 用途: 回傳專案詳細資訊，包含這 ID 與擁有者資訊。
        - Config: 設定 `from_attributes = True` 以支援從 SQLAlchemy Model 自動轉換。
```

## `schemas/questionnaire.py`

(無模組說明 / No Docstring)

## `db/base.py`

```text
模組名稱: app.db.base
功能描述: 資料庫模型匯入中心 (Database Model Imports)

此模組專門用於匯入所有的 SQLAlchemy ORM 模型 (Models)。
主要目的是讓 Alembic (資料庫遷移工具) 在自動生成遷移檔時，能夠偵測到所有的資料表定義。
若新增了 Model 卻未在此處匯入，Alembic 將無法追蹤該資料表的變更。

匯入清單:
    - Base: SQLAlchemy Base 類別
    - UserModel: 使用者資料表
    - ProjectModel: 專案資料表
    - CourseModel, NodeModel: 課程與節點資料表
    - LessonModel: 課程內容資料表
```

## `db/base_class.py`

```text
模組名稱: app.db.base_class
功能描述: ORM 基底類別 (Declarative Base)

定義了所有 SQLAlchemy Model 的基底類別 `Base`。
此類別使用了 `as_declarative` 裝飾器，並實作了自動生成資料表名稱的邏輯。

主要類別:
    - Base: 所有 Model 都繼承此類別。

功能:
    1. id: 預留 id 欄位 (雖然實際定義通常在子類別)。
    2. __tablename__: 自動將 ClassName (駝峰式) 轉換為小寫複數的資料表名稱。
       例如: `UserModel` -> `users` (而非 user_model)。
```

## `db/session.py`

```text
模組名稱: app.db.session
功能描述: 資料庫連線階段 (Database Session)

此模組負責建立與資料庫的連線引擎 (Engine) 與會話工廠 (SessionLocal)。
應用程式在處理每個請求時，都會透過此處的 SessionLocal 產生一個獨立的資料庫會話。

主要物件:
    - engine: SQLAlchemy 連線引擎，負責底層的連線池管理。

    - SessionLocal: sessionmaker 產生的工廠函式。
      - autocommit=False: 關閉自動提交，確保交易 (Transaction) 安全。
      - autoflush=False: 關閉自動刷新，避免過早將變更寫入資料庫。

使用方式:
    通常搭配 `app.api.deps.get_db` 依賴注入使用，確保每個 Request 結束後 Session 會自動關閉。
```

## `api/deps.py`

```text
模組名稱: app.api.deps
功能描述: API 依賴注入 (Dependency Injection)

定義了 FastAPI 的 Depends 依賴項，供路由函式使用。
主要負責處理「通用」的任務，如資料庫連線管理與使用者身分驗證。

主要函式:
    1. get_db() -> Generator
        - 功能: 取得資料庫連線 (Session)。
        - 機制: 使用 yield 語法，確保請求結束後自動關閉連線 (db.close)。

    2. get_current_user(token, db) -> UserModel
        - 功能: 解析 JWT Token 並取得當前使用者物件。
        - 流程:
            1. 從 Header 取得 Bearer Token。
            2. 使用 SECRET_KEY 解碼 Token。
            3. 從 DB 查詢對應 email 的使用者。
        - 異常: 若 Token 無效或過期，拋出 HTTP 401 Unauthorized。
```

## `api/v1/api.py`

```text
模組名稱: app.api.v1.api
功能描述: API 路由中心 (Central Router)

此模組負責彙整 V1 版本所有的子路由 (Sub-routers)。
透過 `api_router.include_router` 將不同功能的 endpoints 註冊到主應用程式中。

路由結構:
    - /auth: 認證相關 (登入、註冊)。
    - /projects: 專案管理 (建立、刪除、草稿)。
    - /projects: 專案檔案管理 (上傳、刪除、列表)。
    - /projects: 問卷功能 (生成、提交)。
    - /courses: 課程大綱管理 (生成、查詢、狀態更新)。
    - /lessons: 單元內容生成與互動 (提交答案、生成補救教學)。
    - /system: 系統層級功能 (健康檢查等)。

這種結構設計確保了 API 的擴充性與模組化，避免單一檔案過於龐大。
```

## `api/v1/endpoints/auth.py`

```text
模組名稱: app.api.v1.endpoints.auth
功能描述: 認證相關 API (Authentication Endpoints)

處理使用者註冊、登入以及開發者快速登入功能。

路由列表:
    1. POST /register
        - 功能: 註冊新帳號。
        - 邏輯: 檢查 Email 是否重複 -> 雜湊密碼 -> 寫入 DB。

    2. POST /login
        - 功能: 一般登入。
        - 回傳: JWT Access Token (Bearer)。

    3. POST /dev-login
        - 功能: 開發者快速登入 (僅用於測試環境)。
        - 邏輯: 自動建立或登入 "dev@learn8.ai" 帳號，免輸入密碼。
```

## `api/v1/endpoints/courses.py`

```text
模組名稱: app.api.v1.endpoints.courses
功能描述: 課程與大綱管理 API (Course Management Endpoints)

負責課程大綱 (Syllabus) 的生成、查詢、修正以及學習進度的更新。
這是 Learn8 的核心業務邏輯入口。

路由列表:
    1. GET /
        - 功能: 列出當前使用者的所有課程。
        - 支援依 project_id 篩選。

    2. GET /{course_id}
        - 功能: 取得指定課程的完整大綱 (Syllabus JSON)。

    3. POST /generate-syllabus
        - 功能: AI 自動生成課程大綱。
        - 流程:
            1. 檢查是否已有相同主題的課程 (Cache Check)。
            2. 呼叫 `SyllabusAgent` 進行 Agentic Workflow 生成。
            3. 將生成結果存入 DB (同時建立 Course 與 Nodes 紀錄)。
        - 架構註記: 內部資料庫操作皆封裝於 threadpool 執行，確保高並發度不阻塞事件迴圈。

    4. POST /refine-syllabus
        - 功能: 根據使用者回饋修正大綱。
        - 工具: 使用 LangGraph (syllabus_graph) 進行多輪對話修正。

    5. PATCH /{course_id}/node/{node_id}/status
        - 功能: 更新學習節點狀態 (如從 locked -> available -> completed)。
        - 邏輯: 當節點完成時，會自動解鎖下一個節點 (連鎖解鎖邏輯)。
```

## `api/v1/endpoints/jobs.py`

(無模組說明 / No Docstring)

## `api/v1/endpoints/lessons.py`

```text
模組名稱: app.api.v1.endpoints.lessons
功能描述: 單元內容生成與互動 API (Lesson Content & Interaction Endpoints)

負責生成具體的學習內容 (Stages) 以及處理使用者的互動回饋。
此模組連接了 LLM Architect (生成端) 與 Frontend Player (互動端)。

路由列表:
    1. POST /generate-lesson-from-node
        - 功能: 為特定節點生成多階段的學習內容 (Lesson Stages)。
        - 緩存機制 (Caching): 若 DB 中已有生成過的內容，會優先回傳 (避免重複扣款與等待)。
        - 輸出: 回傳 List[LessonStage]，前端依序播放。
        - 架構註記: 內部資料庫操作皆封裝於 threadpool 執行，確保高並發度不阻塞事件迴圈。

    2. POST /submit-answer
        - 功能: 處理學生提交的答案。
        - 邏輯:
            - Client-side 驗證通過 -> 記錄 Log -> 回傳 Proceed。
            - 失敗 -> 觸發 "Remedial Generation" (補救教學生成)。
            - FeynmanMirror 組件 -> 使用 AI 評分 (Grade) -> 回傳詳細評語。
```

## `api/v1/endpoints/project_files.py`

```text
模組名稱: app.api.v1.endpoints.project_files
功能描述: 專案檔案管理 API (Project File Management Endpoints)

處理專案內檔案的上傳、列表查詢與刪除。

路由列表:
    1. GET /{project_id}/files - 列出專案內所有檔案
    2. DELETE /{project_id}/files/{filename} - 刪除指定檔案
    3. POST /upload-pdf - 上傳 PDF 並觸發 RAG 索引
```

## `api/v1/endpoints/projects.py`

```text
模組名稱: app.api.v1.endpoints.projects
功能描述: 專案管理 API (Project Management Endpoints)

處理專案的生命週期管理 (CRUD)。
檔案管理和問卷功能已拆分至獨立模組。

路由列表:
    1. POST / - 建立新專案
    2. GET / - 列出所有專案
    3. PATCH /{project_id} - 更新專案名稱
    4. DELETE /{project_id} - 刪除專案（含清理檔案與向量索引）
    5. PUT /{project_id}/draft - 儲存專案草稿
    6. GET /{project_id}/draft - 取得專案草稿
```

## `api/v1/endpoints/questionnaire.py`

```text
模組名稱: app.api.v1.endpoints.questionnaire
功能描述: 學習者問卷 API (Learner Questionnaire Endpoints)

處理問卷的生成與提交，用於收集學習者偏好並生成個人化學習檔案。

路由列表:
    1. POST /{project_id}/questionnaire - 生成問卷問題
    2. POST /{project_id}/questionnaire/submit - 提交問卷並生成學習者檔案
```

## `api/v1/endpoints/system.py`

```text
模組名稱: app.api.v1.endpoints.system
功能描述: 系統管理與工具 API (System & Admin Endpoints)

提供系統層級的管理功能，主要用於開發測試與除錯。

路由列表:
    1. POST /reset-db
        - 對象: 僅限管理員或開發者。
        - 功能: "Factory Reset" —— 刪除所有資料表並重建。
        - 警告: 此操作不可逆，會清空所有使用者與課程資料。

    2. POST /clear-files
        - 對象: 僅限管理員。
        - 功能: 清空 `uploads/` 資料夾下的所有檔案。
```

## `services/commons/activity_logger.py`

```text
Module: app.services.commons.activity_logger
Description: Centralized Activity Logging Service

Provides structured logging for all user activities with detailed context.
Logs are written to both console and file with rotation.

Usage:
    from app.services.commons.activity_logger import ActivityLogger
    ActivityLogger.log_login(user_email="john@example.com")
```

## `services/commons/file_service.py`

```text
模組名稱: app.services.commons.file_service
功能描述: 檔案管理服務 (File Management Service)

負責處理本地檔案系統的操作，如上傳、列表查詢與刪除。
確保所有檔案路徑都限制在 `uploads/{user_id}/{project_folder}` 沙盒中，
防止 Directory Traversal 攻擊。

主要類別:
    - FileService (Static Methods Only)

主要方法:
    1. save_upload_file: 將上傳的檔案 (UploadFile) 寫入磁碟。
    2. list_files: 列出該專案下的所有檔案名稱 (過濾隱藏檔)。
    3. delete_project_folder: 遞迴刪除整個專案資料夾 (慎用)。
    4. read_file_content: 讀取檔案內容字串，內建安全長度截斷機制。
```

## `services/workflows/syllabus_workflow.py`

```text
模組名稱: app.services.workflows.syllabus_workflow
功能描述: 課程大綱修正流程圖 (LangGraph Workflow)

定義了基於 LangGraph 的狀態機 (State Machine)，用於處理 "Refine Syllabus" 的多輪互動流程。
雖目前的實作為單一節點 (refine_step)，但預留了擴充為多步驟思考 (Think -> Critique -> Refine) 的能力。

主要元件:
    - SyllabusState (TypedDict): 定義流程中的共享狀態 (State Schema)。
    - refine_step (Node): 執行實際的 LLM 呼叫來修改大綱。
    - syllabus_graph (CompiledGraph): 編譯完成的可執行圖物件。

使用方式:
    `await syllabus_graph.ainvoke({...inputs...})`
```

## `services/workers/generation_worker.py`

(無模組說明 / No Docstring)

## `services/knowledge_base/document_processor.py`

(無模組說明 / No Docstring)

## `services/knowledge_base/rag_engine.py`

```text
模組名稱: app.services.knowledge_base.rag_engine
功能描述: RAG 知識檢索引擎 (Retrieval-Augmented Generation Engine)

負責將使用者的 PDF 文件轉換為向量索引 (Vector Index)，並提供語意搜尋功能。
整合了 Google Gemini Embeddings 與 ChromaDB。

核心類別:
    - RAGEngine (Class Methods, Singleton Vectorstore)

主要流程:
    1. Ingestion (索引建立):
       PDF -> PyPDFLoader -> Text Splitter (Chunking) -> Embeddings -> ChromaDB。
       *重點*: 每個 Document 都會標記 `project_id` metadata 以實現資料隔離。

    2. Retrieval (搜尋):
       Query -> Query Expansion (生成 3 個相關查詢) -> Vector Search (Chroma) -> Reranking (過濾) -> Context。

方法清單:
    - ingest_pdf: 處理檔案上傳並建立索引。
    - query_context: 根據 Topic 搜尋相關知識片段。
    - delete_project_context: 清除指定專案的所有向量資料。
```

## `services/ai_agents/architect.py`

```text
模組名稱: app.services.ai_agents.architect
功能描述: AI 架構師服務 (AI Architect Service)

此模組是後端業務邏輯 (Services) 與 LLM 抽象層 (Provider) 之間的橋樑。
負責將具體的業務需求 (如 "生成單元內容") 轉換為 LLM 能夠理解的 Prompt 組合。

主要函式:
    1. generate_course_syllabus (Legacy):
       - 舊版的大綱生成邏輯，目前主要由 SyllabusAgent 取代。

    2. refine_course_syllabus:
       - 功能: 根據使用者回饋 (Feedback) 修改大綱。

    3. generate_lesson_from_node:
       - 功能: 為單一節點生成多階段 (Multi-stage) 的課程內容。
       - 流程: 綁定 RAG 檔案 -> 組合 Prompt -> 呼叫 LLM -> 解析 JSON -> 補上 ID。

    4. generate_remedial_stage:
       - 功能: 生成補救教學內容 (當學生答錯時)。

    5. grade_feynman_attempt:
       - 功能: 對學生的「費曼解釋」進行評分與回饋。
```

## `services/ai_agents/questionnaire_agent.py`

(無模組說明 / No Docstring)

## `services/ai_agents/syllabus_agent.py`

```text
模組名稱: app.services.ai_agents.syllabus_agent
功能描述: 課程大綱生成代理人 (Syllabus Generation Agent)

此 Agent 專責處理課程大綱的生成任務，採用 "Blueprint First" (先藍圖後細節) 的兩階段生成策略。
相比於舊版的單次生成，此方法更能確保課程結構的邏輯性與深度。

主要職責:
    1. Blueprint Generation (藍圖生成):
       - 階段目標: 規劃課程標題 (Title) 與單元列表 (Units)。
       - 提示詞: BLUEPRINT_SYSTEM_PROMPT。

    2. Unit Expansion (單元展開):
       - 階段目標: 針對每一個單元，逐一生成詳細的學習節點 (Nodes)。
       - 關鍵技術: 
         - RAG Context Injection: 在展開每個單元時，會根據單元標題與目標 (Unit Goal) 去檢索 RAG 知識庫，確保生成的內容具有該領域的專業深度。
         - Concurrency (並發處理): 使用 `asyncio.gather` 與 Semaphore 進行多單元同步展開，大幅縮短生成時間。

主要方法:
    - run: Agent 入口點，協調上述兩個階段的流程。
```

## `services/llm_clients/base.py`

```text
模組名稱: app.services.llm_clients.base
功能描述: LLM 供應商介面 (LLM Provider Interface)

定義了所有 LLM Provider 必須實作的抽象基底類別 (ABC)。
這使得系統可以隨意切換底層模型 (Google Gemini, OpenAI, Claude, Local LLM) 而不影響上層業務邏輯。

主要方法:
    1. bind_files(files): 綁定本地檔案 (主要用於 RAG 或 長文本功能)。
    2. generate_text(messages): 生成純文字回應。
    3. generate_structured(messages, schema): 生成符合 Pydantic Schema 的結構化 JSON 資料。
```

## `services/llm_clients/factory.py`

```text
模組名稱: app.services.llm_clients.factory
功能描述: LLM 供應商工廠 (LLM Provider Factory)

使用 Simple Factory 模式，根據環境變數 (LLM_PROVIDER) 動態實例化對應的 LLM Provider。

支援選項:
    - "google": 使用官方 Google Gemini API (LangChain 實作)。
    - "mock": 使用 Mock 資料 (用於單元測試或無網路環境)。
```

## `services/llm_clients/google_adapter.py`

```text
模組名稱: app.services.llm_clients.google_adapter
功能描述: Google Gemini API 配接器 (Google Adapter)

實作 BaseLLMProvider 介面，封裝 langchain-google-genai 函式庫。
用於與官方 Google Gemini API 進行通訊。

實作細節:
    - 支援 with_structured_output (若 LangChain 版本支援) 或 PydanticOutputParser。
```

## `services/llm_clients/lmstudio_adapter.py`

```text
模組名稱: app.services.llm_clients.lmstudio_adapter
功能描述: LM Studio API 配接器 (LM Studio Adapter)

實作 BaseLLMProvider 介面，封裝 langchain-openai 函式庫以連線至地端 LM Studio。
由於 LM Studio 預設提供與 OpenAI 完全相容的 API 接口 (v1)，我們可以直接利用 ChatOpenAI 來與其溝通。

實作細節:
    - 支援 with_structured_output 進行結構化 JSON 生成 (利用 Tools-calling 或 JSON mode)。
    - 若模型不支援 structured output，預設會捕捉錯誤。
```

