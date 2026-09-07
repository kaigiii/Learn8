# 高解析度原子化課程生成架構計劃
# High-Resolution Atomic Course Generation Architecture Plan

> **文件路徑**: `docs/plan/atomic_course_generation_architecture_plan.md`  
> **建立日期**: 2026-09-07  
> **核心目標**: 徹底解決 Learn8 課程生成「過於粗淺、關卡過少、學不清楚」的根本問題，在不機械寫死關卡數字的前提下，以「最高教學解析度（High Pedagogical Resolution）」與「原子化解構法則」自動生成深度完整、步幅微小的精緻關卡，並配套「無負擔跳過」機制。

---

## 1. 現狀診斷與核心矛盾 (Diagnoses & Core Tensions)

### 1.1 使用者痛點
* **「學得不清楚」**：目前生成的課程多為 4~6 個廣義單元，每個單元內僅有 2~3 個名詞解釋性質的簡陋 Stage，缺乏原理推導、直觀比喻、踩坑排查與代碼實戰。
* **「不敢給關卡」的惡性循環**：
  * 原先 Prompt 為了防止「認知過載（Cognitive Overload）」，命令 AI 刻意簡化、緊縮單元。
  * 系統採取嚴格線性解鎖（Strict Sequential Locking），因缺乏「快速跳過」機制，迫使大綱只能縮水成走馬看花。
* **使用者明確訴求**：
  > **「我寧願關卡很多讓使用者跳過，也不要關卡很少學得不清楚。預設就要生成好，不限制太多讓它自由生成，但是顆粒度要細且完整。」**

### 1.2 為什麼不能「機械寫死」數量（例如寫死 4~7 單元、每單元 4~6 關）？
* **領域資訊熵（Information Entropy）差異懸殊**：
  * 「Git Cherry-pick 與 Rebase」或「CSS Flexbox 軸心對齊」等微專題，強行塞入 30 關會導致嚴重的胡亂灌水與垃圾題目。
  * 「計算機作業系統」、「深度學習全景」等大主題，若被限制在 20 幾關，又會削足適履，再次回到概論走馬看花。
* **解法核心轉變**：
  * **不要用「人工計數器」約束 AI，而是用「教學解析度（Resolution）」約束 AI。**
  * 只要將 AI 的角色從「課程摘要者（Summarizer）」轉化為「**原子概念解構者（Atomic Deconstructor）**」，關卡的數量自然會依據主題內在的知識複雜度精確伸展。

---

## 2. 第一性原理：四大教學解構法則 (Four Deconstruction Laws)

在 Prompt 與大綱規劃邏輯中，以嚴格的**認知步幅質檢法則**取代僵硬的數字限制：

```
                    [ 原始主題 / Context 材料 ]
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
       【傳統 Summarizer】          【Learn8 Atomic Deconstructor】
        濃縮歸納、目錄思維           原子化拆解、步階階梯思維
                │                           │
        4~6 個粗糙大雜燴節點          N 個零跳步、單一認知微關卡
       （每關包山包海學不透）         （痛點明確、細密透徹、可跳過）
```

### 法則一：單一認知跨度（Single Cognitive Leap Rule）
* **定義**：每一個關卡節點（LessonNode）只允許攻克**「一個核心微概念 / 一個思維階梯 / 一個實戰技巧」**。
* **自檢測試（反向拆解檢驗）**：
  * 若節點標題或描述中含有「**和 / 與 / 及 / 以及其應用**」（例如《變數定義與所有資料型別》、《指針基礎與動態記憶體管理》），視為**超載大雜燴節點**。
  * **強制分裂**：超載節點必須強制裂變成各自獨立的子節點。

### 法則二：認知零跳步與墊腳石原則（Zero-Assumption Gap Principle）
* **定義**：節點 $N$ 推進至節點 $N+1$ 時，**嚴禁出現未經鋪陳的隱性前置知識斷層**。
* **自檢測試**：
  * 規劃節點 $N+1$ 時，AI 必須檢核：「要看懂此關卡，是否依賴任何先前節點未曾獨立剖析過的概念？」
  * 若有，**絕對不允許在該關卡內用一句話順帶提過**，必須在前置位插入一個專門的「墊腳石節點」。

### 法則三：全光譜覆蓋法則（Full-Spectrum Coverage: 拒絕只講 Happy Path）
任何一項核心技術機制，若只教「正常怎麼用」，學習者絕對學不透。每個核心技術點必須展開四維全光譜：
1. **痛點與起源（Why）**：沒有這項機制前，開發者/學習者面臨什麼無法解決的痛苦？
2. **底層心智模型（How）**：背後的運作機制與資料流向為何？
3. **經典陷阱與邊界（Pitfalls & Traps）**：80% 初學者必踩的報錯、反例、邊界條件為何？
4. **選型權衡與局限（Trade-offs）**：什麼情況下「不應該」用它？代價是什麼？

