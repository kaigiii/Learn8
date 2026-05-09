# 課程發佈與審核系統優化計劃書

## 當前問題分析
1. **程式碼異常 (Bug)**: `custom_courses.py` 中的 `export_course_to_yaml` 函數引用了未定義的 `uuid` 變數 (應為 `uuid4`)，導致發佈審核時後端崩潰。
2. **路徑不一致 (Path Mismatch)**: `custom_courses.py` 寫入 YAML 的路徑與 `course_loader.py` 讀取的路徑不一致 (`app/data` vs `data`)，導致發佈後課程無法被系統載入。
3. **架構臃腫 (Code Bloat)**: `custom_courses.py` 內部的同步邏輯與 `course_loader.py` 大量重複，且在 `NodeModel` 中直接將原始 JSON 丟入 `data` 欄位，缺乏結構化，造成所謂的「相容版本」混亂。
4. **公開課程不顯示**: 由於上述的 Bug 和路徑問題，自製課程在審核通過後未能正確同步至系統帳號 (`public@learn8.system`)，因此無法在公開課程區顯示。

## 優化目標
1. **修正 Bug**: 確保發佈流程不中斷。
2. **統一架構**: 將自製課程的同步邏輯與系統整體的 `PublicCourseRegistryLoader` 對齊。
3. **程式碼瘦身**: 移除冗餘參數，簡化 `NodeModel` 與 `LessonStageModel` 的數據結構。
4. **確保同步**: 保證自製課程審核通過後，能即時出現在「公開課程區」。

## 實施步驟

### 第一階段：修復與路徑校正
- 在 `custom_courses.py` 中修正 `uuid` 引用問題。
- 統一 YAML 存儲路徑為 `backend/data/custom_published_courses/`。

### 第二階段：重構與清理
- **清理 `NodeModel`**: 僅存儲必要的欄位（如 `description`），避免將整個 node 對象塞入 `data`。
- **簡化 `export_course_to_yaml`**: 
    - 抽離映射邏輯 (Mapping Logic)。
    - 調用 (或模仿) `course_loader.py` 的標準同步流程，確保與官方課程格式一致。
- **優化組件映射**: 確保 `MultipleChoice`、`ExplainerMedia` 等組件在轉換為 `LessonStage` 時，欄位乾淨且符合規範。

### 第三階段：驗證與自動化
- 確保調用 `export-yaml` 後，系統會自動觸發資料庫刷新，使課程出現在 `/api/v1/courses/public`。
- 驗證管理後台的「課程審核」分頁與「公開目錄」管理功能。

## 預期結果
- 後端代碼更簡潔、易於維護。
- 自製課程發佈後可立即在前端公開區域查看。
- 課程數據格式統一，不再有「相容版本」的過渡參數。
