# 🧠 提示詞工程與 AI 代理人畫像 (Prompt Engineering & AI Personas)

Learn8 的核心靈魂在於其背後的 **Multi-Agent (多代理人)** 協作系統。本文件詳細記錄了我們如何設計不同職能的 AI 代理人，以及如何透過精密的提示詞工程確保生成的教學內容既專業又有趣。

---

## 🌟 0. 產品價值與 UX 亮點 (Product Value)

提示詞工程不只是文字，更是產品性格的刻畫：

- **教育專家級的引導 (Expert Pedagogical Tone)**：AI 被賦予了「蘇格拉底式引導者」與「資深教學設計師」的畫像，生成的解釋不再是枯燥的維基百科式陳述，而是充滿啟發性的對話。
- **一致性與結構化 (Reliable Consistency)**：透過嚴格的 JSON Schema 強制輸出，學員看到的所有題目、選項與反饋都符合標準化美學，消除了 AI 生成常見的格式混亂問題。
- **動態反思與自我修正 (Agentic Self-Correction)**：系統內建「審查者 (Auditor)」角色，會在內容提交前進行自我批判，確保不會出現邏輯斷層或過於簡單的內容，提供高品質的知識交付。

---

## 🎭 1. 核心代理人角色定義 (Core Personas)

### 1.1 教學規劃師 (The Planner)
- **性格描述**：博學、嚴謹、具備全局觀。
- **職責**：將浩瀚的知識（或 RAG 檔案）解構成由淺入深的 Unit 與 Node。
- **Prompt 關鍵詞**：`"You are a Senior Curriculum Architect"`, `"Identify core concepts and group them into logical modules"`.

### 1.2 內容審查員 (The Auditor)
- **性格描述**：挑剔、細心、追求完美。
- **職責**：對 Planner 產出的草稿進行「批判性審查」。
- **Prompt 關鍵詞**：`"Look for logic gaps"`, `"Ensure the difficulty curve is smooth"`, `"Suggest improvements"`.

### 1.3 關卡建築師 (The Architect)
- **性格描述**：創意、富有幽默感、善於舉例。
- **職責**：為每個知識點設計有趣的題目與滑動投影片（MultipleChoice, ExplainerMedia 等）。
- **Prompt 關鍵詞**：`"Write engaging feedback"`, `"Use real-world analogies"`, `"Follow the provided YAML schema strictly"`.
- **💥 多模態視覺提示詞 (Multimodal Vision Prompt)**：
  - 當課程包含圖片時，提示詞會被動態擴充：
    - **System Prompt**：說明 `media_catalog` 索引規則，強制 AI 必須輸出對應的 `mediaIndex`，禁止自行編造或直接嵌入 Base64 數據。
    - **User Prompt**：除主題大綱外，額外附帶 `[IMAGE INDEX: N] Description: ...` 標記並緊跟著對應的實體圖片 Base64 二進制流。
  - **AI 解讀流程**：視覺模型（Gemini VLM）首先從 `User Prompt` 讀取實體圖像，與 `System Prompt` 提供的描述清單進行比對，判定哪張圖片的圍棋佈局或圖表對應目前要生成的投影片，最終在輸出的 JSON 中寫入該圖片的 `mediaIndex` 達成精準圖片配對。

---

## 🛠️ 2. 提示詞工程與 Agent 呼叫技術細節

### 2.1 少樣本學習 (Few-shot Learning)
為了讓 AI 輸出正確的題型結構，我們在 Prompt 中嵌入了多組正確的範例：
```text
Example Input: "Topic: Python Lists"
Example Output: { "name": "MultipleChoice", "data": { "question": "...", "options": [...] } }
```

### 2.2 動態變更工具 (Atomic Change Tools)
Auditor 不只是提供文字建議，它還能輸出結構化的指令。例如：
- `UPDATE_NODES`: 修改某個單元的學習順序。
- `INSERT_UNITS`: 在難度跳躍過大處自動補齊基礎知識。

---

## 🚀 3. 未來擴展：動態性格切換

後續計劃根據學員的 `Learner Profile` 選擇不同的 Prompt 套組：
- **兒童模式**：Prompt 會要求 AI 使用更簡單、生動的詞彙與表情符號。
- **專業模式**：Prompt 會要求 AI 採用更具學術性與效率的表達方式。
