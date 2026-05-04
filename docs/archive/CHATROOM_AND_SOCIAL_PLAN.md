# 💬 好友與群組聊天室 (Friends & Groups Chatroom) 設計提案

本文件規劃如何在現有的 `/social` 社交頁面中，加入即時通訊聊天室功能，讓好友與群組成員能夠實時文字交流、討論課程並一鍵對戰。

---

## 🏗️ 1. 社交頁面 `/social` 介面重構與設計

我們決定將課程分享邀請通知放在 `/social` 社交主頁。為了整合聊天室，建議採用雙欄式或三欄式佈局（類似 Discord / LINE 的專業設計）：

```
+-----------------------------------------------------------------------------------+
|  👥 社交中心 (Social Center)                                                      |
+-----------------------------------------------------------------------------------+
|  (左欄) 好友與群組列表                |  (右欄) 聊天室主畫面 & 課程通知             |
|                                      |                                           |
|  * 待處理課程分享與好友邀請 (N)       |  對象: 🔥 Python 高手討論群組              |
|  +--------------------------------+  |  +-------------------------------------+  |
|  | [📢 課程分享: 小明 -> Python]  |  |  [小明]: 大家加油！                     |  |
|  |   [接受匯入]  [婉拒]            |  |  [小華]: 這個關卡超好玩！               |  |
|  +--------------------------------+  |  [系統]: 小明分享了課程：【Python 實戰】|  |
|                                      |  |          +----------------------------+ |  |
|  * 我的好友                          |  |          | 📚 Python 實戰             | |  |
|    - [🟢] 小明                       |  |          | [一鍵接受並匯入個人書架]   | |  |
|    - [⚪] 小華                       |  |          +----------------------------+ |  |
|                                      |  |                                         |  |
|  * 我的群組                          |  |  [📎 📤 分享課程] [ 請輸入文字...  ] [發送] |  |
|    - [👥] Python 高手討論群組 (3)    |  |                                         |  |
+--------------------------------------+-------------------------------------------+
```

### 1.1 左欄：好友/群組與通知區
- **通知卡片**：將未處理的好友邀請與課程分享邀請置頂顯示，並提供「接受匯入/婉拒」按鈕。
- **未讀點連動**：當有未讀的聊天室訊息時，好友或群組名稱右方顯示數字或紅色提示點。

### 1.2 右欄：動態聊天室視窗
- 預設顯示「請選擇一個好友或群組開始聊天」。
- 選定聊天對象後，加載該聊天室的歷史訊息與輸入框。
- 輸入框旁設有 **「📤 分享課程」** 按鈕，點擊後會發送帶有課程卡片的特殊訊息，其他成員在右側視窗中可以直接點擊「一鍵接受並匯入個人書架」。

---

## 💾 2. 後端聊天室資料庫設計

為了支援 1 對 1（好友）和 1 對多（群組）的聊天需求，我們設計一個通用的聊天訊息表：

```python
# app/models/chat_message.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.base import Base

class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 私聊時填入 recipient_id；群聊時填入 group_id
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # 訊息類型：'text' (一般文字) 或 'course_share' (課程名片訊息)
    message_type = Column(String(20), default="text", nullable=False)
    
    # 儲存訊息主體文字，若是 'course_share' 則儲存課程的 JSON 資料
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
```

---

## 🔄 3. 即時通訊技術方案

為實現聊天室的流暢通訊，我們建議採用 **WebSocket** 方案，並複用專案中現有的即時對戰機制：

### 3.1 WebSocket 即時通訊與分頁讀取
1. 當使用者進入 `/social` 頁面時，前端建立一個 WebSocket 連線：
   - `ws://localhost:8000/api/v1/social/ws/chat`
2. 為避免負載過大，歷史訊息採用游標分頁（Cursor-Based Pagination）。

---

## 🛠️ 4. API 設計與路由 (`/api/v1/social/chat`)

為維持專案結構一致，新增以下端點：
- `GET /api/v1/social/chat/friends/{friend_id}?limit=50&before_id=X` - 獲取與特定好友的歷史訊息。
- `GET /api/v1/social/chat/groups/{group_id}?limit=50&before_id=X` - 獲取群組內的歷史訊息。
- `WS /api/v1/social/ws/chat` - 聊天室 WebSocket 主連線。
