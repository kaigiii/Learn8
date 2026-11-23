# 第三方程式庫與開發工具清單

本文件列出 Learn8 使用的所有第三方程式庫、外部服務與開發工具。

- 「宣告版本」是寫在 `requirements.txt` / `package.json` / `pyproject.toml` 的版本範圍。
- 「實測版本」是開發與測試時實際安裝、已通過測試的版本（2026/11）。
- 第三方程式庫本體**不放進原始碼**，依安裝說明（[INSTALLATION.md](INSTALLATION.md)）用套件管理工具自動下載即可。

---

## 1. 開發工具與執行環境

| 工具 | 版本 | 用途 |
|---|---|---|
| Python | 3.12 | 後端與腦波模組的執行環境 |
| Node.js | 20 以上（實測 24.13） | 前端執行與建置 |
| npm | 10 以上（實測 11.6） | 前端套件管理 |
| pip / uv | pip 24 以上；uv（選用） | Python 套件管理（uv 速度較快） |
| PostgreSQL | 14 以上（Docker 使用 15） | 主要資料庫 |
| Redis | 6 以上（Docker 使用 7，實測 8.6） | 快取、競技場即時訊息 Pub/Sub |
| Docker / Docker Compose | 24 以上 | 一鍵啟動全部服務（選用） |
| Git | 2.40 以上 | 版本控制 |
| GitHub Actions | — | 持續整合：後端測試、前端建置（`.github/workflows/ci.yml`） |
| Visual Studio Code | — | 主要開發編輯器 |

---

## 2. 後端（`backend/requirements.txt`）

### Web 框架與伺服器

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| fastapi | >=0.110.0 | 0.136.1 | REST API 與 WebSocket 框架 |
| uvicorn[standard] | >=0.29.0 | 0.47.0 | ASGI 伺服器 |
| python-multipart | >=0.0.9 | 0.0.29 | 檔案上傳（multipart 表單） |
| python-dotenv | >=1.0.1 | 1.2.2 | 讀取 `.env` 環境變數 |
| watchfiles | >=0.21.0 | 1.2.0 | 開發時自動重新載入 |
| requests | >=2.31.0 | 2.34.2 | 呼叫外部 HTTP 服務（語音服務等） |

### 資料庫與快取

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| sqlalchemy | >=2.0.29 | 2.0.49 | ORM，資料表模型 |
| psycopg2-binary | >=2.9.9 | 2.9.12 | PostgreSQL 同步驅動 |
| asyncpg | >=0.29.0 | 0.31.0 | PostgreSQL 非同步驅動（LISTEN/NOTIFY 推播） |
| alembic | >=1.13.1 | 1.18.4 | 資料庫結構遷移 |
| redis | >=5.0.3 | 7.4.0 | Redis 用戶端（快取、Pub/Sub） |

### 資料驗證與設定

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| pydantic | >=2.7.0 | 2.13.4 | 資料結構驗證、課綱 Schema |
| pydantic-settings | >=2.2.1 | 2.14.1 | 從環境變數載入設定 |
| PyYAML | ==6.0.1 | 6.0.1 | 讀取 YAML 題型定義 |
| json-repair | >=0.30.0 | 0.59.10 | 修復 AI 回傳的不完整 JSON |

### AI 與多代理人

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| langchain | >=0.1.16 | 1.3.1 | LLM 應用框架 |
| langchain-core | >=0.1.42 | 1.4.0 | LangChain 核心介面 |
| langchain-community | >=0.0.33 | 0.4.1 | 社群整合元件 |
| langchain-google-genai | >=1.0.1 | 4.2.2 | 串接 Google Gemini |
| langchain-openai | >=0.1.3 | 1.2.1 | 串接 OpenAI 相容 API（含 LM Studio 本地模型） |
| langchain-text-splitters | >=1.1.0 | 1.1.2 | 教材文字切塊（RAG） |
| langgraph | >=0.0.10 | 1.2.0 | 雙代理人（規劃者／審查者）工作流程 |

### 向量資料庫（RAG）

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| chromadb | >=0.4.24 | 1.5.9 | 本地向量資料庫，儲存教材切塊 |
| langchain-chroma | >=0.1.0 | 1.1.0 | LangChain 與 ChromaDB 的整合 |

