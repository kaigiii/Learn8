# 後端架構

這份文件總覽後端分層與主要模組，作為維護與擴充的快速入口。

## 目錄分層 (Directory Layers)

後端主幹位於 `backend/app/`，採用「核心共用 + 領域分組」的結構：

- `api/`: 全域共享的 API Router（如 Auth, Courses, Lessons）。
- `arena/`: **[核心模組]** 多人競技子系統，擁有獨立的 `api/`, `models/`, `services/`, `domain/`。
- `core/`: 系統核心設定、安全性、共享異常處理、Lifespan 管理。
- `db/`: 數據庫連接、Session、模型註冊中心。
- `domain/`: 全域業務狀態列舉與常數。
- `models/`: 全域數據模型（User, Course, Lesson, Job）。
- `schemas/`: 全域 Pydantic 驗證模型。
- `services/`: 核心業務邏輯空間：
  - `ai_agents/`: Prompt 編排與 AI 代理。
  - `commons/`: 跨模組共享服務（如 XP 系統、活動日誌、Lifecycle）。
  - `knowledge_base/`: RAG 引擎與文件解析。
  - `workers/`: 背景任務執行器。
  - `workflows/`: 高階業務工作流（如 Syllabus 生成）。

## API 模組分布

目前的 API 端點模組分布如下：

### 全域服務
- `auth`: 登入與權限。
- `courses` & `syllabus`: 課程管理與大綱生成。
- `lessons`: 互動式課堂。
- `jobs`: 背景任務異步進度追蹤。

### Arena 專屬空間
- `arena`: 私人房間、對戰初始化與即時事件串流。
- `arena_rank`: 玩家積分、排名、賽季紀錄與英雄榜。
- `arena_admin`: 管理後台、題池維修與數據監控。

## 技術設計原則

1. **模組化封裝**：較大的子系統（如 Arena）應擁有獨立的目錄，封閉其內部的 Model 與 Service。
2. **服務化設計**：Controller (API) 只負責 Request/Response，核心邏輯應封裝在 Service 中。
3. **狀態與真相 (SSOT)**：所有關鍵進度與排名均由後端數據庫持久化，SSE 僅作為狀態同步的通知管道。
