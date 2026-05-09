# 🤝 社交、好友與實時連線系統 (Social & Real-time System)

本文件詳細剖析 Learn8 的社交層架構，涵蓋了好友關係管理、實時訊息推播、以及基於 WebSocket 的多人在線狀態維護。

---

## 💥 1. 社交系統架構亮點

- **統一 WebSocket 通訊網關 (Unified WS Gateway)**：全站僅使用一個 `/ws` 端點，透過訊息類型 (Type) 分發處理聊天、通知與對戰邀請。
- **異步通知佇列**：利用 FastAPI 的 `BackgroundTasks`，在好友請求發出後立即推播 SSE 或 WS 通知。
- **好友課程共享 (Course Forking Social)**：社交系統與課程系統深度綁定，支持「一鍵複製好友進度」功能。

---

## 🏗️ 2. 好友關係生命週期 (Friendship Lifecycle)

### 2.1 發送與接受請求
1.  **發送請求 (`POST /api/v1/social/friends/request`)**：
    - 建立 `FriendModel` 記錄，狀態為 `pending`。
2.  **實時通知**：被請求方會收到一條 `type: friend_request` 的 WS 訊息。
3.  **接受請求 (`POST /api/v1/social/friends/accept`)**：
    - 將狀態更新為 `accepted`。
    - 系統自動建立雙向聊天頻道。

### 2.2 好友動態監控 (`stream-invites`)
後端提供了一個專屬端點來監控好友的對戰邀請：
- **`GET /api/v1/social/friends/stream-invites`**：
    - 返回 SSE 流。
    - 當好友加入競技場並邀請您 PK 時，此處會立即推播。

---

## 💬 3. 聊天室技術細節 (Chat & Messaging)

### 3.1 訊息存儲與分發
- **持久化**：所有聊天訊息皆存儲於 `chat_messages` 資料表，支持歷史訊息分頁查詢。
- **分發邏輯**：
    - 訊息進入 WS 後，`ConnectionManager` 會查找對方的 `client_id`。
    - 如果對方在線，立即推送。
    - 如果對方離線，存儲為「未讀」，待下次上線後提醒。

---

## ⚔️ 4. 對戰邀請與房間跳轉邏輯

社交系統是競技場的入口之一：
1.  **發起邀請**：學員 A 在聊天室選擇「邀請對戰」。
2.  **建立預備房間**：建立 `ArenaRoomModel` 但狀態為 `initializing`。
3.  **確認跳轉**：學員 B 點擊接受後，雙方 WS 會同時收到 `room_ready` 訊息，前端自動導向至 `/arena/match/{room_id}`。

---

## 📊 5. 實時在線狀態管理 (Presence Management)

- **在線池**：後端在記憶體 (或 Redis) 中維護 `active_connections`。
- **心跳檢測**：客戶端每 30 秒發送一次 `ping`，若超過 90 秒未收到回應，系統自動將其設為「離線」。