### 法則四：具象問題錨定（Concrete Problem Anchoring）
* 每個節點在描述（description）中，嚴禁泛泛而談「介紹某某概念」，必須明確錨定：
  * 本關學習者要解決的**一個具體場景**。
  * 本關要親手辨析或排查的**一個經典報錯 / 漏洞**。

---

## 3. 大綱生成與審核系統重構 (Syllabus Agent & Auditor Redesign)

### 3.1 改造 `syllabus_prompts.py` (PLANNER_SYSTEM_PROMPT)
* **剔除陳舊抑制指令**：
  * 刪除 `For beginner: Prioritize a highly focused curriculum focusing strictly on foundational core concepts to build a solid base without cognitive overload.`
* **植入原子解構指令**：
  ```markdown
  You are an "Atomic Curriculum Deconstructor" for Learn8.
  Your goal is NOT to summarize the topic, but to reconstruct it into a ladder of micro-steps.
  
  CORE PEDAGOGICAL DECONSTRUCTION RULES:
  1. Single Cognitive Leap: One lesson node must target exactly ONE micro-concept. If a node covers multiple distinct mechanics (e.g. "Lists and Dictionaries"), SPLIT IT.
  2. Zero-Assumption Progression: Ensure zero conceptual gaps between consecutive nodes. Every prerequisite must have its own dedicated stage/node.
  3. Full-Spectrum Depth: Do not just show the "Happy Path". For each core mechanism, include nodes covering:
     - The origin/pain point it solves
     - The underlying mental model
     - Classic traps, boundary cases, and debugging
     - Practical trade-offs
  4. Natural Scaling: Do not pad with artificial filler, but do not compress. Let the true density of the domain dictate the node count. A thorough course naturally unfolds into fine-grained micro-nodes so that experienced learners can skip what they know, while beginners never get left behind.
  ```

### 3.2 改造 `AUDITOR_SYSTEM_PROMPT` (審核質檢員升級)
Auditor 不再走過場，而是依據「三項違規」發起批次重構（Batch Refactoring Actions）：
1. **違規 A：大雜燴節點（Compound Nodes）** $\rightarrow$ 觸發 `INSERT_NODES` / `UPDATE_NODES` 拆解。
2. **違規 B：認知斷層（Missing Prerequisite Leap）** $\rightarrow$ 觸發 `INSERT_NODES` 補足前置階梯。
3. **違規 C：缺乏陷阱反例（Missing Pitfalls / Debugging）** $\rightarrow$ 要求補足邊界排查節點。

---

## 4. 關卡內部深度：五階教學階梯 (5-Stage Scaffolding)

