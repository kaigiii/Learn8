# Learn8 Arena 完整產品與系統設計

## 目前實作狀態

目前 repo 已經不是純設計稿，Arena 已落地出一個可運作的基礎版本，包含：

- `PublicCourse` 與 `ArenaQuestionPool` 資料模型
- private room / room code / lobby / match / result 基礎流程
- season / leaderboard / profile 基礎查詢
- `/admin/arena` 管理者 UI
- Arena admin API 與題池編輯能力

但本地啟動時有一個很重要的前提：

- 必須先跑 Alembic migration，否則 Arena 相關 tables 不會存在

典型錯誤訊號：

- `relation "public_courses" does not exist`
- `relation "arena_ratings" does not exist`

對應處理方式：

```bash
cd backend
python3.12 -m alembic upgrade head
```

如果需要鎖定 Arena 管理台帳號，請在 `backend/.env` 設定：

```text
ARENA_ADMIN_EMAILS=user1@example.com,user2@example.com
```

### 目前仍待完成

以下仍是 Arena 往正式完成態前，最重要但尚未完全落地的部分：

- `2 至 8 人即時競賽`
  目前 competitive queue 仍以 1v1 為主，私人房雖支援多人，但正式多人 competitive 體驗仍未完整打通
- `更完整的房間與對戰 UI`
  房間大廳、對戰畫面、賽後頁已有基礎版本，但 rank badge、連勝提示、分享、rematch 體驗仍可再補強
- `反作弊與營運觀測`
  現在已有 anomaly review、低完成率懲罰、presence / disconnect 事件、健康摘要與自我修復，但更正式的 anti-cheat、告警與背景補償流程仍可再深化
- `season 獎勵與榮譽體系`
  season 基礎管理與 season honor badge / title / placement 已完成，但獎勵發放與更完整的 season 結算規則仍未完成

## 文件定位

這份文件定義 Learn8 未來多人對戰產品 `Arena` 的完成態設計。

它不是 MVP 草案，也不是分階段妥協版。
它描述的是一套正式、完整、可持續維護、可擴充、可支援企業與教育場景的多人競技學習系統。

Arena 的目標不是只做一個答題小遊戲，而是成為 Learn8 產品中的正式子系統，具備：

- 穩定的多人房間系統
- 官方主題即時對戰
- 2 至 8 人同場競技
- 排名與玩家強度體系
- 完整對戰歷史與賽後統計
- 企業級可維護架構

---

## 產品名稱

### 正式名稱

- 對外產品名稱：`Arena`
- 內部技術模組名稱：`arena`

### 命名語意

Arena 在這裡代表：

- 玩家進入對戰場域
- 與他人即時競技
- 在官方主題中比拼理解、速度與穩定度
- 以學習內容為核心，而不是純娛樂亂鬥

### 命名原則

Arena 在未來文件、資料模型、前後端模組中，統一代表：

- 多人競技系統
- 房間與配對體系
- 對戰與排名體系

而單人 lesson 遊玩模組已改名為 `LessonSession`，避免語意衝突。

---

## 產品定位

Arena 是一個建立在 Learn8 官方內容之上的多人學習競技平台。

它的核心價值不是單純「誰答題比較快」，而是：

- 讓使用者透過競技提高投入感
- 讓官方主題內容有更多使用場景
- 讓玩家透過 rank 看見自己的強度變化
- 讓知識競賽本身成為一個可反覆遊玩的產品體驗

Arena 必須同時滿足三種層面：

- 玩家層面：好玩、有挑戰、有成長感
- 產品層面：能提升留存、互動與分享
- 工程層面：穩定、可觀測、可擴充

---

## 核心內容來源

Arena 的對戰內容以平台提供的官方主題為核心。

### 官方主題

Arena 的主題來源不是任意使用者上傳內容，而是系統維護的公版課程。

建議正式概念為：

- `PublicCourse`

定義如下：

- 由系統建立與維護
- 所有使用者可免費學習
- 所有使用者可免費用於 Arena 對戰
- 內容可被版本化、審核、標記難度與對戰適用性

### Arena 可用內容條件

某個 `PublicCourse` 要能進入 Arena，必須具備：

- 已發布
- 已審核
- 題目品質穩定
- 題目難度分布完整
- 題目可被標記知識點
- 題目可被標記模式適用性

### 題目來源策略

Arena 不應直接拿 lesson 原始 stage 毫無處理地上場。
正式版應有一層對戰題池抽象。

建議正式概念為：

- `ArenaQuestionPool`

它負責：

- 從官方主題抽出可競技題目
- 為不同模式組裝題組
- 控制難度分布
- 保證公平性
- 避免同房重複

---

## 核心模式設計

