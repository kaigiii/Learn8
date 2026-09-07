# 📘 白皮書 03：算力成本、Token 銷貨模型與定價白皮書 (Financial & Unit Economics)

*專案：Learn8 (AI-Native Adaptive Micro-learning & Gamification Engine)*  
*文檔類型：財務模型與算力成本優化白皮書 | 關聯文檔：[docs/market/README.md](./README.md)*

---

## 1. 💰 算力與銷貨成本 (COGS) 結構拆解

在 AI 原生 SaaS 中，銷貨成本 (COGS, Cost of Goods Sold) 的控管直接決定了產品能否跨越從 MVP 到規模化 (Scale-up) 的死亡之谷。

```
[Learn8 單次完整學習 Session 成本結構]
├── 1. LLM API Token 成本 (大綱生成 + 診斷題 + 費曼評量)       ~ 58%
├── 2. VoxCPM TTS 語音推論 GPU 成本 (PyTorch Inference)       ~ 24%
├── 3. ChromaDB 向量檢索與 Storage 成本                        ~ 10%
└── 4. Cloud Infrastructure (PostgreSQL / Redis / SSE 流量)    ~ 8%
```

---

## 2. 🔬 單次課程生成與遊玩成本精算 (Unit Cost Breakdown)

假設以每堂課程包含 **1 個主題大綱 (3 個單元/6 個節點)**、**3 道診斷題** 與 **6 關互動評測 (含費曼論述)** 為基準：

### 2.1 LLM Token 消耗精算
- **階段一：大綱規劃與審核 (Planner & Auditor 多輪對話)**
  - Input/Output Tokens: ~12,000 Tokens (使用高階模型如 Gemini 1.5 Pro / GPT-4o).
  - 成本：~$0.045 美元。
- **階段二：診斷題與關卡內容生成**
  - Input/Output Tokens: ~18,000 Tokens (使用中階/輕量模型如 Gemini 1.5 Flash).
  - 成本：~$0.009 美元。
- **階段三：費曼鏡像 (Feynman Mirror) 學員回答評分 (假設遊玩 6 關)**
  - Input/Output Tokens: ~15,000 Tokens (使用 Gemini 1.5 Flash).
  - 成本：~$0.008 美元。

### 2.2 VoxCPM TTS 音訊生成成本
- 假設 6 關卡共包含 12 句高擬真 AI 助教語音（總時長 120 秒）：
  - 採用自建 GPU (Nvidia A10G / RTX 4090) 實時推論：單次 Session 算力成本約 **$0.012 美元**。

### 2.3 單次 Session 總銷貨成本 (COGS Summary)
👉 **單次完整課程生成與遊玩成本 = $0.045 + $0.009 + $0.008 + $0.012 = $0.074 美元 (約 NT$2.4 元)**。

---

## 3. 📉 4 大邊際成本降本方案 (Cost Optimization Strategies)

為了確保 Learn8 達到 **70%+ 的健康 SaaS 毛利率**，必須執行以下降本機制：

```mermaid
graph TD
    A[用戶發起生成/請求] --> B{快取命中?}
    B -- 是 (Hit) --> C[從 Redis / CDN 讀取: 0 Token 成本]
    B -- 否 (Miss) --> D{任務類型?}
    D -- 大綱審核 Auditor --> E[使用高階模型: Gemini Pro / GPT-4o]
    D -- 題型評分 / 診斷 --> F[使用輕量模型: Gemini Flash / Haiku]
    E --> G[結果寫入快取 (Semantic Cache)]
    F --> G
```

1. **雙軌模型分流 (Model Tiering Strategy)**：
   - 核心邏輯（多代理人大綱審核 `Auditor`）使用高階模型。
   - 選擇題生成與常規費曼評分切換至輕量級模型（如 Gemini 1.5 Flash / Claude 3.5 Haiku），可**將 LLM 成本降低 65%**。
