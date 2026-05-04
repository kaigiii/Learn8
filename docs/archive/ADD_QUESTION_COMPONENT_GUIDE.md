# 🛠️ Learn8 新增題型組件（Question Component）開發指南

本指南詳細說明在 Learn8 平台中，從後端到前端如何完整建立並註冊一個全新的題型。Learn8 採用了高內聚、低耦合的**插件式架構 (Plugin-based Architecture)**，擴充新題型非常快速流暢。

---

## 🎨 1. 後端設定與註冊 (Backend Configuration)

後端主要負責定義題型的資料結構、驗證邏輯與可用性。

### 步驟 1：建立 Module YAML 設定檔
在 `backend/game_modules/` 資料夾下新增一個新題型的 YAML 檔案。
例如：[backend/game_modules/ShortAnswer.yaml]

```yaml
name: ShortAnswer
frontend_registry_key: ShortAnswer
allowed_in_remedial: true
required_config_data_fields:
  - question
  - sampleSolution
submission_keys:
  - userInput
description: 簡答題型，用於讓學習者輸入文字解答。
schema_requirements: |
  config.data 必須包含：
  - question: 提問字串
  - sampleSolution: 參考解答字串
```

### 步驟 2：啟用後端題型模組開關（極重要）
後端具備模組載入白名單機制。建立完 YAML 檔案後，必須將檔案名稱加入至後端的可用模組開關中，否則後端載入器（Component Registry）會將其忽略。
* 開啟 `backend/app/core/config.py`，在 `ENABLED_GAME_MODULES` 字串中加入新題型的 YAML 檔案名稱。
* 或者在後端 `.env` 檔案中加入或更新此環境變數：
  ```env
  ENABLED_GAME_MODULES=ExplainerMedia.yaml,FeynmanMirror.yaml,MatchingPairs.yaml,MultipleChoice.yaml,Ordering.yaml,ShortAnswer.yaml
  ```

### 步驟 3：撰寫與註冊題型評估器（Evaluator，極重要）
當使用者提交作答時，後端必須能對使用者輸入的資料進行評估與計分。如果沒有為題型註冊對應的評估器，後端 API 提交答案時會報錯。
* 開啟 `backend/app/services/lesson_components/evaluators.py`。
* **撰寫評估函數**：
  ```python
  async def evaluate_short_answer(stage: LessonStage, user_input: Any, _topic: str, _architect: Any):
      data = stage.config.data if isinstance(stage.config.data, dict) else {}
      user_answer = str(user_input.get("userInput") or "").strip()
      correct_answer = str(data.get("sampleSolution") or "").strip()
      is_correct = user_answer == correct_answer
      return (
          "correct" if is_correct else "incorrect",
          stage.feedback.success if is_correct else stage.feedback.error,
          {"userInput": user_answer},
          {"submitted": user_answer, "correct": correct_answer}
      )
  ```
* **向註冊表註冊**：在檔案底部將函數綁定至題型名稱：
  ```python
  evaluator_registry.register("ShortAnswer", evaluate_short_answer)
  ```

### 步驟 4：資料庫與型別支援 (選填)
* 若新題型在 Arena 或特定模組中有特定的常值型別（Enum 或 Union），可在資料庫 Schema 與 Alembic Migration 檔案中更新支援的 Component 種類字串。

---

## 💻 2. 前端介面與插件註冊 (Frontend Component & Plugin)


前端負責資料解析、視覺渲染與使用者互動。

### 步驟 1：建立主要 React 元件
在 `frontend/src/components/lesson-session/` 資料夾中，新增對應題型的 React 元件檔案。
例如：`frontend/src/components/lesson-session/ShortAnswerQuestion.tsx`

```tsx
"use client";
import React from "react";

export interface ShortAnswerQuestionProps {
  question: string;
  onComplete: (input: string) => void;
  // 其他必要的 Props...
}

export default function ShortAnswerQuestion({ question, onComplete }: ShortAnswerQuestionProps) {
  return (
    <div>
      {/* 你的題型組件視覺設計、動畫與送出邏輯 */}
    </div>
  );
}
```

### 步驟 2：建立題型插件 (Plugin)
在 `frontend/src/features/lesson-session/question-types/` 資料夾中建立子目錄，並新增 `plugin.tsx`。
例如：`frontend/src/features/lesson-session/question-types/short-answer/plugin.tsx`

