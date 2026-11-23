# 安裝與執行說明

本文件說明如何從 GitHub 下載 Learn8 原始碼，在自己的電腦上安裝並執行。提供兩種方式：

- **方式 A：Docker**（最簡單，一個指令啟動全部服務）
- **方式 B：手動安裝**（適合開發與除錯）

所使用的第三方程式庫與版本，見 [THIRD_PARTY_LIBRARIES.md](THIRD_PARTY_LIBRARIES.md)。

---

## 0. 取得原始碼

```bash
git clone https://github.com/kaigiii/Learn8.git
cd Learn8
```

或在 GitHub 頁面按 **Code → Download ZIP**，解壓縮後進入資料夾。

### 目錄結構

```
Learn8/
├── backend/          後端（FastAPI、AI 生成、資料庫、競技場）
│   ├── app/          主程式
│   ├── alembic/      資料庫遷移
│   ├── tests/        自動化測試
│   ├── scripts/      維運腳本（重置資料庫等）
│   └── data/         系統預設資料（官方課程、題型模組、語音預設、圖片篩選模型）
├── frontend/         前端（Next.js）
├── muse2/            MUSE 2 腦波擷取與分析模組
├── docs/             技術文件
│   ├── active_docs/  系統設計文件（15 份）
│   ├── INSTALLATION.md
│   └── THIRD_PARTY_LIBRARIES.md
├── presentation/     競賽簡報、海報與展示素材
└── docker-compose.yml
```

---

## 1. 事前準備：Google Gemini API 金鑰

Learn8 的課程生成、出題與評分使用 Google Gemini，需要一組 API 金鑰：

1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 登入 Google 帳號。
2. 按「Create API key」，複製金鑰。
3. 稍後填入 `backend/.env` 的 `GOOGLE_API_KEY=`。

> 不想使用雲端 AI 時，可改用本地模型：安裝 [LM Studio](https://lmstudio.ai/) 並啟動伺服器，再把 `.env` 的 `LLM_PROVIDER` 改成 `lmstudio`。

---

## 2. 方式 A：Docker（推薦）

**需要：** [Docker Desktop](https://www.docker.com/products/docker-desktop/)（已內含 Docker Compose）

```bash
# 1. 建立設定檔，並填入 GOOGLE_API_KEY
cp backend/.env.example backend/.env

# 2. 啟動（第一次會下載映像檔並安裝套件，約需 10–20 分鐘）
docker compose up --build

# 3. 另開一個終端機，建立資料表
docker compose exec backend python -m alembic upgrade head
```

啟動後開啟：

| 服務 | 網址 |
|---|---|
| 前端（使用者介面） | http://localhost:13104 |
| 後端 API 文件 | http://localhost:13105/docs |

Docker 會一併啟動 PostgreSQL 15 與 Redis 7，不需另外安裝。停止服務：`docker compose down`。

---

## 3. 方式 B：手動安裝

### 3.1 安裝基礎軟體

| 軟體 | 版本 | 下載 |
|---|---|---|
| Python | 3.12 | https://www.python.org/downloads/ |
| Node.js | 20 以上 | https://nodejs.org/ |
| PostgreSQL | 14 以上 | https://www.postgresql.org/download/ |
| Redis | 6 以上 | 見下方 |

**Redis 安裝：**

```bash
# macOS（Homebrew）
brew install redis && brew services start redis

# Ubuntu / Debian
sudo apt update && sudo apt install redis-server -y
sudo service redis-server start

# Windows：請在 WSL（Ubuntu）中依上方 Ubuntu 指令安裝
```

**建立資料庫：**

```bash
createdb learn8_db
# 或在 psql 中執行：CREATE DATABASE learn8_db;
```

### 3.2 後端

```bash
cd backend

# 建立並啟用虛擬環境
python3.12 -m venv .venv
source .venv/bin/activate          # Windows：.venv\Scripts\activate

# 安裝第三方程式庫（含 PyTorch，約 2–3 GB，需要一些時間）
pip install -r requirements.txt

# 建立設定檔
cp .env.example .env
```

編輯 `backend/.env`，至少確認以下三項：

```ini
GOOGLE_API_KEY=你的金鑰
DATABASE_URL=postgresql://使用者:密碼@localhost:5432/learn8_db
SECRET_KEY=請改成一串隨機長字串
```

> 產生隨機字串：`python -c "import secrets; print(secrets.token_hex(32))"`

建立資料表並啟動：

```bash
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 13105
```

看到 `Application startup complete.` 即啟動成功，API 文件在 http://localhost:13105/docs。

### 3.3 前端

另開一個終端機：

```bash
cd frontend
npm ci          # 依 package-lock.json 安裝確切版本
npm run dev
```

開啟 http://localhost:13104 即可使用。前端會自動把 `/api/v1` 轉送到 `localhost:13105` 的後端。

### 3.4 本機開發登入（選用）

不想註冊帳號時，可在 `backend/.env` 開啟開發用登入：

```ini
AUTH_ENABLE_DEV_LOGIN=True
AUTH_DEV_LOGIN_EMAIL=dev@learn8.ai
AUTH_DEV_LOGIN_PASSWORD=自訂密碼
```

> 僅供本機測試，正式環境務必維持 `False`。

---

## 4. 選用功能

### 4.1 AI 語音助教（VoxCPM）

語音合成是獨立的微服務，不包含在本 repo。`.env.example` 預設 `AUDIO_ENABLED=False`，關閉時系統其他功能完全正常。若另行架設 VoxCPM 服務，將 `AUDIO_ENABLED` 改為 `True`，並確認 `VOXCPM_URL` 指向該服務（預設 `http://127.0.0.1:15060`）。詳見 [7_voxcpm_microservice.md](active_docs/7_voxcpm_microservice.md)。

### 4.2 Neuro Link 腦波理解

- **沒有頭帶（展示用）**：在 `frontend/.env.local` 加入 `NEXT_PUBLIC_ENABLE_NEURO_MOCK=true`，重新啟動前端，即可看到模擬的腦波訊號與疲勞提醒。
- **使用 MUSE 2 頭帶**：

```bash
cd muse2
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
signal-monitor          # 互動式控制台：連線、擷取、即時分析
```

詳細用法見 [muse2/README.md](../muse2/README.md)。

---

## 5. 執行測試

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
DATABASE_URL=sqlite:///./learn8-test.db SECRET_KEY=test python -m pytest tests -q
```

預期結果：`79 passed, 1 skipped`。前端建置檢查：

```bash
cd frontend
npm run build
```

每次推送到 GitHub 時，GitHub Actions 也會自動執行以上兩項檢查（`.github/workflows/ci.yml`）。

---

## 6. 常見問題

| 狀況 | 解決方式 |
|---|---|
| `DATABASE_URL` 未設定、後端無法啟動 | 確認已建立 `backend/.env` 並填寫 `DATABASE_URL` |
| `Connection refused`（6379） | Redis 沒有啟動，執行 `redis-server` 或 `brew services start redis` |
| `relation ... does not exist` | 尚未建立資料表，執行 `python -m alembic upgrade head` |
| 課程生成失敗、AI 無回應 | 檢查 `GOOGLE_API_KEY` 是否正確、是否還有額度 |
| `pip install` 版本衝突 | 確認使用 Python 3.12，並在全新的虛擬環境安裝 |
| 前端打得開但資料讀不到 | 確認後端在 13105 埠執行中 |
| 想清空資料重新開始 | `cd backend && python -m scripts.full_reset_db`（會刪除所有資料） |