即使大綱節點拆得夠細，如果點進關卡只有 2 題單選題，依然學不透。
在 [`course_architect_prompts.py`](file:///Users/kaigiii/Coding/Learn8/backend/app/services/ai_engine/agents/course_architect_prompts.py) 中，強制定義關卡內部的標準認知推進階梯：

```
[ Stage 1: 痛點直觀圖文 ] ──▶ [ Stage 2: 步驟機制拆解 ] ──▶ [ Stage 3: 核心動手實戰 ]
        (ExplainerMedia)             (Walkthrough/Order)         (Active Sandbox/Fill)
                                                                           │
                                                                           ▼
[ Stage 5: 綜合驗收與費曼 ] ◀── [ Stage 4: 經典陷阱與除錯 ] ◀─────────────┘
      (Synthesis/Feynman)               (Bug Spotting/Trap)
```

| 階梯階段 | 模態組件 (Component) | 內容深度硬性標準 |
| :--- | :--- | :--- |
| **Stage 1: 痛點與心智模型** | `ExplainerMedia` | **拒絕 1~2 句廢話**。必須講清：為什麼需要這個東西？以前的方法痛在哪？搭配對比代碼/棋譜/架構圖（SVG 或清晰範例），建立直觀心智圖像。 |
| **Stage 2: 機制拆解與走查** | `Walkthrough` / `Ordering` / `MatchingPairs` | 透過填空、步驟排序或因果配對，一步步走查內部運作流程。 |
| **Stage 3: 核心動手實踐** | 主題組件 (`CodeSandbox` / `GoBoard` / `MultipleChoice`) | 核心互動操作，從被動閱讀轉為主動構造與參數配置。 |
| **Stage 4: 經典陷阱與除錯** | `Debug` / `MultipleChoice` (陷阱題) | **專門設計新手必踩的錯誤**。給出有 Bug 的情境或反例，要求使用者找出破綻並解釋底層原因。 |
| **Stage 5: 綜合驗收與費曼表達** | `FeynmanMirror` / 綜合挑戰題 | 閉環驗收。用自己的話解釋關鍵要點，或進行無提示的獨立應用。 |

### 4.1 注入前後文鏈條（Context Continuity Chain）
在 `generate_lesson_from_node` 時，傳入相鄰節點的脈絡：
```python
user_content_parts.append({
    "type": "text",
    "text": f"""
CURRICULUM CONTEXT:
- Previous Node (Already Mastered): {prev_node_title} -> {prev_node_desc}
- CURRENT TARGET NODE: {node.title} -> {node.description}
- Next Node (Upcoming): {next_node_title} -> {next_node_desc}

INSTRUCTION:
Assume the learner has mastered the concepts from previous nodes; do NOT repeat basic definitions.
Focus 100% on current node's micro-mechanisms and prepare mental scaffolding for the upcoming node.
"""
})
```

---

## 5. 產品端配套：無負擔跳過機制 (Frictionless Skip System)

關卡顆粒度細、總量多，必須搭配極致流暢的「跳過」機制，徹底釋放學習自主權。

### 5.1 節點層級快速跳過（Node-Level Skip / Mark Mastered）
* **UI 呈現**：在課程地圖（Map Page）點擊任何已解鎖或當前節點時，Popover 彈窗中除「開始學習（Start Lesson）」按鈕外，新增**「我已掌握，跳過此關」**按鈕。
* **行為**：
  1. 點擊後，前端呼叫後端狀態端點 `/api/v1/courses/{course_id}/nodes/{node_id}/status`，將狀態變更為 `NodeStatus.COMPLETED`。
  2. 後端自動依序解鎖下一個節點（`NodeStatus.AVAILABLE`）。
  3. 節點標記為已跳過/已完成，學習者完全不會被已知的知識卡住。

### 5.2 關卡內部極速跳過（In-Stage Quick Skip）
* 保留並突顯關卡底部的「跳過本題（Skip Stage）」按鈕。
* 跳過的題目記錄為 skipped，不納入錯誤補救範圍，直接推進至下一階段。

---

## 6. 實施路線圖 (Implementation Roadmap)

```
[ Phase 1: 大綱解構 Prompt 與 Auditor 升級 ] ──▶ [ Phase 2: 關卡內部五階教學階梯重構 ] ──▶ [ Phase 3: 前後端跳過關卡閉環 ]
```

### Phase 1: 大綱規劃與審查系統重構
* [ ] 修改 `backend/app/services/ai_engine/agents/syllabus_prompts.py`：
  * 重寫 `PLANNER_SYSTEM_PROMPT`，植入四大解構法則與反摘要指令。
  * 重寫 `AUDITOR_SYSTEM_PROMPT`，加入大雜燴節點、跳步斷層、全光譜覆蓋質檢標準。
* [ ] 測試與驗證：使用不同規模的主題（例如「正則表達式 Lookaround」vs「Python 全棧開發」），驗證大綱是否能自然依主題複雜度展開，且節點步階極其細緻。

### Phase 2: 關卡生成深度與五階階梯升級
* [ ] 修改 `backend/app/services/ai_engine/agents/course_architect_prompts.py`：
  * 規範五階教學階梯（痛點心智圖 $\rightarrow$ 機制拆解 $\rightarrow$ 動手實戰 $\rightarrow$ 陷阱除錯 $\rightarrow$ 綜合驗收）。
  * ExplainerMedia 嚴格要求詳細圖文與對比範例。
* [ ] 修改 `backend/app/services/ai_engine/agents/course_architect.py`：
  * 在 `generate_lesson_from_node` 加入前後節點上下文串聯（Context Continuity Chain）。

### Phase 3: 前後端跳過與交互體驗完善
* [ ] 後端檢驗 `/api/v1/courses/{course_id}/nodes/{node_id}/status` 確保支援手動跳過並觸發自動解鎖後續節點。
* [ ] 前端課程地圖節點彈窗加入「我已掌握，跳過此關」交互按鈕與即時樂觀更新（Optimistic UI）。

---

## 7. 驗證與質檢標準 (Verification Criteria)

1. **顆粒度檢驗（Granularity Check）**：
   * 檢查生成大綱的節點標題與描述，是否存在複合概念；每個節點是否能精準對應到單一微技能。
2. **零跳步檢驗（Zero-Leap Check）**：
   * 檢查相鄰節點之間是否有未說明的隱性知識點。
3. **光譜完整性（Full-Spectrum Check）**：
   * 每個核心模組中，是否確實包含專門的「易錯陷阱 / Bug 排查 / 邊界條件」關卡。
4. **跳過流暢度（Skip UX Check）**：
   * 學習者在地圖點擊跳過後，能否在 1 秒內解鎖下一關，且學習進度正常更新。
