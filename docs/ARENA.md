# Arena

這份文件整理 Arena 子系統的本地啟動、管理入口與 demo 資料準備方式。

## Arena 本地初始化

Arena 現在已經依賴額外的 PostgreSQL tables。
如果你拉了最新程式碼但還沒跑 migration，就會看到這類錯誤：

- `relation "public_courses" does not exist`
- `relation "arena_ratings" does not exist`

這不是 API route 壞掉，而是資料庫 schema 還停在 Arena migration 之前。

請在 `backend/` 目錄執行：

```bash
python3.12 -m alembic upgrade head
```

如果想確認 Arena migration 是否已進資料庫，可用：

```bash
python3.12 -m alembic current
python3.12 -m alembic history --verbose
```

你應該至少看到 Arena foundation migration：

```text
9d3c1a4b7ef2_add_arena_foundation.py
```

完成後再啟動後端：

```bash
python3.12 -m uvicorn app.main:app --reload --port 8000
```

## Arena Admin

Arena 管理台路徑：

```text
/admin/arena
```

目前它可管理：

- `PublicCourse`
- `ArenaQuestionPool`
- `ArenaSeason`
- Arena 題目與選項內容
- 玩家比賽紀錄與異常對戰檢視
- Arena 系統健康摘要

Arena 玩家端目前已整合進主產品介面，主要入口是：

- `/home`
  這裡可以直接選官方主題、加入即時競賽、建立私人房、輸入房號加入、查看排行榜摘要與公開主題
- `/profile`
  這裡會顯示 Arena 競技身份，包含 rating、rank tier、勝率、主題強度、近期 rank 變化，以及 season badge / title / placement
- `/arena/leaderboard`
  獨立排行榜頁，提供 season / global 與 rank / win rate / matches 等分類檢視

Arena 玩家端的核心模式目前分成兩種：

- `私人房間`
- `即時競賽隊列`

即時競賽隊列會在相同官方主題下等待對手，成功配對後直接建立正式競賽 match。
舊的 `/arena` 首頁已被收斂，現在會直接導回 `/home`。

目前 Arena 也已具備：

- SSE 重連與狀態恢復
- room / match presence heartbeat
- `player.disconnected` / `player.reconnected` 事件
- 溫和型風控標記，例如 low completion、disconnect instability、suspicious latency pattern
- 管理台健康摘要，用來觀察 queue 壓力、stale matches 與異常活動

對應權限規則：

- 若 `ARENA_ADMIN_EMAILS` 為空，已登入使用者都可進入管理 API
- 若 `ARENA_ADMIN_EMAILS` 有值，只有 email 在 allowlist 內的帳號可使用

## Arena Demo Data

如果你想快速把 Arena 畫面跑起來，而不是手動在 `/admin/arena` 一筆一筆建立內容，可以直接執行 demo seed：

```bash
cd backend
python3.12 -m scripts.seed_arena_demo
```

這個腳本會：

- 建立或更新 3 個可用的 `PublicCourse`
- 為每個主題建立可直接開房的 `ArenaQuestionPool`
- 建立一個 active season
- 幫現有使用者補 Arena rating / topic rating / rank history demo 資料

如果你剛拉下最新版本，記得重新執行 migration，因為 Arena 新增了競賽配對隊列表：

```bash
cd backend
python3.12 -m alembic upgrade head
```
