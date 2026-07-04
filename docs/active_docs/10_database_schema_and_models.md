# 🗄️ 資料庫架構與核心模型規格 (Database Schema & Models)

本文件是 Learn8 的數據靈魂手冊，詳細定義了所有核心資料表的結構、欄位用途、關卡邏輯以及經濟系統的數據模型。

---

## 👤 1. 使用者與安全性層 (User & Security)

### 1.1 `users` (核心用戶表)
- **`email`**: 唯一鍵，作為登入帳號。
- **`hashed_password`**: PBKDF2 加密後的字串。
- **`xp` / `level`**: 用戶的成長指標，由 `progress_service` 維護。
- **`credits`**: 當前學分餘額。
- **`avatar_path`**: 存放於 `data/uploads/avatar/` 的實體路徑。

### 1.2 `user_ledger_events` (帳本交易表)
- **`event_type`**: 交易類型（`TOP_UP`, `SPEND`, `XP_AWARD`）。
- **`amount`**: 異動數量。
- **`balance_after`**: 交易後的餘額快照，用於審計。
- **`idempotency_key`**: 冪等性密鑰，防止重覆扣款。

---

## 📚 2. 課程與生成層 (Course & Generation)

### 2.1 `courses` (學習課程表)
- **`syllabus_json`**: 儲存 AI 生成的完整大綱結構（包含 Unit 與 Node 的層次關係）。
- **`profile_json`**: 存儲問卷分析後得到的 `Learner Profile Summary`。
- **`status`**: `draft` | `generating` | `completed` | `approved` (已發佈)。

### 2.2 `lessons` (單元節點表)
- **`course_id`**: 外鍵，連結所屬課程。
- **`stages`**: JSONB 陣列，存儲該節點的所有組件關卡數據（包含 `MultipleChoice` 等配置）。
- **`status`**: `locked` (鎖定) | `available` (待解鎖) | `completed` (已完成)。

### 2.3 `course_media_assets` (課程媒體圖片資產表)
- **`user_id`**: 外鍵，連結所屬使用者。
- **`course_id`**: 外鍵，連結所屬課程。
- **`source_filename`**: 上傳的原始教材檔名（例如 `導師教學手冊圍棋.pdf`）。
- **`asset_type`**: 資產類型（例如 `image`）。
- **`asset_filename`**: 本機儲存的圖片檔案名稱（例如 `p14_img0.png`）。
- **`asset_url`**: 前端加載圖片的 API 路由端點（例如 `/api/v1/courses/files/images/...`）。
- **`description`**: 圖片詳細文字描述（Alt text），由 VLM 提取，並在講義生成時作為 AI 選圖依據。
- **`page_number`**: 本圖片源自原始文檔的頁碼（1-indexed）。
- **`asset_index`**: 本圖片在該頁面的出現順序索引（0-indexed）。

---

## ⚔️ 3. 競技場層 (Arena System)

### 3.1 `arena_rooms` (對戰房間)
- **`room_code`**: 唯一隨機字串（6-12位）。
- **`status`**: `lobby` | `ongoing` | `finished` | `cancelled`。
- **`host_user_id`**: 房主 ID。
- **`players`**: 關聯至 `arena_room_players` 的多人狀態。
- **`round_count` / `round_time_seconds`**: 房間對戰規則配置。

### 3.2 `arena_ratings` (Elo 實力評等)
- **`user_id`**: 學員 ID。
- **`rating`**: 數值（預設 1000），全站統一的 Elo 實力水平。
- **`rank_tier`**: 根據 rating 分配的段位（Bronze, Silver, Gold...）。
- **`wins` / `losses` / `draws`**: 戰績統計。

---

## 🧩 4. 系統配置與任務層 (Config & Jobs)

### 4.1 `generation_jobs` (背景任務表)
- **`job_type`**: `syllabus` | `lesson` | `questionnaire`。
- **`status`**: `pending` | `running` | `completed` | `failed`。
- **`result_data`**: 任務執行成功後產出的 JSON 數據。

### 4.2 `arena_question_pool` (題庫池)
- **`questions`**: JSONB 儲存所有對戰題目。
- **`version`**: 版本號，用於大綱更新後同步題庫。

---

## 📊 5. 數據關聯地圖 (ER Map Summary)

- **User** -> **LedgerEvents** (1:N)
- **User** -> **CourseMediaAssets** (1:N)
- **Course** -> **Lessons** (1:N)
- **Course** -> **CourseMediaAssets** (1:N)
- **Course** -> **PublicCourse** (1:1)
- **ArenaRoom** -> **ArenaRoomPlayers** (1:N)
- **ArenaMatch** -> **ArenaMatchPlayers** (1:N)
- **Friend** -> **ChatMessages** (1:N)
