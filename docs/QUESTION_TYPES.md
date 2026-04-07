# 新增題型模板

這份文件說明如何在 Learn8 同時新增前後端題型，並確保 registry / schema / evaluator 一致。

目前 Learn8 的 lesson 題型已經做成「前後端雙 registry」結構。
如果你要新增一個新的 `LessonStage.component`，建議直接照下面模板做，不要再回到零散修改模式。

## 一張圖理解題型對齊

- 前端題型 registry：`frontend/src/features/lesson-session/question-types/**`
- 前端 plugin 註冊中心：`frontend/src/features/lesson-session/renderers/index.ts`
- 前端型別契約：`frontend/src/features/lesson-session/renderers/types.ts`
- 後端 component 定義來源：`backend/game_modules/*.yaml`
- 後端 schema 驗證：`backend/app/schemas/lesson_schema.py`
- 後端 submission evaluator registry：`backend/app/services/lesson_components/evaluators.py`
- 後端 component manifest API：`GET /api/v1/lessons/components`
- AI component prompt 來源：`backend/app/services/ai_agents/course_architect_prompts.py`

## 前端新增題型

新增一個題型時，優先比照現有模組建立：

- `frontend/src/features/lesson-session/question-types/<your-type>/plugin.tsx`

建議內容包含：

1. `Parsed<YourType>StageData`
2. `parse<YourType>Stage(stage)`
3. `<YourType>StageRenderer`
4. `createLessonStagePlugin(...)`

最小範例結構：

```tsx
"use client";

import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedExampleStageData {
  prompt: string;
}

export function parseExampleStage(
  stage: LessonStageRenderContext["stage"]
): ParsedExampleStageData {
  return {
    prompt: String((stage.config.data as { prompt?: string }).prompt || stage.topic),
  };
}

export function ExampleStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  const parsedStage = parseExampleStage(stage);

  return <div>{parsedStage.prompt}</div>;
}

export const examplePlugin = createLessonStagePlugin(
  "ExampleComponent",
  ExampleStageRenderer,
  {
    displayName: "Example Component",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseExampleStage
);
```

接著在 `frontend/src/features/lesson-session/renderers/index.ts` 註冊：

- 匯入新 plugin
- 加進 `stagePlugins`

## 後端新增題型

後端至少要同步做四件事。

### 1. 註冊 component YAML

新增：

- `backend/game_modules/<YourType>.yaml`

建議欄位：

- `name`
- `frontend_registry_key`
- `module`
- `allowed_in_remedial`
- `required_config_data_fields`
- `optional_config_data_fields`
- `submission_keys`
- `description`
- `schema_requirements`

最小範例：

```yaml
name: ExampleComponent
frontend_registry_key: ExampleComponent
module: Practice
allowed_in_remedial: true
required_config_data_fields:
  - prompt
optional_config_data_fields: []
submission_keys:
  - answer
description: If the goal is to ...
schema_requirements: |
  config.data MUST contain:
  - prompt: A single prompt string.
```

### 2. 補 submission evaluator

新增 evaluator 到：

- `backend/app/services/lesson_components/evaluators.py`

並註冊到：

- `evaluator_registry.register("ExampleComponent", evaluate_example_component)`

這一步是後端真正知道如何判題的地方。

### 3. 確認 schema 驗證可接受你的 `config.data`

目前 `LessonStage` 會透過 `backend/app/schemas/lesson_schema.py` 與 component registry 檢查：

- component 名稱是否合法
- `config.data` 是否缺少必要欄位

所以通常只要 YAML 定義完整，這層就會自動接上。

### 4. 確認 AI prompt 可以安全使用這個題型

如果新題型要參與 lesson generation 或 remedial generation，請確認：

- `backend/app/services/ai_agents/course_architect_prompts.py`

是否應該允許它出現在 remedial。

現在 remedial 可用題型是從 YAML registry 動態生成，所以大多數情況只要設定：

- `allowed_in_remedial: true`

就會一起進 prompt。

## 前後端一致性 checklist

新增題型後，至少確認以下項目都成立：

- 前端 plugin `component` 名稱和 backend YAML `name` 一致
- 前端 plugin `component` 名稱和 backend YAML `frontend_registry_key` 一致
- 前端 `parseStage` 讀取的欄位，存在於 backend `required_config_data_fields` / `optional_config_data_fields`
- 後端 evaluator 接受的 submission key，和 frontend `submitStage(...)` payload 一致
- 如需進 remedial，`allowed_in_remedial` 設定正確
- `GET /api/v1/lessons/components` 可以看見新題型

## 驗證指令

前端：

```bash
cd frontend
npm run build
```

後端：

```bash
cd backend
python3 -m pytest tests -q
```

如果你只是要先確認 schema / import 沒壞，也可以先跑：

```bash
python3 -m compileall backend/app
```
