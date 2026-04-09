# 公開課程與內容管理 (Content Management)

Learn8 支援「官方公開課程 (Official Public Topics)」，這些課程由系統管理員預先載入，所有使用者共享同一套課程結構，但擁有獨立的學習進度。

## 核心機制

### 1. 系統擁有者 (System User)
所有公開課程均由系統帳號 `public@learn8.system` (預設 ID 為 4) 擁有。這確保了內容的統一性，並防止一般使用者修改官方教材。

### 2. YAML 驅動的導入系統
公開課程的內容儲存在以下目錄：
- `backend/scripts/content/public_courses/*.yaml`

每個 YAML 檔案定義了一門課程的標題、單元、節點以及預設的交互式關卡 (Stages)。

## 如何新增或更新課程

### 步驟 1：編輯或建立 YAML
在 `backend/scripts/content/public_courses/` 下建立新的 `.yaml` 檔案。您可以參考 `ai_neural_networks.yaml` 的結構。

### 步驟 2：更新腳本白名單
開啟 `backend/scripts/seed_public_courses.py`，將您的檔名加入 `ENABLED_COURSES` 陣列中：

```python
ENABLED_COURSES = [
    "ai_neural_networks.yaml",
    "python_fundamentals.yaml",
    "your_new_course.yaml", # 新增這一行
]
```

### 步驟 3：執行導入腳本
切換到 `backend` 目錄並執行：

```bash
python3.12 -m scripts.seed_public_courses
```

## 自動同步與清理 (Orphan Cleanup)

`seed_public_courses.py` 具有「完全同步」功能：
- **更新**：如果資料庫中已存在同名課程，腳本會先刪除舊資料（觸發連鎖刪除，清空相關節點與題目），然後重新寫入。
- **清理**：如果資料庫中有屬於系統帳號的課程，但**不在** `ENABLED_COURSES` 白名單內，腳本會自動將其從資料庫中移除。

## YAML 資料結構範例 (Schema)

以下是一個標準的課程 YAML 範例，必須包含 `title`, `topic`, `description` 以及 `units`：

```yaml
title: "範例課程標題"
topic: "課程主題 (AI 會根據此主題生成進階內容)"
description: "對這門課的簡短介紹"
units:
  - unitId: "u1"
    unitTitle: "第一單元：基礎"
    nodes:
      - id: "n1-1"
        title: "第一個節點"
        description: "節點描述"
        stages:
          # 1. 多選題
          - component: "MultipleChoice"
            difficulty: "medium"
            data:
              question: "這是問題內容嗎？"
              options:
                - {id: "a", text: "選項 A"}
                - {id: "b", text: "選項 B"}
              correctOptionId: "a"
          
          # 2. 排序題
          - component: "Ordering"
            data:
              question: "請排序以下步驟："
              steps: ["步驟一", "步驟二", "步驟三"]

          # 3. 費曼學習法 (申論題)
          - component: "FeynmanMirror"
            data:
              prompt: "請用白話文解釋..."
              sampleAnswer: "標準答案參考..."

          # 4. 圖文解說
          - component: "ExplainerMedia"
            data:
              title: "核心概念"
              explanation: "詳細的文字說明層..."
              bullets: ["重點一", "重點二"]
```

## 注意事項
- **進度保存**：由於導入腳本會刪除並重建課程實體，雖然使用者的 `LessonAttempt` 紀錄會保留在資料庫中（透過 `course_topic` 關聯），但建議在生產環境謹慎執行大規模重建，以免造成進度判定異常。
- **連鎖刪除**：資料庫層級已實作 `ON DELETE CASCADE`，刪除課程會乾淨地移除所有相關聯的 `Node`, `Lesson`, `LessonStage`。