### 文件解析

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| markitdown | ==0.1.6 | 0.1.6 | 將 PDF、Word、PPT、Excel 轉成 Markdown |
| markitdown-ocr | ==0.1.0 | 0.1.0 | 掃描型 PDF 的 OCR（以視覺模型辨識） |
| mammoth | ~=1.11.0 | 1.11.0 | Word（.docx）轉換 |
| pymupdf | >=1.24.0 | 1.28.0 | PDF 讀取與頁面轉圖 |
| pypdf | 未指定 | 6.11.0 | PDF 讀取 |
| pdfminer-six | >=20260107 | 20260107 | PDF 文字抽取 |
| pdfplumber | >=0.11.10 | 0.11.10 | PDF 表格與版面抽取 |
| python-docx | 未指定 | 1.2.0 | Word 文件處理 |
| python-pptx | 未指定 | 1.0.2 | PowerPoint 文件處理 |
| pandas | 未指定 | 3.0.3 | 表格資料處理 |
| openpyxl | 未指定 | 3.1.5 | Excel 文件處理 |

> markitdown、markitdown-ocr、mammoth 三者版本互相綁定，請一起升級並重新測試（markitdown 0.1.9／markitdown-ocr 0.1.2 需要 mammoth ≥ 1.12.2）。

### 影像模型

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| torch | >=2.2.0 | 2.12.0 | 執行圖片篩選模型（`backend/data/models/image_filter_model.pth`） |
| torchvision | >=0.17.0 | 0.27.0 | 影像前處理 |
| Pillow | >=10.3.0 | 12.3.0 | 圖片讀寫與縮放 |

### 安全與認證

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| python-jose[cryptography] | 未指定 | 3.5.0 | JWT 簽發與驗證 |
| passlib[bcrypt] | 未指定 | 1.7.4 | 密碼雜湊框架 |
| bcrypt | ==4.3.0 | 4.3.0 | 密碼雜湊演算法 |

### 測試（`backend/requirements-dev.txt`）

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| pytest | >=8.0,<9.0 | 8.4.2 | 後端自動化測試（79 項） |

---

## 3. 前端（`frontend/package.json`）

### 執行時套件

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| next | ^14.2.0 | 14.2.35 | React 全端框架（App Router） |
| react | ^18.2.0 | 18.3.1 | UI 函式庫 |
| react-dom | ^18.2.0 | 18.3.1 | React 網頁渲染 |
| zustand | ^4.5.0 | 4.5.7 | 全域狀態管理 |
| framer-motion | ^12.34.3 | 12.34.3 | 介面動畫 |
| lucide-react | ^1.16.0 | 1.16.0 | 圖示 |
| react-icons | ^5.3.0 | 5.5.0 | 圖示 |
| react-easy-crop | ^5.5.7 | 5.5.7 | 頭像裁切 |

### 開發與建置套件

| 套件 | 宣告版本 | 實測版本 | 用途 |
|---|---|---|---|
| typescript | ^5.0.0 | 5.9.3 | 型別檢查 |
| tailwindcss | ^3.4.0 | 3.4.19 | CSS 工具框架 |
| postcss | ^8.4.0 | 8.5.6 | CSS 後處理 |
| autoprefixer | ^10.4.0 | 10.4.27 | 自動加上瀏覽器前綴 |
| esbuild | ^0.28.1 | 0.28.1 | 離線版課程打包（`npm run build:offline`） |
| @types/node、@types/react、@types/react-dom | ^20 / ^18 / ^18 | 20.19.34 / 18.3.28 / 18.3.7 | TypeScript 型別定義 |

完整的間接相依與確切版本鎖定在 `frontend/package-lock.json`。

---

## 4. 腦波模組 MUSE 2（`muse2/pyproject.toml`）

| 套件 | 用途 |
|---|---|
| muselsl | MUSE 2 頭帶串流（會一併安裝 pylsl） |
| bleak | 藍牙 BLE 連線 |
| numpy | 陣列運算、每秒 FFT 分析 |
| scipy | 濾波與眨眼偵測 |
| pandas | 讀取特徵 CSV |
| scikit-learn | 邏輯迴歸分類器 |
| joblib | 模型儲存與載入 |

---

## 5. 外部服務與硬體

| 名稱 | 必要性 | 用途 |
|---|---|---|
| Google Gemini API | **必要**（或改用 LM Studio） | 課綱、題目、評分等 AI 生成；需在 `.env` 設定 `GOOGLE_API_KEY` |
| LM Studio | 選用 | 本地執行開源模型，取代 Gemini（`LLM_PROVIDER=lmstudio`） |
| VoxCPM 語音服務 | 選用 | AI 語音助教；獨立服務，不含在本 repo；`.env.example` 預設 `AUDIO_ENABLED=False`（關閉語音） |
| MUSE 2 腦波頭帶 | 選用 | Neuro Link 即時腦波讀取；沒有頭帶時可用模擬模式（`NEXT_PUBLIC_ENABLE_NEURO_MOCK=true`） |

---

## 6. 授權

所有第三方程式庫皆為開源授權（MIT、BSD、Apache-2.0、PSF 等），版權屬原作者所有。各套件的授權條款可在安裝後的套件目錄或其官方頁面查閱。