Arena 的核心其實不是多模式集合，而是一個明確的即時知識競賽產品。
它的完成態應更接近「知識王」這類同步答題競賽，而不是 lesson 補救系統的延伸。

## 1. 私人房間模式

### 定義

由房主建立房間，玩家可透過房號或連結加入。

### 核心能力

- 建立房間
- 產生唯一房號
- 私密房 / 可見房
- 房主選模式、主題、回合數、題目配置
- 成員 ready
- 房主開始
- 房主轉移
- 房間解散

### 支援人數

- 2 至 8 人

### 適用場景

- 朋友對戰
- 班級活動
- 企業內部活動
- 私人練習賽

---

## 2. 即時主題競賽模式

### 定義

玩家在官方主題下進行即時同步回合制競賽。
這就是 Arena 的核心模式，同時涵蓋：

- 一般玩家理解的「即時主題對戰」
- 產品入口上的「快速配對」
- 系統結算上的「排位對戰」

也就是說，快速配對、排位對戰、即時主題對戰本質上是同一套東西：

- 即時
- 同題
- 同步倒數
- 伺服器權威結算
- 依結果更新排名

技術命名上若看到 `live_theme`、`quick_match`、`ranked` 這類舊字眼，應視為歷史命名或相容別名；
正式實作應統一收斂到單一核心模式 `competitive`。

### 核心規則

- 所有玩家共同參與同一場比賽
- 每一回合看到同一題
- 有統一倒數
- 提交後鎖答
- 所有人答完或時間到即揭曉
- 更新個人分數與即時排行榜

### 題目結構

- 單題模式
- 多回合模式
- 題目難度逐步提升
- 最終回合可加入高權重題

### 支援人數

- 2 至 8 人

---

## Rank 與玩家強度系統

Arena 必須有正式的 rank 呈現與玩家強度體系。

這不是附加功能，而是 Arena 的核心之一。

## 1. 玩家強度模型

每位玩家都應擁有一套獨立於 Learn8 一般 XP 的 Arena 競技強度資料。

建議概念：

- `ArenaRating`
- `ArenaRank`
- `ArenaSeasonProfile`

### 建議資料維度

- 基礎 rating
- 可視 rank
- 分段階級
- 近期勝率
- 對戰場次
- 各模式強度
- 各主題強度
- 連勝 / 連敗
- 離線 / 逃跑懲罰紀錄

## 2. Rank 顯示

玩家在 Arena 內必須能清楚看到自己的強度。

顯示內容建議包含：

- 當前 rank
- 當前 rating 數值
- 升下一階還差多少
- 最近 10 場戰績
- 本季最佳 rank
- 各主題熟練度

### 建議階級設計

可採用固定分段，例如：

- Bronze
- Silver
- Gold
- Platinum
- Diamond
- Master
- Grandmaster

每個大階可再拆小階：

- Bronze I
- Bronze II
- Bronze III

### 視覺呈現

玩家列表、房間、配對、賽後結果頁都應顯示：

- avatar
- display name
- rank badge
- rating
- 選填稱號

## 3. Rating 計算原則

正式版應採用可擴充 rating 系統，而不是簡單加減分。

評估因子建議：

- 比賽名次
- 對手平均 rating
- 玩家自身 rating
- 人數規模
- 模式權重
- 中途離開懲罰

### 基本原則

- 打贏高 rating 對手，應獲得更多分數
- 打輸低 rating 對手，應扣更多分數
- 多人混戰時，名次越高加分越多
- 私人房可不影響主 rank，正式配對競賽則應影響主 rank

## 4. 入口與 rank 關係

建議分成兩層：

- `Ranked`
- `Casual`

### 即時主題競賽 / 配對入口

- 影響主 rating
- 影響 rank 顯示
- 進入正式排行榜

### 私人房

- 不影響主 rating
- 記錄歷史與表現
- 用於朋友對戰與練習

## 5. 主題強度

除了總 rating，Arena 應支援主題強度。

例如：

- Python 基礎：Gold
- Data Science：Silver
- Product Thinking：Platinum

這有助於：

- 更精準配對
- 更合理推薦主題
- 賽後更清楚指出玩家在哪些主題強、哪些主題弱

---

## 完整玩家體驗

Arena 的完成態體驗應包含以下主要頁面與流程。

## 1. Arena 首頁

Arena 入口已整合進 Learn8 首頁 `/home`，不再維持獨立 `/arena` 首頁。

首頁整合區應提供：

- 進入即時競賽
- 建立房間
- 輸入房號加入
- 查看 rank
- 查看當前賽季
- 查看熱門官方主題
- 查看近期對戰紀錄
- 查看排行榜

## 2. 房間大廳

房間大廳應提供：

- 房號顯示與複製
- 房主資訊
- 參賽成員列表
- 玩家 rank 顯示
- ready 狀態
- 主題選擇
- 回合設定

