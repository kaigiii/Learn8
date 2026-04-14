# AI Pipeline

這份文件是 Learn8 生成流程的實際運作摘要，對齊目前後端實作與資料落地方式。

這份文件整理目前實際運作中的 AI 流程，內容已對齊 `backend/app` 現況。

## Questionnaire Generation

用途：

- 依 `topic + course context` 生成探索型問卷

輸入：

- `topic`
- `course_id`
- course files / RAG context

輸出：

- `questions`
- job `result_data.questions`

## Questionnaire Submission / Learner Profile

用途：

- 將問卷答案摘要成 learner profile

輸入：

- `questions`
- `submission`
- `topic`

輸出：

- learner profile summary
- 寫回 `courses.profile_json`

## Syllabus Generation

用途：

- 依 topic、learner profile、course context 生成 `CoursePath`

輸入：

- `topic`
- `course_id`
- `profile_summary`
- course file full-text context
- RAG context

輸出：

- `CoursePath`
- 寫入 `courses.syllabus_json`
- 扁平化 node 狀態寫入 `nodes`

## Lesson Generation

用途：

- 為單一 node 生成 `LessonStage[]`

輸入：

- `topic`
- `LessonNode`
- learner profile
- course / file / RAG context
- component registry prompt menu

輸出：

- `LessonStage[]`
- 寫入 `lessons`
- canonical stage records 寫入 `lesson_stages`
- 若 cache 合法，後端優先回傳 cache

## Answer Submission / Evaluation

用途：

- 對每一題提交做標準化與判定

輸入：

- `sessionId`
- `stageId`
- `userInput`
- `context_topic`

輸出：

- `SubmissionResponse`
- `result`: `correct | incorrect | skipped`
- `message`
- `evaluation`

## Remedial Generation

用途：

- 將同一 lesson session 中的 failed stages 打包成補救教學

輸入：

- `topic`
- `sessionId`
- `nodeId`
- `courseId`
- `failedStages[]`

輸出：

- remedial `LessonStage[]`
- remedial metadata 寫入 `lesson_remedials`
- canonical remedial stage records 寫入 `lesson_remedial_stages`
- session 透過 `lesson_session_stages` 切換到 remedial phase

## Lesson Canonical Data Model

目前 lesson 資料流已改成「內容表」與「session 表」分開：

```text
lessons
  -> lesson_stages

lesson_remedials
  -> lesson_remedial_stages

lesson_sessions
  -> lesson_session_stages
  -> lesson_attempts
  -> lesson_failed_stages
```

白話理解：

- `lessons` / `lesson_stages`
  保存某個 node 的正式主教學內容
- `lesson_remedials` / `lesson_remedial_stages`
  保存某次補救教學生成出的正式內容
- `lesson_sessions` / `lesson_session_stages`
  保存某位使用者這一次實際遊玩的編排與進度

也就是說：

- 主教學和補救教學各自持久化
- session 不再自己成為內容真相來源
- 前端啟動 session 時，後端會從 canonical stage records 組裝 playable session

## SSE Jobs

目前以下流程都走 background job + SSE：

- questionnaire generation
- syllabus generation
- lesson generation
- remedial generation

通用模式：

1. API 建立 `generation_jobs`
2. 回傳 `job_id`
3. 背景 worker 執行 AI / RAG 工作
4. worker 推送狀態到 PostgreSQL `LISTEN/NOTIFY`
5. 前端訂閱 `/api/v1/jobs/{job_id}/stream`
6. 前端可用 `/api/v1/jobs/active` 做 resume / retry / stale recovery

## 讀全文 vs 只用 RAG（實際行為對照）

目前資料來源分成三類：

### A. 讀全文（從 uploads 讀檔）

這類流程會直接讀取完整檔案文字，塞進 prompt。

- **Syllabus Generation**
  - 來源：`backend/app/api/v1/endpoints/syllabus.py`
  - 行為：逐檔案讀取內容，組成 `full_text_context`
  - 進入：`run_syllabus_generation_job` → `SyllabusAgent.run(context=full_text_context)`
  - 用途：用整份課程資料生成 CoursePath

- **Syllabus Generation（jobs API 版本）**
  - 來源：`backend/app/api/v1/endpoints/jobs.py`
  - 行為：同樣組 `full_text_context` 後交給 worker

### B. 讀全文（bind_files 注入）

這類流程會呼叫 `provider.bind_files(...)`，把整份檔案注入 LLM。

- **Syllabus Refinement**
  - 來源：`backend/app/services/ai_agents/course_architect.py`
  - 行為：`refine_course_syllabus` 使用 `bind_files`

### C. 只用 Chroma / RAG（不綁全文）

這類流程只做向量檢索，不注入全文。

- **Lesson Generation**
  - 來源：`generate_lesson_from_node`
  - 行為：`rag_engine.query_context(topic, course_id=...)`
  - 已改為 **不綁全文**

- **Lesson Chat Tutor**
  - 來源：`answer_lesson_question`
  - 行為：只做 `rag_engine.query_context(...)`
  - 已改為 **不綁全文**

- **Questionnaire Generation**
  - 來源：`QuestionnaireAgent.generate_questions`
  - 行為：只做 `rag_engine.query_context(...)`

- **Feynman Grading**
  - 來源：`grade_feynman_attempt`
  - 行為：只做 `rag_engine.query_context(...)`

- **Remedial Generation**
  - 來源：`generate_remedial_stages`
  - 行為：不使用全文，只吃 failed stages + prompt

## Arena Content Pipeline

目前的 Arena 官方內容（`PublicCourse` 與 `QuestionPool`）採取與個人課程不同的流程：

- **YAML 驅動**：官方主題與題庫目前由管理員透過 YAML 文件人工審核並導入，不經過 AI 即時生成。
- **優點**：確保競技平衡性（所有玩家面對相同難度的題庫）、保證題目內容的高準確度。
- **未來擴展**：系統架構已預留在管理台（`ArenaAdminService`）整合 AI 生成題目的介面。
