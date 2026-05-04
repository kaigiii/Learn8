# Arena (競技對戰系統)

這份文件整理 Arena 子系統的架構、玩家快照機制、獎勵發放邏輯與維運說明。

## Arena 本地初始化

Arena 現在已經依賴額外的 PostgreSQL tables。
如果你拉了最新程式碼但還沒跑 migration，就會看到這類錯誤：

- `relation "arena_matches" does not exist`
- `relation "arena_ratings" does not exist`

### 快速初始化 (推薦)
如果你想獲得一個完全乾淨且同步最新 Schema 的開發環境，請在 `backend/` 目錄執行：

```bash
python3.12 -m scripts.full_reset_db
```

### 手動遷移
如果只想更新 Schema 而不清除現有資料：

```bash
python3.12 -m alembic upgrade head
```

---

## 核心機制 (Core Mechanisms)

### 1. 玩家快照機制 (Player Profile Snapshot)
為了確保比賽紀錄的歷史準確性（例如玩家改名或等級變動後，舊比賽紀錄不應隨之改變），Arena 實作了「快照化」儲存：
- **存儲位置**：`ArenaRoomPlayerModel` 與 `ArenaMatchPlayerModel` 中的 `user_snapshot_json` 欄位。
- **時機**：當使用者加入私人房或競技配對成功時，系統會立即拍攝當時的 `name`, `avatar`, `level`。
- **優點**：前端顯示排名與狀態時直接讀取快照，不再需要關聯查詢 `UserModel`，大幅提升讀取效能並保證歷史一致性。

### 2. 事件驅動獎勵系統 (Event-Driven Rewards)
Arena 的獎勵發放（XP/積分）採用「非同步＋行級鎖」機制以確保 **Exactly-Once (精確一次)** 處理：
- **機制**：對戰結束後，系統會標記 `reward_awarded_at`。
- ** Exactly-Once**：透過數據庫行級鎖 (`FOR UPDATE SKIP LOCKED`) 防止多個 Worker 同時重複發放同一場比賽的獎勵。
- **異步處理**：獎勵計算不會阻塞主遊戲迴圈，提升系統吞吐量。

---

## Arena 系統構成

目前 Arena 以獨立模組形式封裝在 `backend/app/arena/`：

- **API 層** (`app/arena/api/`)：
  - `arena.py`: 玩家核心對戰（Room, Match, SSE Stream）。
  - `arena_rank.py`: 排行榜、賽季與個人競技檔案。
  - `arena_admin.py`: 題池管理與系統監控。
- **服務層** (`app/arena/services/`)：
  - `round_engine.py`: 負責回合判定、計時與狀態機。
  - `room_service.py`: 私人房間生命週期。
  - `competitive_service.py`: 系統自動配對 (Queue) 與對戰初始化。
- **模型層** (`app/arena/models/`)：專屬的對戰與競技數據模型。

---

## 多人即時同步

目前的技術設計：
- **SSE (Server-Sent Events)**: 用於即時狀態推播（玩家加入、倒數計時、結果公佈）。
- **Presence Heartbeat**: 每個玩家每 3-5 秒會發送一次 Presence 訊息，後端以此判定玩家是否在線。
- **自動狀態恢復**: 玩家斷線重連後，前端會向後端請求 `SYNC` 事件，立即同步目前回合的最新狀態。

---

## 管理入口

Arena 管理台預設路徑：`/admin/arena`

目前可管理：
- `PublicCourse` (官方主題)
- `ArenaQuestionPool` (各主題題池)
- `ArenaSeason` (賽季設定)
- 玩家舉報與異常對戰審核