## 3. 對戰畫面

對戰畫面應提供：

- 倒數計時
- 題目區
- 玩家作答區
- 排名區
- 玩家分數條
- 回合進度
- 對手狀態
- 已提交提示
- rank badge
- 連勝 / 狀態提示

## 4. 賽後結果頁

賽後頁應提供：

- 最終排名
- rating 變化
- rank 升降
- 對戰統計
- 正確率
- 平均反應時間
- rematch
- 分享結果

## 5. 個人競技身份區

Arena 個人競技身份應整合進現有 `/profile`，而不是拆獨立 Arena profile 頁。

應呈現：

- 當前 rank
- rating
- 勝率
- 場次
- 最佳連勝
- 本季統計
- 主要主題強度
- 最近比賽
- 歷史賽季摘要

---

## 與 Learn8 主產品關係

Arena 應與 Learn8 主產品協調，但不是 remedial 系統的一部分。
它的角色更像是官方知識內容的競技化消費場景。

## 整合目標

- 對戰內容來自官方課程
- 官方主題能透過競技被反覆使用
- 玩家可在 Learn8 產品內看到自己的 Arena 競技身份與表現

## 建議整合點

### 1. 題目追溯

每一題都要能追溯到：

- public course
- unit
- node
- knowledge tags

### 2. 學習成長回流

Arena 應影響：

- 玩家對主題的熟悉度
- 主題建議排序
- 學習路徑推薦

### 3. 經濟與獎勵

Arena 可與現有經濟系統整合：

- XP
- credits
- season rewards
- badges
- titles

但 Arena rank 應與一般 XP 分開，不可混為一談。

---

## 完整比賽流程

## 大流程

1. 玩家進入 Arena
   主要從 `/home` 進入
2. 玩家選擇即時競賽、建立房間或加入房間
3. 系統建立 room / match context
4. 玩家確定主題與比賽設定
5. 系統組裝題組與比賽規則
6. 玩家進入對戰
7. 系統逐回合同步題目、倒數、鎖答、揭曉
8. 系統結算分數、名次、rating
9. 顯示賽後摘要
10. 導向 rematch、分享或返回 `/home`

## 回合流程

1. round started
2. broadcast question
3. start server timer
4. receive answers
5. lock answers
6. calculate round scores
7. reveal correct answer
8. update standings
9. advance next round

---

## 架構原則

Arena 必須採用企業級、權責清晰、可觀測的設計。

### 核心原則

- 後端權威狀態
- 前端不負責權威計時與結算
- 所有比賽事件可追蹤
- 所有結果具備冪等性
- 可支援重連、恢復、審計
- 單一核心模式可持續擴充規則與營運能力

### 不採用的方式

正式版不應將核心遊戲邏輯留在：

- `frontend/server`
- 臨時記憶體狀態
- 前端自行決定結果

### 正式設計

- 多人系統放入 `backend/app/services/arena/` 邏輯邊界
- 前端只負責畫面與事件呈現
- 即時層由正式 gateway 控制
- 所有關鍵狀態入庫

---

## 建議檔案結構

### Backend

```text
backend/app/
  api/
    v1/
      endpoints/
        arena.py
        arena_admin.py
        arena_rank.py
  domain/
    arena_statuses.py
    arena_modes.py
    arena_ranks.py
  models/
    public_course.py
    arena_room.py
    arena_match.py
    arena_round.py
    arena_rating.py
    arena_season.py
    arena_question_pool.py
    arena_event.py
    arena_queue.py
  schemas/
    arena_schema.py
    arena_room_schema.py
    arena_match_schema.py
    arena_competitive_schema.py
    arena_admin_schema.py
    arena_resume_schema.py
  services/
    arena/
      room_service.py
      competitive_service.py
      topic_catalog_service.py
      question_pool_service.py
      rank_service.py
      rating_service.py
      round_engine.py
      realtime_gateway.py
      telemetry_service.py
      admin_service.py
```

### Frontend

```text
frontend/src/
  app/
    (dashboard)/
      home/
        page.tsx
      profile/
        page.tsx
      arena/
        page.tsx
        leaderboard/page.tsx
        queue/page.tsx
        lobby/[roomCode]/page.tsx
        match/[matchId]/page.tsx
        result/[matchId]/page.tsx
  features/
    arena/
      ArenaLobbyPageClient.tsx
      ArenaMatchPageClient.tsx
      ArenaResultPageClient.tsx
      ArenaLeaderboardPageClient.tsx
      ArenaQueuePageClient.tsx
      ArenaAdminPageClient.tsx
      components/
      hooks/
  lib/
    arena/
      api.ts
      realtimeClient.ts
      rankPresentation.ts
  stores/
    arena/
      useArenaLobbyStore.ts
      useArenaMatchStore.ts
```

