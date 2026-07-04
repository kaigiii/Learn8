# 📡 API 服務與全站路由指南 (Complete Architectural Edition)

本文檔提供最詳盡的 API 說明手冊，整合了 Learn8 系統的所有核心業務端點，包括認證、生成、社交與競技場流轉。

---

## 💥 1. API 架構亮點與特色 (Core Highlights)

Learn8 的全站 API 具備以下頂級技術亮點與架構特色：
- **統一的資料與日誌分層 (Data/Log Separation)**：將數據資產 (`/data`) 與運行日誌 (`/logs`) 物理隔離，極大化運維便利性。
- **SSE 非同步任務流**：透過 Server-Sent Events 提供極致的生成進度反饋。
- **高度模組化的音訊整合**：音訊處理已抽象為 `AudioService`，底層調用獨立的 [VoxCPM 語音合成微服務](./7_voxcpm_microservice.md)。

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
| **`backend/data/logs/`** | 存放系統與 API 運行的活動紀錄檔案 (`activity.log`)。 |

---

## 📂 3. Service 層架構組織 (Service Layer Organization)

為了應對日益增長的業務複雜度，我們將 `app/services/` 重新組織為三大核心領域，實踐領域驅動設計 (DDD)：

### 3.1 業務領域層 (`app/services/domain/`)
處理與核心業務直接相關的邏輯。
- **`user/`**：整合 `service.py` (頭像與 Profile)、`economy.py` (點數消費)、`progress.py` (XP 獎勵) 與 `activity_logger.py`。
- **`course/`**：包含 `service.py` (課程導出/同步)、`audio.py` (語音生成) 與 `lifecycle.py`。
- **`learning/`**：處理 `lesson_persistence.py` 與教學組件 (`lesson_components/`)。

### 3.2 AI 引擎層 (`app/services/ai_engine/`)
負責 AI 運算與跨模型的抽象封裝。
- **`clients/`**：各種 LLM Provider (Google, LMStudio) 的適配器。
- **`agents/`**：具備特定職能的 AI Agent (Architect, Syllabus, Questionnaire)。
- **`workflows/`**：串聯多個 Agent 的複雜生成流程。
- **`kb/`**：RAG 向量檢索與文件解析引擎。

### 3.3 基礎建設層 (`app/services/infra/`)
非業務性質的技術支撐服務。
- **`files/`**：統一的檔案讀寫與目錄管理服務。
* **`scheduler/`**：管理背景任務的 `jobs` 與 `workers`。
- **`media/`**：媒體資源目錄管理。

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

### 4.2 用戶登入 (`POST /api/v1/auth/login`)
- **Payload 規格**：`{"email": "user@example.com", "password": "SecretPassword123!"}`
- **回應規格**：`{"access_token": "...", "token_type": "bearer"}`

### 4.3 用戶資料與排行榜 (`GET /api/v1/user/profile`, `GET /api/v1/leaderboard`)
- **Profile**：獲取用戶統計數據，包含總學分 (Credits) 與當前 XP 經驗值。
- **Leaderboard**：基於全局 XP 排名的即時數據，支持按時間窗口（每日/每月）篩選。

---

## 📚 5. 課程與生成核心 API (Courses & Generation)

### 5.1 讀取官方公開課程 (`GET /api/v1/courses/public`)
- **描述**：獲取由系統預先錄入且已啟用的官方課程列表。
- **回應範例**：
  ```json
  [
    {"id": 1, "name": "Python 入門", "topic": "Python Fundamentals", "is_official": true}
  ]
  ```

### 5.2 課程大綱生成與 Job 監控
課程生成採用非同步架構，請求後會獲得一個 `job_id`：
- **發起生成 (`POST /api/v1/custom-courses`)**：
  - Payload: `{"topic": "量子力學", "files": [...]}`
  - 回傳: `{"job_id": "job_abc_123", "status": "pending"}`
- **SSE 實時監控 (`GET /api/v1/jobs/{job_id}/stream`)**：
  - **技術原理**：利用 Server-Sent Events 與 FastAPI `StreamingResponse`。
  - **推播格式**：`data: {"step": "planning", "progress": 30, "message": "正在構思課程章節..."}`

### 5.3 課程複製與 Fork (`POST /api/v1/custom-courses/{id}/fork`)
- **描述**：將他人分享的課程完整大綱與節點內容複製一份到自己的帳號下，建立獨立的學習進度。

### 5.4 讀取課程圖片資產 API (`GET /api/v1/courses/files/images/{user_id}/{course_folder}/{filename}`)
- **描述**：用於前端加載學員教材中抽取的實體圖片。此端點會將對應的靜態圖片以二進位流形式回傳。
- **參數說明**：
  - `user_id`: 課程創建者的 User ID。
  - `course_folder`: 課程檔案對應的本地目錄名稱（通常為課程名稱拼音或 UUID 的 slug）。
  - `filename`: 圖片檔案名稱（例如 `p14_img0.png`）。
- **回應類型**：`image/png` | `image/jpeg` | `image/webp` 等圖片串流。

---

## 💬 6. 實時社交與對戰 API (Real-time & Social)

### 6.1 好友與聊天 WebSocket (`WS /api/v1/social/chat/ws`)
- **描述**：全站統一的 WebSocket 入口，處理聊天訊息、好友邀請通知與競技場對決。
- **訊息格式**：
  ```json
  {"type": "chat_message", "payload": {"receiver_id": 456, "content": "你好！"}}
  ```

### 6.2 競技場匹配與對戰
- **加入匹配 (`POST /api/v1/arena/queue/join`)**：傳入 `course_id` 開始匹配對手。
- **戰績回報 (`POST /api/v1/arena/matches/complete`)**：由後端根據 Elo 公式結算積分。

---

## 🎧 7. 語音合成 API

本系統的語音合成邏輯已完整封裝至後端 Service 層，底層通訊與配置詳見：
👉 **[VoxCPM 語音合成微服務專屬指南](./7_voxcpm_microservice.md)**

### 7.1 生成語音 (`POST /api/v1/audio/speech`)
- **描述**：透過 `AudioService` 向微服務請求合成，並自動處理後端快取邏輯。
- **參數規格**：參考微服務指南中的 Payload 定義。

---

## 🛡️ 7. 全站統一回應與錯誤處理 (Response & Errors)

### 7.1 成功回應
所有寫入類 API 統一遵循以下封裝：
```json
{
  "status": "success",
  "message": "Operation completed",
  "data": { ... }
}
```

### 7.2 錯誤回應
當發生業務邏輯錯誤或權限問題時，回傳標準的 HTTPException 格式：
```json
{
  "detail": "餘額不足，無法開啟此關卡",
  "error_code": "INSUFFICIENT_FUNDS",
  "timestamp": "2024-05-09T..."
}
```

| HTTP 狀態碼 | 意義 | 建議處理 |
| :--- | :--- | :--- |
| **401** | Token 過期或無效 | 引導至登入頁面 |
| **402** | 點數餘額不足 | 彈出儲值視窗 |
| **404** | 資源不存在 | 檢查 ID 是否正確 |
| **429** | 觸發速率限制 (Rate Limit) | 提示用戶稍後再試 |
| **500** | AI 微服務連線失敗 | 顯示「伺服器忙碌中」 |

---