```tsx
"use client";
import ShortAnswerQuestion from "@/components/lesson-session/ShortAnswerQuestion";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export function parseShortAnswerStage(stage: LessonStageRenderContext["stage"]) {
  return {
    question: String((stage.config.data as any).question || stage.topic),
    sampleSolution: String((stage.config.data as any).sampleSolution || ""),
  };
}

export function ShortAnswerStageRenderer({ stage, lesson, actions }: LessonStageRenderContext) {
  const parsed = parseShortAnswerStage(stage);

  return (
    <ShortAnswerQuestion
      question={parsed.question}
      onComplete={(userInput) => actions.submitStage(stage, { userInput })}
      // 連結更多 lesson, actions 的通用行為了...
    />
  );
}

export const shortAnswerPlugin = createLessonStagePlugin(
  "ShortAnswer",
  ShortAnswerStageRenderer,
  {
    displayName: "Short Answer",
    capabilities: {
      supportsHint: true,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseShortAnswerStage
);
```

### 步驟 3：在全域插件註冊表匯入
開啟 `frontend/src/features/lesson-session/renderers/index.ts`，將新題型的 `plugin` 匯入並加入至 `stagePlugins` 清單中。

```ts
import { shortAnswerPlugin } from "../question-types/short-answer/plugin";

const stagePlugins = [
  multipleChoicePlugin,
  orderingPlugin,
  feynmanPlugin,
  matchingPairsPlugin,
  explainerMediaPlugin,
  shortAnswerPlugin, // <-- 新增到這裡
] as const satisfies readonly LessonStagePlugin[];
```

### 步驟 4：更新前端 API 型別清單
在 `frontend/src/lib/apiTypes.ts` 的 `LessonStageComponent` 中加入新題型名稱。

```ts
export type LessonStageComponent = 
  | "MultipleChoice" 
  | "Ordering" 
  | "MatchingPairs" 
  | "FeynmanMirror" 
  | "ExplainerMedia"
  | "ShortAnswer"; // <-- 新增型別支援
```

---

## 🎮 3. 競技場（Arena System）與預覽支援

如果您希望該題型也能夠在**競技場（Arena）模式**、**即時連線對戰**以及**管理後台題目預覽**中使用，必須額外在競技場模組中完成對應：

### 步驟 1：註冊題目預覽器
開啟 `frontend/src/features/arena/components/ArenaQuestionPreview.tsx`：
* **匯入組件**：將新題型 React 組件匯入該檔案。
* **在 `renderContent()` 中新增分支**：
  ```tsx
  case "ShortAnswer":
    return (
      <ShortAnswerQuestion
        question={prompt}
        onComplete={noop}
        // 競技場特殊預覽所需的 Props
      />
    );
  ```
* **新增 Label 與 Icon 顯示對應**：在 `getTypeLabel()` 與 `getIcon()` 中，為新題型新增返回的文字標籤與 React Icon（例如 `FiEdit3`）。

### 步驟 2：註冊競技場對戰介面
開啟 `frontend/src/features/arena/ArenaMatchPageClient.tsx`：
* **匯入組件**：匯入新題型 React 組件。
* **新增對戰渲染分支**：在 `renderQuestion` 的對應區塊中，加入新題型的對戰渲染與計分/提交回呼（`onSubmit` 或 `onComplete`）。

### 步驟 3：管理端題目池組建器圖標
開啟 `frontend/src/features/arena/components/ArenaPoolBuilder.tsx`：
* 在題型清單中加入新題型的選項與 icon，以便管理者篩選：
  ```tsx
  { id: "ShortAnswer", label: "Short Answer", icon: <FiEdit3 /> }
  ```

---

## 🎯 4. 測試與驗證

1. **建立測試課程**：可以在後端資料庫或種子資料檔（例如 `backend/public_courses/world_history.yaml`）中，加入一個使用新題型的單元 stage。
2. **啟動測試**：執行 `npm run dev` 啟動前端，點擊進入測試課程，確認新題型能正確解析 `config.data` 並渲染元件。
3. **完成作答**：作答完畢送出答案，測試後端 API 能否成功透過 `actions.submitStage` 提交數據並推進至下個關卡。

