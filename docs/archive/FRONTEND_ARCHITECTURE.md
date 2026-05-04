# 前端架構

這份文件快速描述前端的分層與主要模組位置，方便新同事或外部協作快速定位。

前端目前採用這個分層：

- `src/app/`: route-owned page modules
- `src/components/`: shared UI
- `src/features/`: 跨 route 的完整業務模組
- `src/lib/`: auth / jobs / navigation / API helpers
- `src/stores/app/`: app-global state
- `src/stores/session/`: flow/session state

## 目前主要 page modules

- `src/app/courses/[courseId]/`: 課程內容與進度頁
- `src/app/arena/`: 競技場核心導航頁
- `src/app/arena/match/[matchId]`: 實際對戰競技場（即時同步）
- `src/app/questionnaire/`: 入門探索問卷
- `src/app/leaderboard/`: 全域與賽季排行榜

## 目前保留在 `features/` 的模組

- `src/features/lesson-session/`: lesson player / stage renderer / remedial flow
- `src/features/arena/`: **[核心]** 競技對戰狀態機、配對佇列與 SSE 事件監聽
- `src/features/leaderboard/`: 排行榜數據獲取與 UI 元件
- `src/features/profile/`: shared profile settings dialog
- `src/features/questionnaire/`: questionnaire flow hooks
