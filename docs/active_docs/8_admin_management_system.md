# 🛡️ 管理員控制台與內容生命週期管理 (Admin & Lifecycle Management)

本文件詳述了 Learn8 管理後台的底層邏輯，包括課程審核流、官方課程同步、以及競技場題庫的自動化維護。

---

## 💥 1. 管理系統架構亮點

- **一鍵式課程轉化 (One-Click Transformation)**：管理員點擊審核後，系統會自動觸發 `CourseService.publish_course_to_yaml`，將資料庫中的節點轉化為實體 YAML 備份。
- **題庫自動提取器 (Automated Question Extractor)**：系統能自動分析教學大綱中的 `LessonStage`，提取關鍵題目並注入 `ArenaQuestionPool`，確保競技場內容始終與課程同步。
- **全站維運健康快照 (System Health Snapshot)**：實時監控全站對戰成功率、AI 生成延遲以及 API 負載。

---

## 🏗️ 2. 課程審核與發佈流程 (Approval Pipeline)

當使用者提交課程發佈請求時，後端執行以下原子操作：

1.  **狀態鎖定**：將 `CourseModel.status` 設為 `pending_review`。
2.  **管理員審核 (`POST /api/v1/arena/admin/courses/{id}/approve`)**：
    - 驗證課程結構完整性。
    - 呼叫 `CourseService.publish_course_to_yaml`：
        - 序列化大綱至 `backend/data/custom_published_courses/`。
    - 建立 `PublicCourseModel`：使該課程出現在全站公共目錄。
3.  **競技場解鎖**：
    - 管理員於競技場管理介面選擇該課程。
    - 點擊「從大綱同步」觸發 `AdminService.extract_questions_from_syllabus`。
    - 確認後存入 `arena_question_pool` 並啟動該主題。

---

## 🔄 3. 系統引導與自動同步 (Bootstrapping)

Learn8 在每次啟動時都會透過 `lifespan.py` 執行自動同步：

- **官方課程同步 (`course_registry.sync_to_db`)**：
    - 掃描 `backend/data/official_courses/` 下的所有 YAML。
    - 如果資料庫中不存在，則自動建立並設為 `is_official=True`。
    - 此機制確保了即便資料庫清空，只要 YAML 檔案還在，系統就能快速重建。

---

## 📊 4. 競技場賽季與維運 API

### 4.1 賽季管理 (`/api/v1/arena/admin/seasons`)
- 支持賽季時間窗的設定。
- 賽季結束後，系統會自動結算 Top 10 玩家並派發專屬獎勵勳章。

### 4.2 對戰監控 (`/api/v1/arena/admin/telemetry`)
- 記錄每一場對局的 WebSocket 連線質量。
- 針對惡意退出的玩家，管理員可手動扣除 Elo 積分。

---

## 🛠️ 5. 常見維運指令 (Maintenance CLI)

後端提供了一系列指令（透過 API 或直接腳本）進行維護：
- **`clear_audio_cache()`**：清理所有已生成的語音，用於模型更新後的重新生成。
- **`rebuild_vector_index()`**：重新掃描 `data/uploads` 並重建 ChromaDB 索引。