---

## 後端模組責任

## `arena.py`

負責：

- 建立房間
- 加入房間
- 離開房間
- ready
- 啟動比賽
- 取得房間狀態
- 取得比賽摘要

## `arena_rank.py`

負責：

- 取得玩家 rank
- 取得排行榜
- 取得賽季資料
- 取得 rating 歷史

## `arena_admin.py`

負責：

- 官方主題管理
- 對戰池啟用/停用
- 賽季管理
- 玩家比賽紀錄
- 異常對戰檢視

## `room_service.py`

負責：

- 房間建立
- 房主控制
- 房號管理
- 成員管理
- 房間狀態轉換

## `competitive_service.py`

負責：

- 即時配對
- rank 區間配對
- 重複對手保護
- 等待時間放寬配對區間

## `question_pool_service.py`

負責：

- 對戰題池生成
- 難度平衡
- 題目順序
- 公平性與去重

## `round_engine.py`

負責：

- 回合時序控制
- 廣播事件
- 鎖答
- 揭曉
- 轉場

這是 Arena 的核心引擎。

## `rating_service.py`

負責：

- rating 計算
- rank 升降
- 主題 rating 更新
- 中離 / 低完成率懲罰
- upset / expected outcome 調整

## `anti_cheat_service.py`

負責：

- 異常提交檢測
- 不合理延遲與腳本判定
- 重複封包處理
- 風險標記

---

## 資料模型

## `public_course`

儲存：

- 官方主題資訊
- 發布狀態
- Arena 啟用狀態
- 難度分級
- 標籤

## `arena_room`

儲存：

- room code
- host user id
- mode
- topic id
- visibility
- max players
- room status

## `arena_room_player`

儲存：

- room membership
- ready state
- join timestamp

## `arena_match`

儲存：

- 對戰主資訊
- room snapshot
- mode
- topic
- rules snapshot
- start/end time
- final standings

## `arena_match_player`

儲存：

- 該玩家在該 match 的結果
- final rank
- score
- accuracy
- avg response time
- rating delta

## `arena_round`

儲存：

- round index
- question id
- timer config
- reveal data

## `arena_answer`

儲存：

- player answer
- submit timestamp
- correctness
- awarded score
- latency metadata

## `arena_rating`

儲存：

- 玩家主 rating
- 當前 rank
- 累積勝敗與 ranked 場次

## `arena_player_topic_rating`

儲存：

- 玩家在各主題的強度
- 主題 rating
- 主題 rank

## `arena_rank_history`

儲存：

- 每場 rating 變動
- 升階 / 降階事件
- 賽季切換紀錄

## `arena_season`

儲存：

- season id
- start/end time
- leaderboard config
- reward config

---

## 即時事件契約

Arena 即時通訊應採用正式事件契約。

建議事件：

- `room.created`
- `room.updated`
- `room.player_joined`
- `room.player_left`
- `room.player_ready_changed`
- `room.host_changed`
- `match.started`
- `round.started`
- `round.tick`
- `round.answer_received`
- `round.answer_locked`
- `round.revealed`
- `standings.updated`
- `match.finished`
- `rank.updated`
- `player.disconnected`
- `player.reconnected`
- `room.closed`

所有事件都應具備：

- version
- event id
- timestamp
- match id / room id
- actor id
- payload

---

## 企業級非功能需求

Arena 必須滿足以下要求：

- 後端權威狀態
- 完整審計紀錄
- 冪等化結算
- 重連恢復
- 伺服器端計時
- 穩定事件契約
- 監控與告警
- 風控與反作弊
- 管理後台可追蹤
- season 與 rank 可維運

### 關鍵 edge cases

- 玩家中途離線
- 玩家重連回房
- 房主離開
- 多人同時提交
- 重複封包
- 比賽重複結算
- 排名更新失敗補償
- 房間殘留清理

---

## 管理與營運能力

Arena 正式版應具備營運後台能力。

### 必須支援

- 啟用 / 停用官方主題
- 管理題池
- 管理賽季
- 查看排行榜
- 查看異常對戰
- 查詢玩家比賽紀錄
- 處理檢舉與懲罰

---

## 最終完成態

當 Arena 完成時，使用者能夠：

- 看到自己的正式 rank 與 rating
- 建立私人房間與朋友對戰
- 參加官方主題即時對戰
- 在 2 至 8 人中競爭排名
- 透過配對入口直接進入正式排位競賽
- 在賽後看到 rating 升降、主題強弱與統計摘要

而工程上，Arena 會是一套：

- 正式獨立的領域模組
- 可擴充的多人引擎
- 可營運的產品系統
- 可支撐企業與教育使用場景的正式平台
