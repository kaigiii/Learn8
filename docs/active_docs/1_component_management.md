# 🧩 題型組件管理與增刪指南 (Maximum Detail Edition)

本文件專門為 Learn8 的開發人員設計，詳細說明如何新增、修改、以及完全刪除全站題目關卡所支援的題型組件（Question Components），並深入剖析每種內建組件的**完成作答評估與答題正確性驗證機制**。

---

## 💥 1. 題型組件之架構亮點與特色 (Core Highlights)

Learn8 的題型與關卡設計之所以靈活且強大，得益於以下幾個關鍵技術特色：
- **YAML 驅動式組件定義**：毋須硬編碼任何題型結構，僅需透過一個簡單的 YAML 檔案即可完成新題型 Schema、必填欄位以及答題提交欄位的全局註冊。
- **雙層資料驗證體系 (Double-Layer Validation)**：後端除了基本的 Pydantic 類型檢查，還引入了 `ComponentRegistryLoader`。無論是 AI 即時生成的關卡內容，還是管理員錄入的靜態題目，系統皆會強制執行 Schema 對齊，絕不容忍任何無效題目進入資料庫。
- **動態評估與 AI 反思整合 (Dynamic Evaluators)**：簡單題型（單選題、排序題）採用本地極速字串比對，而開放、高難度題型（費曼技巧）則與 **AI 大語言模型** 無縫綁定。AI 擔任實時考官，動態解構學員答案並生成人性化建議。

---

## 🛠️ 2. 全域架構解析

Learn8 的題型與關卡設計遵循「前後端分離但 Schema 定義與評估驗證規格嚴格綁定」的原則：

### 2.1 後端模組與 Registry
- **檔案目錄**：`backend/data/game_modules/`
- **Registry Loader 類別**：`app.core.component_loader.ComponentRegistryLoader`
- **核心職責**：
  - 在服務啟動時，解析每個題型的 YAML 描述，註冊至記憶體。
  - 提供 `validate_component_data` 方法，確保傳入的 `data` 規格與 Pydantic 類型一致。

### 2.2 前端 Plugin 與 渲染器 (Renderer)
- **原始碼目錄**：`frontend/src/features/lesson-session/question-types/`
- **註冊檔案**：`frontend/src/features/lesson-session/renderers/index.ts`

### 2.3 評估器註冊中心 (`Evaluator Registry`)
- **後端評估模組**：`backend/app/services/lesson_components/evaluators.py`
- **核心職責**：
  - 根據關卡的 `stage.component` 名稱，動態檢索對應的評估函式（如：`evaluate_multiple_choice`、`evaluate_feynman` 等）。

---

## 📊 3. 內建 5 大組件之答題正確性評估機制

以下為全站五大組件的詳細答題評估邏輯與答案比對標準：

### 3.1 ExplainerMedia
- **後端評估器**：`evaluate_explainer_media`
- **答題規範**：學員只需點擊「理解並繼續」，傳入 `{"acknowledged": true}`。
- **正確性判定**：**絕對恆真**。任何提交均被判定為 `correct`。
- **回饋內容**：返回 `stage.feedback.success`。

### 3.2 MultipleChoice (單選題)
- **後端評估器**：`evaluate_multiple_choice`
- **答題規範**：學員提交被選中的選項 ID，例如 `{"selectedOptionId": "b"}`。
- **正確性判定**：
  - 系統提取題目中 `correctId`、`correctOptionId`、或 validation 配置中的正確答案 ID。
  - 將學員提交的 ID 轉化為字串，進行精準比對：
    `is_correct = normalized_input["selectedOptionId"] == str(correct_option_id)`

### 3.3 Ordering (排序題)
- **後端評估器**：`evaluate_ordering`
- **答題規範**：學員提交排序後的步驟列表。
- **正確性判定**：
  - 系統將正確的預期順序 `data.get("steps")` 與學員提交的順序分別進行字串標準化處理。
  - 執行完全相等的列表比對：`is_correct = normalized_input["order"] == expected_order`。

### 3.4 MatchingPairs (連連看/配對題)
- **後端評估器**：`evaluate_matching_pairs`
- **答題規範**：學員提交配對後的字典資料。
- **正確性判定**：
  - 後端標準化處理預期正確的配對資料 `expected_pairs`。
  - 進行字典比對：`is_correct = normalized_input["matches"] == expected_pairs`。

### 3.5 FeynmanMirror (費曼技巧實踐)
- **後端評估器**：`evaluate_feynman`
- **答題規範**：學員提交其對於概念的開放式論述文字。
- **正確性判定**：
  - **由 AI 進行動態評估**。
  - 呼叫 `architect_service.grade_feynman_attempt`，將論述內容、學習上下文、題目引言與參考答案一併送給 LLM。

---

## ➕ 4. 如何新增一個全新的題型組件與評估器

假設我們需要新增一個 **FillInBlank（填空題）** 組件：

### 步驟 A：在後端建立模組配置
在 `backend/data/game_modules/` 建立 `FillInBlank.yaml`：
```yaml
name: "FillInBlank"
frontend_registry_key: "FillInBlank"
allowed_in_remedial: true
voice_targets: ["question"]
required_config_data_fields: ["question", "correctAnswer"]
optional_config_data_fields: []
submission_keys: ["userAnswer"]
```

### 步驟 B：在後端實作並註冊評估器
在 `backend/app/services/lesson_components/evaluators.py` 建立並註冊對應的函式：
```python
def normalize_fill_in_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        val = user_input.get("userAnswer")
    else:
        val = user_input
    return {"userAnswer": str(val or "").strip()}

async def evaluate_fill_in_blank(stage: LessonStage, user_input: Any, _context, _architect):
    data = stage.config.data or {}
    normalized = normalize_fill_in_input(user_input)
    correct_ans = str(data.get("correctAnswer", "")).strip()
    
    is_correct = normalized["userAnswer"].lower() == correct_ans.lower()
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized,
        {"submitted": normalized["userAnswer"], "expected": correct_ans}
    )

evaluator_registry.register("FillInBlank", evaluate_fill_in_blank)
```

### 步驟 C：在前端實作該組件插件
在 `frontend/src/features/lesson-session/question-types/` 下建立元件。
最後將此元件註冊至 `frontend/src/features/lesson-session/renderers/index.ts` 的 `questionPlugins` 中。
