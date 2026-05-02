# 好友與群組系統設計提案 (Friends & Groups Proposal)

本提案旨在為 **Learn8** 專案擴充「好友」與「群組」功能，並於上方導航欄提供專屬入口。此系統不僅能促進平台社交互動，更能與 **Arena (競技場)** 子系統深度交集，提升多人連線與即時對抗的趣味性。

---

## 1. 背景與目標

為打造具黏著度的學習生態，本專案將引入好友與群組功能。使用者將能夠：
- **好友系統**：互加好友、觀察好友在線狀態、一鍵發送競技場對戰邀請。
- **群組系統**：建立學習與競技小隊、查看群組內排行榜、一同進行群組對抗賽。
- **進入點**：規劃於導航欄 (`TopStatsBar`) 新增社交入口圖標，點擊後展開社交儀表板或側邊欄。

---

## 2. 導覽列入口設計 (Navigation Design)

### 2.1 導航欄快速連結
在前端導航欄組件 [TopStatsBar.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/components/layout/TopStatsBar.tsx) 的 `quickLinks` 屬性中新增 **Social** 入口：

```tsx
// 在 TopStatsBar 的 quickLinks 中新增：
{
  href: "/social",
  label: "Social",
  iconSrc: "/svg/social-friends.svg", // 新增社交圖示
  iconAlt: "Friends and Groups",
}
```

### 2.2 前端路由架構 `/social`
點擊導航欄圖標後，引導至 `/social`（或於側邊抽屜式 Drawer 顯示），介面將分為兩個分頁：
- **好友分頁 (Friends)**：
  - 好友列表（顯示在線/離線、目前段位）。
  - 好友邀請（發送中、待接受、封鎖名單）。
- **群組分頁 (Groups)**：
  - 我加入的群組。
  - 群組建立與加入（透過群組代碼）。

---

## 3. 好友系統設計 (Friends System Design)

好友系統採用「雙向確認」機制。使用者 A 發送好友邀請給 B，B 接受後正式建立好友關係。

### 3.1 資料模型 (Backend SQLAlchemy Models)

```python
# app/models/friend.py
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.db.base import Base
import enum

class FriendStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    BLOCKED = "blocked"

class FriendModel(Base):
    __tablename__ = "friends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default=FriendStatus.PENDING, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 3.2 核心功能
- **發送好友邀請**：透過使用者 Email 或 ID 發出。
- **接受/拒絕邀請**：接受後生成雙向或單向確認記錄。
- **在線狀態推播**：基於現有 Arena 的 Presence Heartbeat 機制，記錄使用者最後活躍時間，推播給好友。

---

## 4. 群組系統設計 (Groups System Design)

群組系統允許使用者建立自己的學習與競技團隊（例如：團隊讀書會、學校班級、戰隊）。

### 4.1 資料模型 (Backend SQLAlchemy Models)

```python
# app/models/group.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.db.base import Base

class GroupModel(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    invite_code = Column(String(12), unique=True, index=True, nullable=False) # 例如：L8-ABCD-1234
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GroupMemberModel(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 4.2 核心功能
- **建立群組**：自動生成專屬邀請碼。
- **加入群組**：輸入邀請碼一鍵加入。
- **成員管理**：群主（Owner）可移除成員、委派管理員。

---

## 5. 與 Arena (競技對戰系統) 的交集設計

這是本提案的核心特色，將社交生態與現有 Arena 子系統緊密綁定，並**完全基於現有的對戰機制**進行擴充。

### 5.1 使用現有競技場邀請畫面 (Utilize Existing Invite Screen)
- **當前機制**：現有 [ARENA.md](file:///Users/kaigiii/Coding/Learn8/docs/ARENA.md) 中，玩家可以創建私人對戰房並產生一組邀請連結與邀請畫面。
- **社交交集**：
  - 當使用者點擊好友或群組成員旁的 **「邀請挑戰 (Challenge)」** 按鈕時，系統直接呼叫現有的 Arena 私人房間 API。
  - 後端為該好友生成一條 SSE 通知。好友點擊通知後，直接進入**現有的對戰邀請與準備畫面**。
  - **好處**：完全不需開發新的對戰模式或重新設計遊戲迴圈，無縫重用現有機制與現成的邀請組件。

### 5.2 社交排行榜 (Social Leaderboard & Group Ranking)
- **當前機制**：Arena 提供全服賽季積分排行 (`ArenaRating`)。
- **社交交集**：
  - **好友排行榜**：篩選出僅限好友的 Arena 排名，玩家可以觀察與好友間的技術差距。
  - **群組排行榜**：在群組內顯示「群組成員積分排名」，可用於組內內部切磋。

---

## 6. API 設計與路由 (Proposed API Endpoints)

為保持專案結構一致，好友與群組 API 應建立在 `backend/app/api/v1/endpoints/`：

### 6.1 好友 API 端點 (`/api/v1/social/friends`)
- `GET /api/v1/social/friends` - 獲取好友列表與其 Arena 評分與在線狀態。
- `POST /api/v1/social/friends/invite` - 發送好友邀請。
- `POST /api/v1/social/friends/respond` - 接受/拒絕邀請。
- `DELETE /api/v1/social/friends/{friend_id}` - 刪除好友 / 解除關係。

### 6.2 群組 API 端點 (`/api/v1/social/groups`)
- `GET /api/v1/social/groups` - 獲取我加入的所有群組。
- `POST /api/v1/social/groups` - 建立新群組。
- `POST /api/v1/social/groups/join` - 輸入 `invite_code` 加入群組。
- `GET /api/v1/social/groups/{group_id}/leaderboard` - 獲取群組成員的 Arena 積分排行。

---

## 7. 前端介面規劃 (Frontend UI Planning)

### 7.1 首頁與導覽列入口
- 在 [TopStatsBar.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/components/layout/TopStatsBar.tsx) 的右側頂部，💎 旁邊新增 👥 **Social** 按鈕，顯示一個紅色圓點（Badge）提示未處理的好友邀請或群組邀請。

### 7.2 社交中心專屬頁面 (`/social`)
- **左側邊欄**：好友與群組切換。
- **主視窗內容**：
  - **好友面板**：精美呈現每位好友的 Avatar、在線狀態、Arena 當前等級，並附帶「一鍵邀請 ⚔️」與「發送訊息 💬」按鈕。
  - **群組面板**：顯示群組資訊、戰隊成就、組內排行榜。

---

## 8. 分階段實作建議

建議採用漸進式迭代，確保系統的高穩定度與代碼品質：

### 第一階段：社交基礎設施與導航欄連接
1. 建立 `FriendModel` 與 `GroupModel` 的數據庫遷移（SQLAlchemy + Alembic）。
2. 在 [TopStatsBar.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/components/layout/TopStatsBar.tsx) 加上社交按鈕。
3. 實作基礎 API（發送好友邀請、建立群組、獲取列表）。

### 第二階段：Arena 社交整合
1. 實作「一鍵邀請好友」功能，直接連結現有的 Arena 私人對戰邀請與準備畫面。
2. 結合 SSE 推播，讓好友可快速點擊彈出的對戰邀請通知並進入房間。
3. 新增好友與群組成員的 `ArenaRating` 篩選排行榜 API。

