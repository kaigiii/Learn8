# 課程架構師顯示邏輯優化與防錯機制修改計劃

本計劃旨在解決新生成的自訂課程（自我學習課程）無法正確顯示「課程架構師（Syllabus Architect）」側邊欄面板的 Bug，並釐清與強化「公開/發佈課程」與「自訂/草稿課程」的判定邏輯。

---

## 1. 核心問題診斷（Root Cause Analysis）

在系統資料庫中，新生成的自訂課程（例如 Course ID 22, 23）之 `syllabus_json` 欄位內部，被存入了 `"isPublic": true` 的資料。
原因如下：
1. **AI 隨機生成干擾**：先前重構 AI 提示詞後，JSON 格式的約束完全依賴 LLM（Gemini）輸出符合 Pydantic 的 `CoursePath` schema。LLM 在生成 syllabus 時，會自作聰明地在 `isPublic` 欄位填入 `true`。
2. **後端直接透傳**：後端載入該 `syllabus_json` 並反序列化為 `CoursePath` 物件時，直接保留了該欄位的值，沒有覆寫。
3. **前端判定錯誤**：前端讀取到 `isPublic: true` 後，誤認為這是一個「官方公開課程」，因此將面板渲染成代表官方的綠色，並**直接隱藏了課程架構師面板與 Tab 分頁**。

---

## 2. 判斷邏輯重整與加強

為了確保系統的穩定性，**「是否為公開課程（唯讀，不顯示架構師）」不能交給 AI 決定**，而是必須由後端根據資料庫的真實狀態（Source of Truth）進行動態覆寫。

我們結合系統現有的「審核與發佈機制」，重新定義判定條件：
* **公開/唯讀課程（isPublic = True）** 的判定標準：
  - 該課程的發佈狀態已被標記為 True（`course.is_published == True`）。
* **自訂/草稿課程（isCustom = True）** 的判定標準：
  - 排除上述「公開/唯讀課程」條件後的所有課程（即 `isCustom = not isPublic`）。

這確保了：
* 一般使用者新生成的「自我學習之路」課程為私有草稿，架構師維持開啟，使用者可以隨時微調大綱。
* 創作者課程一旦通過審核並**發佈**（`is_published = True`），將自動轉為唯讀（隱藏架構師），防止線上運作的課程大綱與創作者本機檔案產生落差（Desync）。

---

## 3. 修改範圍與具體實作

### 3.1 後端 API 與 Worker 覆寫

後端凡是將 `syllabus_json` 轉化為 `CoursePath` 回傳或寫入之處，均須強制覆寫 `isPublic` 與 `isCustom`。

#### A. [backend/app/api/v1/endpoints/courses.py](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/courses.py)
* **修改位置 1：`get_course_detail` (路由 `GET /{course_id}`)**
  將原先不夠嚴謹的 `isPublic` / `isCustom` 覆寫逻辑修改為：
  ```python
  is_published = bool(course.is_published)
  path.isPublic = is_published
  path.isCustom = not is_published
  ```

* **修改位置 2：`update_node_status` (路由 `POST /{course_id}/update-node-status`)**
  在函式尾部回傳 `path` 之前，比照上述邏輯進行覆寫：
  ```python
  is_published = bool(course_record.is_published)
  path.isPublic = is_published
  path.isCustom = not is_published
  ```

#### B. [backend/app/api/v1/endpoints/syllabus.py](file:///Users/kaigiii/Coding/Learn8/backend/app/api/v1/endpoints/syllabus.py)
* **修改位置 1：`generate_syllabus` (快取返回處)**
  ```python
  if course.syllabus_json and not regenerate and course.status == CourseStatus.READY:
      path = CoursePath(**course.syllabus_json)
      path.id = course.id
      path.topic = course.topic
      # 新增覆寫邏輯
      is_published = bool(course.is_published)
      path.isPublic = is_published
      path.isCustom = not is_published
      return path
  ```
* **修改位置 2：`refine_syllabus_endpoint` (對話修正端點)**
  - 當課程屬於官方或已發佈，只允許管理員（Admin）進行修正，其餘人拒絕：
    ```python
    from app.services.domain.user.service import UserService
    if course and course.is_published and not UserService.is_admin(current_user):
        raise HTTPException(status_code=403, detail="Published courses are immutable and cannot be refined.")
    ```
  - 同時在持久化與返回 `refined_syllabus` 之前，覆寫其 `isPublic` / `isCustom` 狀態。

#### C. [backend/app/services/infra/scheduler/workers/syllabus_worker.py](file:///Users/kaigiii/Coding/Learn8/backend/app/services/infra/scheduler/workers/syllabus_worker.py)
* **修改位置：`run_syllabus_generation_job` (Worker 完成存檔處)**
  在將 `syllabus.model_dump()` 寫入資料庫欄位 `c_model.syllabus_json` 之前，先進行狀態強制初始化：
  ```python
  is_published = bool(c_model.is_published)
  syllabus.isPublic = is_published
  syllabus.isCustom = not is_published
  c_model.syllabus_json = syllabus.model_dump()
  ```

#### D. [backend/app/arena/api/arena.py](file:///Users/kaigiii/Coding/Learn8/backend/app/arena/api/arena.py)
* **修改位置：`get_public_course`**
  因為這是專門供競技場公開下載的端點，回傳時強制設定為 `isPublic = True`：
  ```python
  path.isPublic = True
  path.isCustom = False
  ```

---

### 3.2 前端課程架構師對應調整

#### A. [frontend/src/app/courses/[courseId]/CourseMapPageClient.tsx](file:///Users/kaigiii/Coding/Learn8/frontend/src/app/courses/[courseId]/CourseMapPageClient.tsx)
* **管理員特權存取**：如果登入的使用者是系統管理員（管理員或以 `dev` 起頭的開發者帳號），即使在已發佈或官方唯讀課程中，也應該可以看到課程架構師，以利線上直接測試與調整。
* 修改 `showAssistantPanel` 定義：
  ```typescript
  import { useAuthStore } from "@/stores/app/useAuthStore";
  
  // 元件內部獲取 authUser
  const authUser = useAuthStore((s) => s.user);
  
  const emailLocalPart = (authUser?.email || "").trim().toLowerCase().split("@")[0] ?? "";
  const userHandle = (authUser?.full_name || authUser?.email || "").trim().toLowerCase();
  const isDevAccount =
    userHandle === "dev" ||
    emailLocalPart === "dev" ||
    userHandle.startsWith("dev ") ||
    userHandle.startsWith("dev-") ||
    userHandle.startsWith("dev_");
  const isAdministrator = Boolean(authUser?.is_admin || isDevAccount);

  const showAssistantPanel = Boolean(
    coursePath && (!coursePath.isPublic || isAdministrator)
  );
  ```

---

## 4. 驗證與測試步驟

1. **資料庫修復驗證**：
   - 執行腳本將資料庫中現有被污染的自訂課程（ID 22, 23）之 `syllabus_json` 修改回 `"isPublic": false`。
2. **新生成課程測試**：
   - 進入 onboarding 或問卷重新生成一門全新課程，檢查回傳的 JSON 其 `isPublic` 應為 `false`，前端呈現藍色外框「課程內容」，且架構師聊天分頁正確出現。
3. **發佈同步測試**：
   - 將該自訂課程發佈，確認其 `is_published` 轉為 `true` 後，頁面會自動轉為綠色「官方主題」，且課程架構師面板對普通使用者隱藏。
4. **管理員覆寫測試**：
   - 以 `dev@learn8.ai` 開發者帳號登入，檢視上述發佈後的課程，確認仍可看見並操作課程架構師面板。
