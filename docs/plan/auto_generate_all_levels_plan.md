# 自動生成所有關卡功能設計計劃書 (Auto-generate All Levels Plan)

本計劃旨在為 Learn8 系統新增一個「自動生成所有關卡」的功能選項。當用戶生成完課程大綱（地圖）後，系統可以選擇是否在背景自動將所有關卡的課程內容一次性生成完畢，而非原先的「點擊關卡時即時（Lazy）生成」。

---

## 1. 核心需求與設計 (Core Requirements & Design)

1. **問卷結尾選項**：在問卷填寫完畢的最後一步（Additional Notes 頁面），新增一個 Switch 或 Checkbox：「**自動生成所有關卡 (需要較多時間與點數)**」。
2. **前後端 API 對接**：
   - 前端發送 `/courses/generate-syllabus` 請求時，傳遞 `auto_generate_lessons=true` 參數。
   - 後端 `generate_syllabus` 接收該參數，並傳遞給背景任務 `run_syllabus_generation_job`。
3. **背景自動生成任務 (Sequential Background Generator)**：
   - 當大綱（Syllabus）成功生成並寫入資料庫後，若 `auto_generate_lessons` 為 `true`，則啟動非同步任務 `auto_generate_course_lessons`。
   - 該任務會循序（Sequential）地對該課程的每一個 Node（關卡）進行生成，調用與單個關卡生成完全一致的 `run_lesson_generation_job`。
   - 採用**循序生成**而非併發（Parallel），是為了防止對 AI 模型（Gemini）造成併發限制（Rate Limit），並確保在點數扣除時不會超支。
   - 在生成每一個關卡前，皆會檢查用戶點數是否足夠，若點數不足則終止後續生成並記錄日誌。

---

## 2. 修改範圍 (Scope of Changes)

### 2.1 後端 API 與背景任務 (Backend API & Background Job)

#### A. [backend/app/api/v1/endpoints/syllabus.py](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/syllabus.py)
* **修改位置**：`generate_syllabus` 路由端點。
  - 新增查詢參數 `auto_generate_lessons: bool = False`。
  - 在發送背景任務 `run_syllabus_generation_job` 時，將該參數帶入。

#### B. [backend/app/services/infra/scheduler/workers/syllabus_worker.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/infra/scheduler/workers/syllabus_worker.py)
* **修改位置 1**：`run_syllabus_generation_job` 函式。
  - 新增參數 `auto_generate_lessons: bool = False`。
  - 當大綱生成成功、課程標記為 READY 且寫入 NodeModel 後，若 `auto_generate_lessons` 為 `True`，以 `asyncio.create_task` 觸發 `auto_generate_course_lessons`。
* **修改位置 2**：新增 `auto_generate_course_lessons` 輔助函式。
  - 循序取出課程下的所有關卡，為尚未生成 Lesson 的關卡建立 `JobModel`，並呼叫 `run_lesson_generation_job`。

---

### 2.2 前端問卷頁面與 Hook (Frontend Questionnaire Page & Hook)

#### A. [frontend/src/features/questionnaire/hooks/useQuestionnaireFlow.ts](file:///Users/kaigiii/Coding/Learn8/frontend/src/features/questionnaire/hooks/useQuestionnaireFlow.ts)
* **修改位置**：
  - 新增 `autoGenerateAll` 狀態：`const [autoGenerateAll, setAutoGenerateAll] = useState(false);`
  - 在 `submitQuestionnaire` 呼叫 `/courses/generate-syllabus` 時，在 URL 查詢參數加上 `&auto_generate_lessons=${autoGenerateAll}`。
  - 將 `autoGenerateAll` 與 `setAutoGenerateAll` 導出給組件使用。

#### B. [frontend/src/features/questionnaire/QuestionnairePageClient.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/features/questionnaire/QuestionnairePageClient.tsx)
* **修改位置**：
  - 在 Additional Notes 頁面（最後一步提交前），新增一個美觀的 Switch / Checkbox，讓用戶選擇是否開啟 `autoGenerateAll`。
  - 視覺設計配合現有的亮色/暗色漸變與玻璃擬態樣式。

---

## 3. 驗證計劃 (Verification Plan)

### 3.1 手動功能測試 (Manual Verification)
1. **未開啟自動生成**：
   - 填寫問卷，不勾選「自動生成所有關卡」，提交生成大綱。
   - 大綱生成後進入課程地圖，確認每一關仍為 Locked 或 Available，點擊時才即時開始生成關卡。
2. **開啟自動生成**：
   - 填寫問卷，勾選「自動生成所有關卡」，提交生成大綱。
   - 大綱生成完畢後，觀察控制台日誌，確認系統自動開始逐關生成 Lesson。
   - 刷新課程地圖，確認所有關卡皆已被自動生成（`hasGeneratedLesson` 為 `true`），點擊時能直接進入關卡，無需等待即時生成。
