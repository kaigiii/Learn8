# 公開課程與內容管理 (Content Management)

Learn8 支援「官方公開課程 (Official Public Topics)」，這些課程由系統管理員預先載入，所有使用者共享同一套課程結構，但擁有獨立的學習進度。

## 核心機制

### 1. 系統擁有者 (System User)
所有公開課程均由系統帳號 `public@learn8.system` (預設 ID 為 4) 擁有。這確保了內容的統一性，並防止一般使用者修改官方教材。

### 2. YAML 驅動的自動同步系統
目前的公開課程導入已不再依賴手動腳本，而是與 **Application Lifespan** 整合：
- 當 Uvicorn 伺服器啟動時，系統會自動掃描 YAML 文件。
- 透過 `TopicCatalogService` 將內容與資料庫同步。

### 3. 內容存儲路徑
- 目標 YAML 檔案目錄：`backend/scripts/content/public_courses/*.yaml`

---

## 如何新增或更新課程

### 步驟 1：編輯或建立 YAML
在 `backend/scripts/content/public_courses/` 下建立新的 `.yaml` 檔案。您可以參考 `ai_neural_networks.yaml` 的結構。

### 步驟 2：更新課程註冊清單
開啟 `backend/app/core/course_loader.py`，將您的檔名加入 `ENABLED_COURSES` 列表：

```python
ENABLED_COURSES = [
    "ai_neural_networks.yaml",
    "python_fundamentals.yaml",
    "your_new_course.yaml", # 新增這一行
]
```

### 步驟 3：重啟後端服務
重啟 Uvicorn 伺服器後，系統會在啟動日誌中顯示同步進度：

```text
INFO: Syncing public topics to DB...
INFO: Topic 'your_new_course' synchronized.
```

---

## 自動同步邏輯 (Safe Sync)

`TopicCatalogService` 在啟動時執行的動作：
- **一致性比對**：若 YAML 內容有變動，系統會自動更新資料庫中的結構（標題、節點、關卡）。
- **孤兒清理 (Orphan Cleanup)**：如果某個課程曾在資料庫中存在，但現在不在 `ENABLED_COURSES` 清單中，系統會自動清理該課程的所有節點與關卡，確保環境純淨。

---

## 注意事項
- **進度關聯**：雖然課程結構會根據 YAML 重建，但使用者的 `LessonAttempt` 歷史紀錄是透過 `course_topic` 字串進行關聯，因此即使 ID 變動，玩家的學習路徑在多數情況下仍能維持一致。
- **遺留腳本說明**：手動腳本 `seed_public_courses.py` 已被移除，請統一使用重啟服務的方式來觸發內容同步。