2. **語意檢索快取 (Semantic Cache)**：
   - 針對熱門主題（如「Python 變數與資料型態」、「AWS S3 基礎」），將已產生的知識地圖與題目快取至 Redis。再次請求時直接命中，**Token 成本歸零**。
3. **VoxCPM TTS 多級 CDN 快取**：
   - 通用引導語與標準答案語音預先生成並快取至 Cloudflare CDN，僅客製化費曼回饋進行實時 TTS 生成，**GPU 推理成本降低 80%**。
4. **非同步 Job 佇列批次化 (Batch Processing)**：
   - 使用背景 Job 佇列合組小批次（Mini-batch）請求，提升 GPU 記憶體使用率。

---

## 4. 🏷️ 定價模型與點數帳本經濟學 (Pricing & Credit Ledger)

Learn8 採用 **「Freemium 雙軌點數與訂閱制 (Hybrid Subscription & Credit Ledger)」**：

```
                    ┌─────────────────────────────────────────┐
                    │      Learn8 雙軌商業定價體系            │
                    └────────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
    【B2C 個人學習者訂閱與點數】                    【B2B 企業/機構授權】
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │ 1. Free Tier (免費層)     │                   │ 1. Team Plan ($9.99/Seat) │
   │    - 每日贈送 50 Credits   │                   │    - 包含 20 人內部團隊帳號 │
   │    - 免費體驗基礎關卡     │                   │    - 一鍵匯入企業 SOP PDF │
   ├───────────────────────────┤                   ├───────────────────────────┤
   │ 2. Pro Tier ($14.99/月)   │                   │ 2. Enterprise Custom      │
   │    - 每月 2,000 Credits   │                   │    - 私有化部署 / 專屬 GPU│
   │    - 無限次 AI 大綱生成   │                   │    - LMS (SCORM/LTI) 串接  │
   │    - 優先 VoxCPM 語音推論 │                   └───────────────────────────┘
   ├───────────────────────────┤
   │ 3. Credit Packs (點數包)  │
   │    - $4.99 / 500 Credits  │
   │    - $19.99 / 2,500 Credits│
   └───────────────────────────┘
```

### 4.1 點數帳本 (Ledger Economy) 消費精算

| 操作項目 | 點數消耗 (Credits) | 估算實際成本 (COGS) | 毛利率 (Margin) |
| :--- | :--- | :--- | :--- |
| **一鍵生成完整課程 (含 6 關卡)** | 50 Credits | ~$0.074 美元 | ~70.4% |
| **發起一次 Elo 天梯即時對戰** | 10 Credits | ~$0.015 美元 | ~70.0% |
| **解鎖進階 VoxCPM 音色克隆** | 30 Credits | ~$0.012 美元 | ~80.0% |
| **Fork 好友/創作者沙盒課程** | 20 Credits (10 分潤給創作者) | ~$0.005 美元 | ~75.0% |

---

## 5. 📊 LTV / CAC 財務模型預估 (LTV & CAC Projection)

### 5.1 關鍵指標預估 (基於 B2C Pro 訂閱 $14.99/月)
- **CAC (顧客取得成本)**：預估 **$18.50 美元**（透過 PLG 內容行銷與社交對戰分享降低獲客成本）。
- **月退訂率 (Monthly Churn)**：預估 **6.5%**（由於 Elo 天梯賽與個人帳本等級鎖定，留存高於一般 AI 工具）。
- **平均用戶生命週期 (Customer Lifetime)** = `1 / 0.065` ≈ **15.4 個月**。
- **LTV (顧客終身價值)** = `$14.99 * 72% (毛利率) * 15.4` ≈ **$166.20 美元**。
- **LTV / CAC 比率** = `$166.20 / $18.50` ≈ **8.98x**（遠高於健康 SaaS 的 3.0x 門檻）。

---

## 🔗 外部參考資料
- [a16z: The New Business Models of Generative AI](https://a16z.com/)
- [OpenView 2024 SaaS Benchmarks & Unit Economics](https://openviewpartners.com/)
- [Cloudflare Workers & AI Inference Cost Analysis](https://www.cloudflare.com/)
