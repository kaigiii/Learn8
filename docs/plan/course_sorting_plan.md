# 課程庫排序調整計劃 (最後操作最前/最左)

此計劃調整課程庫排序邏輯，將最後操作（更新、創建、上傳文件、開始或完成課程單元）的課程排在最左邊，且移除過去將 draft 強制放在最前方的限制。

## 修改檔案清單 (Files to be Modified)

- **[courses.py (後端)](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/courses.py)**
- **[lessons.py (後端)](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/lessons.py)**
- **[course_loader.py (後端)](file:///Users/kaigiii/Coding/Learn8/backend/app/core/course_loader.py)**
- **[apiTypes.ts (前端)](file:///Users/kaigiii/Coding/Learn8/frontend/src/lib/apiTypes.ts)**
- **[HomePageClient.tsx (前端)](file:///Users/kaigiii/Coding/Learn8/frontend/src/app/(dashboard)/home/HomePageClient.tsx)**

## 主要調整內容


### 1. 後端 API (Python)

- **[courses.py](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/courses.py)**
  - 在 GET `/courses` API 的回傳欄位中加入 `updated_at`。
  - 在 POST `/upload-document` (上傳文件) 成功後，將課程的 `updated_at` 更新為目前時間，並 commit。
  - 在 GET `/{course_id}` (取得課程地圖/詳情) 時，若該課程屬於當前使用者，則更新 `course.updated_at` 並進行 commit，使「點擊進入課程」也算作一次操作，讓該課程移動到最左邊（在測試環境的 SQLite 記憶體資料庫中則會跳過 commit 避免連線釋放問題）。

- **[course_loader.py](file:///Users/kaigiii/Coding/Learn8/backend/app/core/course_loader.py)**
  - 於 `_cleanup_orphaned_courses` 清理公用課程時，若該公用課程仍被 `arena_rooms` 或 `arena_matches` 參照（外鍵約束限制），則略過刪除動作並標記 `is_published = False`，避免啟動時 Crash。

- **[lessons.py](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/lessons.py)**
  - 增加輔助函式 `_touch_course_updated_at(db: Session, course_id: int | None, user_id: int)` 用於將指定個人課程的 `updated_at` 更新為目前時間。
  - 在以下學習操作的 API 中呼叫該輔助函式：
    - `start_lesson_session` (開始/重啟學習單元)
    - `submit_answer` (送出答題)
    - `complete_primary_lesson_session` (完成主單元)
    - `complete_remedial_lesson_session` (完成補救單元)

### 2. 前端 (Next.js TypeScript)

- **[apiTypes.ts](file:///Users/kaigiii/Coding/Learn8/frontend/src/lib/apiTypes.ts)**
  - 在 `CourseListItem` 介面中新增可選屬性 `updated_at?: string;`。

- **[HomePageClient.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/app/(dashboard)/home/HomePageClient.tsx)**
  - 修改 `libraryItems` 的 `useMemo` 排序區塊，不再強制區分 `draft` 與 `course` 的順序，改為純粹依 `updated_at` (若無則使用 `created_at` 或 `course.id`) 降序排序：
    ```typescript
    return items.sort((a: HomeLibraryItem, b: HomeLibraryItem) => {
      const timeA = new Date(a.course.updated_at || a.course.created_at).getTime();
      const timeB = new Date(b.course.updated_at || b.course.created_at).getTime();
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.course.id - a.course.id;
    });
    ```

## 驗證方案

### 自動測試
- 於 `backend` 目錄下執行單元測試：
  ```bash
  poetry run pytest
  ```

### 手動測試
1. 建立一個新的 Draft 課程 -> 檢查其是否顯示在最左邊。
2. 進入一個舊的課程並開始答題、完成單元 -> 返回首頁，檢查該課程是否移動至最左邊。
3. 替舊的課程上傳檔案 -> 返回首頁，檢查該課程是否移動至最左邊。
4. 重新命名或修改課程資訊 -> 檢查該課程是否移動至最左邊。
