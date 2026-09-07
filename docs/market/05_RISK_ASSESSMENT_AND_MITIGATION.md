# 📘 白皮書 05：客觀風險評估、AI 幻覺與系統硬傷防禦 (Risk Mitigation & Fallbacks)

*專案：Learn8 (AI-Native Adaptive Micro-learning & Gamification Engine)*  
*文檔類型：客觀風險評估、合規與技術防禦手冊 | 關聯文檔：[docs/market/README.md](./README.md)*

---

## 1. ⚠️ 客觀風險矩陣 (Risk Assessment Matrix)

任何客觀中立的報告都必須直面產品的真實軟肋。以下為 Learn8 營運過程中不可迴避的 5 大客觀風險：

```
 高  ┌─────────────────────────────────────────────────────────┐
 影  │ 1. 競技場冷啟動 Matchmaking 無人可配 (中概率/高影響)    │
 響  │ 2. Token 與 VoxCPM 銷貨成本過載 (中概率/高影響)         │
 力  │ 3. AI 考官費曼評分幻覺引發用戶不滿 (高概率/中影響)       │
     │ 4. 用戶上傳 PDF 版權與 Safe Harbor 法律風險 (低概率/高影響)│
 低  │ 5. 數據隱私 GDPR / 學生數據安全合規 (低概率/中影響)     │
     └─────────────────────────────────────────────────────────┘
     低 ─────────────── 發生概率 (Probability) ─────────────── 高
```

---

## 2. 🛡️ 5 大風險詳細剖析與應對防禦方案 (Mitigation Strategies)

---

### 風險一：競技場冷啟動 Matchmaking 瓶頸 (Matchmaking Bottleneck)

#### 1. 客觀痛點
在平台日活用戶 (DAU) 未達 10,000 人前，用戶進入 PvP 競技場時，極可能面臨匹配佇列等待 > 30 秒甚至無人匹配的情況，導致體驗極度受損並造成流失。

#### 2. 防禦方案：影子 AI 對手 (Ghost AI Bots)
- **擬真 AI Bot 機制**：
  - 當 Matchmaking 等待時間超過 **3 秒** 時，系統自動觸發「影子 AI 對手 (Ghost Bot)」。
  - Ghost Bot 的作答速度與答題正確率由學員當前的 **Elo 積分** 動態決定（例如：黃金段位 Bot 答對率 75%，延遲 2.8 秒）。
  - 對戰介面不作刻意欺瞞，但保留流暢的競技節奏。

---

### 風險二：LLM 推理延遲與首頁 Wait Friction (Latency Risk)

#### 1. 客觀痛點
`RAG 檢索` + `Multi-Agent (Planner/Auditor)` 完整生成一個 6 節點課程需時約 30-60 秒。儘管使用了 SSE (Server-Sent Events) 進度推送，過長的等待時間仍會產生流失。

#### 2. 防禦方案：漸進式關卡渲染 (Progressive Lesson Rendering)
- **邊生成邊遊玩 (Stream-and-Play)**：
  - 前端發起請求後，後端一完成「診斷問卷」與「第 1 關卡」，即刻解鎖讓學員開始作答。
  - 後續第 2 至第 6 關卡以及 VoxCPM 語音在背景背景任務中並行生成。
  - 學員感知的**初始等待時間從 45 秒縮短至 3 秒內**。

---

### 風險三：AI 考官評分幻覺與爭議 (Hallucination & Scoring Friction)

#### 1. 客觀痛點
AI 考官在評估學員的「費曼鏡像 (Feynman Mirror)」文字回答時，可能因 Prompt 理解偏差或上下文斷裂，誤判學員答錯，給出不合理的零分。

#### 2. 防禦方案：申訴仲裁與補償機制 (Arbitration Protocol)
- **一鍵申訴按鈕 (One-Click Appeal)**：
  - 在關卡結算頁提供「申訴 AI 評分」按鈕。
- **後台自動二次評審 (Secondary Model Pass)**：
  - 申訴觸發後，系統利用高階模型 (Gemini Pro) 搭配更嚴謹的 Verification Prompt 進行二次審核。
- **用戶信任補償**：
  - 若申訴成功，系統自動返還扣除的 Credits，額外贈送 10 XP 經驗值，並將該爭議案例寫入 `prompt_feedback_logs` 以自我微調。

---

### 風險四：用戶上傳受版權保護 PDF (Copyright & Safe Harbor)

#### 1. 客觀痛點
用戶可能上傳受版權保護的教科書、付費電子書 PDF，並將產生的關卡公開分享，引發出版社著作權訴訟。

#### 2. 防禦方案：避風港條款與私有化沙盒 (Safe Harbor & Private Sandbox)
- **預設私有化 (Private by Default)**：
  - 所有由用戶上傳 PDF 生成的課程，預設權限為 **「僅個人可見 (Private Sandbox)」**。
- **DMCA 避風港條款 (DMCA Safe Harbor Protocol)**：
  - 只有通過內容檢核或用戶聲明具備版權的課程，方可公開至社群商城。
  - 建立明確的 DMCA 下架處理流程。

---

### 風險五：數據隱私與學生數據保護 (Privacy & GDPR Compliance)

#### 1. 客觀痛點
處理 K-12 學生或企業敏感 SOP 數據時，面臨嚴格的 GDPR 及 COPPA 隱私法規限制。

#### 2. 防禦方案：金融級數據隔離 (Enterprise Data Isolation)
- **零數據訓練聲明 (Zero Data Retention Guarantee)**：
  - 與 OpenAI / Google API 簽署企業條款，確保用戶上傳之 PDF 與學習記錄絕不被用於 LLM 基礎模型訓練。
- **PostgreSQL Ledger 金融級數據防護**：
  - 所有用戶資產與交易採用 JWT `HS256` 驗證與 `idempotency_key` 冪等保護，防止數據竄改。

---

## 🔗 外部參考資料
- [DMCA Safe Harbor Provisions (U.S. Copyright Office)](https://www.copyright.gov/)
- [EU General Data Protection Regulation (GDPR) Official Text](https://gdpr-info.eu/)
- [OpenAI Enterprise Data Privacy & Security Terms](https://openai.com/enterprise-privacy)
