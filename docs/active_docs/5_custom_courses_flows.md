# 🛠️ 自製與自訂課程流程指南 (Maximum Detail Edition)

本文檔詳細說明在 Learn8 中，使用者如何自訂設計個人化課程、將其分享到好友與群組，以及轉化為全站公開課程的完整路徑。這是一套旨在鼓勵**知識創作與社群共享**的內容管理系統。

---

## 🌟 0. 產品價值與 UX 亮點 (Product Value)

自製課程系統賦予了學員從「消費者」轉變為「知識建築師」的能力：

- **知識共享經濟 (Knowledge Sharing Economy)**：透過一鍵分享與 Fork，學員可以基於前人的肩膀進行二次創作。這不僅是數據的複製，更是智慧的傳遞與演進。
- **克隆即學習 (Clone-to-Learn)**：Fork 功能讓學員可以將心儀的課程「搬回家」並根據自己的步調修改。這種「沙盒式」的學習環境消除了犯錯的恐懼，鼓勵大膽探索。
- **成就感與影響力 (Creator Impact)**：當學員自訂的課程通過審核發佈至公開目錄時，將會獲得全站推薦，建立個人的專業品牌與成就感。

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
- 自建課程點擊進入關卡後，前端會直接提取大綱內已設計好的學習組件序列（如 `ExplainerMedia`, `MultipleChoice` 等），提供極致順滑的通關答題體驗。組件數量與類型完全取決於大綱設計，具備高度靈活性。

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
1. **狀態遷移**：後端會將該課程實體的 `is_published` 設為 `True`，`status` 從 `completed` 轉變為 `pending_review`。
2. **管理員審核**：經由管理後台審核通過後，觸發正式發佈。
3. **YAML 資料持久化與歸檔**：
   - 輸出的 YAML 檔案將被儲存於獨立的備份目錄中：**`backend/data/custom_published_courses/`**。
   - 同步寫入全新的 **`PublicCourseModel`**，並將原本的個人課程狀態改為 `approved`。

### 4.2 競技場開通
- 完備該課程的 `PublicCourseModel` 後，管理員可進入競技場控制台。
- 透過「一鍵提取題目」功能（`extract_questions_from_syllabus`），從大綱中自動生成 `ArenaQuestionPoolModel` 題庫。
- 此課程正式開放給全體用戶學習與競技。
