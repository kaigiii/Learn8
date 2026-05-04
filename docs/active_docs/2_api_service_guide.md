# 📡 API 服務與 VoxCPM 微服務指南 (Complete and Detailed Edition)

本文檔提供最詳盡的 API 說明手冊，整合了系統的核心功能 API，並完整合併並更新了 **VoxCPM 語音合成微服務** 的所有技術細節與最新調用指南。

---

## 💥 1. API 與語音合成之架構亮點與特色 (Core Highlights)

Learn8 的全站 API 具備以下頂級技術亮點與架構特色：
- **統一的非資料庫資料存放層 (Unified Storage Layer)**：將所有向量庫、快取、上傳檔案、模型預設音訊統一收攏至 `backend/data/` 根目錄中。這樣的架構高度模組化，大幅簡化了資料備份、容器化部署與擴展的難度。
- **高擬真度助教音色克隆 (High-Fidelity Voice Cloning)**：深度整合了 VoxCPM 語音微服務，支援聲音設計（Voice Design）、可控克隆（Controllable Cloning）與極致克隆（Ultimate Cloning）。AI 助教能夠生成帶有豐富情感與自然語氣的朗讀音訊，提供沈浸式的互動教學體驗。
- **背景任務非同步補建 (Asynchronous Background Pre-generation)**：利用 SSE Jobs 與 FastAPI 背景任務，預先為生成完成的關卡補建全套語音快取，消除學員在學習過程中的任何音訊等待延遲。

---

## 🏗️ 2. 系統資料層結構規範 (Storage/Data Layout)

在最新的重構中，我們將所有暫存、資料庫與文件歸檔至統一的 **`backend/data/`** 資料夾：

| 目錄路徑 | 歸檔說明 |
| :--- | :--- |
| **`backend/data/official_courses/`** | 存放官方公開課程的 YAML 大綱與內容。 |
| **`backend/data/custom_published_courses/`** | 存放使用者自建並經審核通過的 YAML 課程備份。 |
| **`backend/data/game_modules/`** | 存放全站支援的關卡題目類型組件 YAML 格式檔案。 |
| **`backend/data/uploads/`** | 包含上傳檔案、`audio_cache` 音訊緩存、`avatar` 頭像等子目錄。 |
| **`backend/data/presets/`** | 存放官方提供的固定助教音色音檔（例如：`wise_tutor.wav` 等）。 |
| **`backend/data/chroma_db/`** | 存放 LangChain / Chroma 的向量特徵檢索庫。 |
| **`backend/data/temp/`** | RAG 或文件解析的暫存文件夾。 |
| **`backend/data/logs/`** | 存放系統與 API 運行的活動紀錄檔案。 |

---

## 🔑 3. 用戶認證與個人進度 API (Authentication)

全站使用者 API 皆預設帶有 JWT Token 驗證保護（`Authorization: Bearer <Token>`）。

### 3.1 用戶註冊 (`POST /api/v1/auth/register`)
- **Payload 規格**：
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123!",
    "full_name": "Learn8 Student",
    "phone_number": "0912345678"
  }
  ```

### 3.2 用戶登入 (`POST /api/v1/auth/login`)
- **Payload 規格**：`{"email": "user@example.com", "password": "SecretPassword123!"}`
- **回應規格**：`{"access_token": "...", "token_type": "bearer"}`

---

## 📚 4. 課程與關卡生成 API (Courses & Generation)

### 4.1 讀取官方公開課程 (`GET /api/v1/courses/public`)
- **描述**：讀取 `backend/data/official_courses/` 下載入的所有系統官方學習主題。

### 4.2 建立/匯入自訂個人課程 (`POST /api/v1/custom-courses`)
- **描述**：支持從指定主題文字（Topic）或 RAG 檔案解析生成學習大綱。

---

## 🎧 5. 音訊合成與 VoxCPM 微服務

### 5.1 微服務環境變數配置
啟動微服務時，可指定下列環境變數：

| 環境變數 | 預設值 | 說明 |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | 服務綁定的 IP 位址 |
| `PORT` | `8000` | 服務監聽的連接埠（Port） |
| `VOXCPM_MODEL_ID` | `openbmb/VoxCPM2` | 預設模型或本機權重路徑 |
| `VOXCPM_LOAD_DENOISER`| `False` | 是否預載降噪模型 |
| `VOXCPM_OPTIMIZE` | `True` | 是否啟用 `torch.compile` 加速 |

### 5.2 語音合成與克隆核心 (`POST /api/v1/audio/speech`)
#### 📥 Payload 完整參數：
```json
{
  "text": "這是要合成的文字內容。",
  "control": "年輕女性，聲音溫柔甜美",
  "reference_wav_path": "/Users/kaigiii/Coding/Learn8/backend/data/presets/gentle_sister.wav",
  "cfg_value": 2.0,
  "inference_timesteps": 15,
  "normalize": true,
  "denoise": true
}
```
