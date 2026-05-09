# 業務邏輯抽離與 Service 層重構計劃書 (Service Layer Refactoring Plan)

## 1. 現況分析 (Current Issues)

目前專案的 API 層 (Endpoints) 承擔了過多的業務邏輯，違反了單一職責原則 (SRP)。主要問題包括：

- **複雜的資料映射**：`custom_courses.py` 中包含大量將資料庫模型轉換為 YAML 結構的邏輯。
- **檔案系統操作**：API 直接處理檔案的讀寫、刪除與目錄建立。
- **混合型操作**：同一個 API 函式中混雜了資料庫事務、第三方 API 呼叫與背景任務派發。
- **重複代碼**：類似的資料轉換或權限檢查邏輯散落在多個 Endpoints 中。

---

## 2. 目標 (Objectives)

- **瘦身 API 層**：API 只負責請求驗證 (Validation) 與響應回傳 (Response)。
- **建立 Service 層**：所有核心業務邏輯（如 YAML 導出、音檔生成、課程複製）均封裝在獨立的 Service 類別中。
- **提升可測試性**：Service 函式可以脫離 FastAPI 環境進行獨立單元測試。
- **提高重用性**：不同的 Endpoints 可以調用相同的 Service 邏輯。

---

## 3. 預計抽離的 Service 與功能

### 3.1 `CourseService` (`app/services/course_service.py`)
- **課程管理**：創建、更新課程，以及 `_sync_course_nodes` (節點同步) 邏輯。
- **課程複製 (Forking)**：處理課程及其節點的深度拷貝。
- **導出邏輯**：
    - `serialize_to_yaml_structure`: 將資料庫中的課程組件映射為標準 YAML 格式。
    - `export_to_file`: 處理 YAML 檔案寫入與路徑管理。
- **發佈工作流**：封裝「標記發佈 -> 寫入檔案 -> 觸發同步」的完整流程。

### 3.2 `AudioService` (`app/services/audio_service.py`)
- **快取管理**：檢查快取是否存在、生成快取雜湊、清除快取目錄。
- **語音生成請求**：封裝向 VoxCPM 發送請求的 `httpx` 邏輯。
- **批次預建**：從 `LessonModel` 中提取文本並調用生成邏輯。

### 3.3 `UserService` (選配，`app/services/user_service.py`)
- **頭像處理**：封裝 `auth.py` 中的頭像縮放、轉換與存儲邏輯。
- **資產管理**：處理使用者餘額更新與交易日誌記錄。

---

## 4. 實作步驟 (Implementation Steps)

1.  **建立目錄結構**：確保 `app/services/` 目錄存在。
2.  **實作 `CourseService`**：
    - 從 `custom_courses.py` 搬遷映射邏輯。
    - 在 API 中注入並調用 Service。
3.  **實作 `AudioService`**：
    - 搬遷 `audio.py` 中的背景生成與微服務呼叫邏輯。
    - 簡化 API 函式至 10 行以內。
4.  **一致性檢查**：
    - 確保所有 Service 使用單一的資料庫 Session。
    - 確保錯誤處理 (Exception Handling) 在 Service 層拋出，API 層捕獲並轉為 HTTPException。

---

## 5. 預期效益 (Expected Benefits)

- **程式碼量減少**：API 檔案將變得非常精簡且易於閱讀。
- **穩定性提升**：核心邏輯集中化，減少因在多處修改而導致的狀態不一致。
- **開發效率**：新功能可以基於現有的 Service 快速構建，無需重新實現底層邏輯。
