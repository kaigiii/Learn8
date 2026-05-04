# 🛠️ 自製與自訂課程流程指南 (Maximum Detail Edition)

本文件詳細說明在 Learn8 中，使用者如何自訂設計個人化課程、將其分享到好友與群組進行學習交流，以及審核通過後轉為全站公開自建課程的完整代碼與檔案流。

---

## 💥 1. 自製課程之架構亮點與特色 (Core Highlights)

Learn8 的自製課程系統具備以下卓越架構亮點：
- **獨立沙盒進度模型 (Fork/Sandbox Architecture)**：學員之間可以自由一鍵分享、一鍵 Fork 課程。Fork 時系統不會引用相同的課程實體，而是進行完整大綱解構複製，為每位學員建立專屬的課程與進度空間，保障答題的隱私性與完整性。
- **全站自建課程發佈與審核**：自建課程通過發佈與審核後，系統會無縫將大綱資料轉化並備份至獨立的 **`backend/data/custom_published_courses/`** 資料夾中。同時資料庫生成全新的 `PublicCourseModel` 與 `ArenaQuestionPoolModel`，直接推廣給全體學員學習和競技 PK。

---

## 🎨 2. 自訂課程生命週期 (Course Creation to Execution)

自訂課程的生命週期主要由 4 個階段構成：

### 2.1 大綱生成與配置
- **建立請求**：當學員透過介面提供文字主題，或透過 `RAGEngine` 上傳教材檔案後，呼叫 `POST /api/v1/custom-courses`。
- **資料庫初始值**：建立一個新的 `CourseModel` 實體。
- **背景任務**：非同步任務會為此課程發起多單元的學習大綱規劃，寫入 `syllabus_json` 欄位。

### 2.2 無 AI 干預的直接答題體驗
- 自建課程點擊進入關卡後，前端會直接提取大綱內已設計好的 5 個經典題型組件（`ExplainerMedia`, `FeynmanMirror`, `MatchingPairs`, `MultipleChoice`, `Ordering`），提供極致順滑的通關答題體驗。

---

## 💬 3. 社群推廣與好友匯入 (Fork and Sharing)

### 3.1 課程分享
- 點擊分享按鈕後，前台呼叫：`POST /api/v1/social/sharing`。

### 3.2 課程匯入 (Forking)
- 好友可點擊「**Import Course**」按鈕，觸發前端調用 `POST /api/v1/custom-courses/{course_id}/fork` API。
- 後端接獲請求後，複製原始課程大綱，為該好友建立全新的 `CourseModel`。

---

## 🌐 4. 轉化為全站自建課程 (Publishing Architecture)

### 4.1 上架申請與轉換 (`POST /api/v1/custom-courses/{id}/publish`)
1. 提交審核：後端會將該課程實體的 `is_published` 設為 `True`，`status` 改為 `approved`。
2. YAML 資料持久化與歸檔：
   - 輸出的 YAML 檔案將被儲存於獨立的備份目錄中：**`backend/data/custom_published_courses/`**。
   - 同步寫入全新的 **`PublicCourseModel`**。

### 4.2 競技場開通
- 完備該課程的 `PublicCourseModel` 後，系統會自動在 `ArenaQuestionPoolModel` 中為其建立一組競技場專屬題庫。
- 此課程正式開放給全體用戶學習與競技。
