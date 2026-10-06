# Learn8 AI × Muse 2 Mock 外掛導入規劃

## 1. 文件目的

本文件規劃一個 **mock-only、預設關閉、可獨立移除** 的腦波學習監控展示模組。

第一階段不連接 Muse 2、不部署既有 Python 模型、不新增資料庫表，也不改變 Learn8 現有課程、答題、AI Tutor、登入或計分流程。目標是先把產品體驗、資料契約與介面邊界驗證完整，讓未來無論是內部實作或交由外包團隊，都能依相同契約導入。

本文件中的「AI」只負責 mock 狀態摘要與建議文字；生理訊號和狀態轉換由可重現的 mock scenario engine 產生，不讓 LLM 任意生成數值。

---

## 2. 核心原則

1. **預設完全不影響 Learn8**：功能旗標關閉時，不載入 mock bundle、不執行 timer、不寫 storage、不顯示入口。
2. **外掛式導入**：模組集中在單一 feature 目錄，Learn8 僅保留極薄的掛載點。
3. **單向讀取學習事件**：mock 模組可以接收「答題、提示、換題」等事件，但不得修改課程 session 或答題結果。
4. **資料來源可替換**：UI 只依賴統一的 `NeuroDataSource`；mock、CSV replay、未來 Muse gateway 都實作同一介面。
5. **可重播、可測試**：相同 scenario、seed 與時間軸必須產生相同輸出。
6. **不做醫療或心理診斷**：所有文字使用「模擬」、「估計」、「趨勢」，不得描述為真實測量或診斷。
7. **訊號品質優先**：品質不良時停止輸出認知狀態結論。

---

## 3. 第一階段範圍

### 3.1 包含

- 獨立 AI Muse Mock Data 頁面。
- 課程頁可選的微型狀態卡掛載點。
- 4 通道假 EEG：TP9、AF7、AF8、TP10。
- EI、FAA、BPM、interest probability 與 signal quality。
- 預設情境、手動情境切換、播放、暫停、重播、倍速。
- 學習事件時間軸。
- 規則式 AI 摘要與建議。
- 以現有實驗 CSV 進行離線 replay 的能力。
- 明顯的 `MOCK` 標示。

### 3.2 不包含

- Web Bluetooth 或 Muse 2 BLE 連線。
- Python signal monitor 的 Web API 化。
- 即時 LLM 呼叫。
- 模型訓練、模型上線或準確度宣稱。
- 將腦波資料寫入 Learn8 資料庫。
- 自動改題、跳題、扣分、加分或控制 AI Tutor。
- 正式研究受測者流程、同意書或醫療用途。

---

## 4. 建議產品體驗

### 4.1 獨立 Mock Data Lab

建議先建立獨立路由 `/dev/neuro-monitor`，作為主要驗證場域。此路由不加入一般使用者導覽列。

畫面區塊：

1. **Session Header**
   - `MOCK SESSION` 標章
   - 模擬裝置名稱、連線狀態、256 Hz、已執行時間
   - scenario、seed、播放速度
2. **即時狀態摘要**
   - 專注趨勢
   - 情緒／趨近趨勢
   - 眨眼頻率
   - 綜合興趣機率
3. **四通道訊號區**
   - TP9、AF7、AF8、TP10 波形
   - 各通道品質
4. **狀態時間軸**
   - calibrating、focused、distracted、frustrated、recovered、fatigued、poor-signal
5. **Learning Event Timeline**
   - 顯示答對、答錯、提示、切換 stage 等 mock 事件
6. **AI Coach Summary**
   - 顯示由規則模板產生的狀態摘要與建議
7. **Scenario Controls**
   - 自動劇本與手動狀態注入

### 4.2 課程頁 Overlay（第二個掛載點）

課程頁只顯示低干擾資訊：

- 連線／訊號品質
- 目前狀態文字
- 最近 30 秒趨勢
- 展開詳細資料的按鈕

Overlay 不可遮擋教材、答題按鈕或 AI Tutor；小螢幕預設收合。第一版可先保留掛載介面，待獨立 Data Lab 驗收後再啟用。

---

## 5. 外掛式架構

建議將新模組限制在：

```text
frontend/src/features/neuro-mock/
  contract/        # 公開型別與 data-source interface
  engine/          # deterministic scenario engine
  sources/         # synthetic、CSV replay；未來可加 live gateway
  rules/           # 狀態判斷與文字模板
  components/      # 完整 dashboard 與 compact widget
  fixtures/        # 脫敏、裁切後的 mock/replay fixtures
  tests/
  index.ts          # 唯一公開出口
```

Learn8 核心只允許三種接點：

1. 一個獨立 route import。
2. 一個 feature flag。
3. 未來課程頁的一個 optional slot。

禁止 mock feature 直接 import Zustand lesson store 的內部操作；若要接收學習行為，只能透過公開的 event adapter。

### 5.1 功能旗標

預計使用：

```text
NEXT_PUBLIC_ENABLE_NEURO_MOCK=false
```

旗標未開啟時：

- route 回傳 not found 或開發功能未啟用頁。
- 課程頁不顯示元件。
- 不建立 interval、worker 或 EventSource。
- 不載入大型 fixture。

### 5.2 Data source 抽象

所有畫面只認得下列能力，不認得 mock 的實作細節：

```ts
interface NeuroDataSource {
  connect(options?: NeuroConnectOptions): Promise<void>;
  subscribe(listener: (frame: NeuroFrame) => void): () => void;
  pause(): void;
  resume(): void;
  reset(): void;
  disconnect(): Promise<void>;
  getMetadata(): NeuroSourceMetadata;
}
```

預計來源：

| Source | 第一階段 | 用途 |
|---|---:|---|
| `SyntheticScenarioSource` | 是 | 可控制、可重現的產品 demo |
| `CsvReplaySource` | 是 | 重播現有 Muse 實驗資料 |
| `MuseGatewaySource` | 否 | 未來由本機 Python gateway/WebSocket 提供實機資料 |

---

## 6. Mock Data 契約

### 6.1 即時 frame

```ts
type NeuroFrame = {
  schemaVersion: "1.0";
  sessionId: string;
  sequence: number;
  timestampMs: number;
  source: "synthetic" | "csv-replay" | "live";
  mock: boolean;
  connection: "connecting" | "connected" | "stalled" | "disconnected";
  signal: {
    sampleRateHz: 256;
    overallQuality: "good" | "fair" | "poor" | "unknown";
    channels: {
      TP9: NeuroChannelFrame;
      AF7: NeuroChannelFrame;
      AF8: NeuroChannelFrame;
      TP10: NeuroChannelFrame;
    };
  };
  metrics: {
    engagementIndex: number | null;
    frontalAlphaAsymmetry: number | null;
    blinkRatePerMinute: number | null;
    interestProbability: number | null;
  };
  normalized: {
    engagement: number | null;
    approach: number | null;
    fatigue: number | null;
  };
  inferredState: NeuroState;
  confidence: number | null;
  qualityGatePassed: boolean;
};
```

`NeuroChannelFrame` 至少包含最近一小段波形、RMS、峰峰值與品質。UI 顯示用的 normalized 值為 0–100，但必須同時保留 raw metric，避免把視覺百分比誤認為科學量測。

### 6.2 學習事件

```ts
type NeuroLearningEvent = {
  timestampMs: number;
  type:
    | "stage_viewed"
    | "answer_submitted"
    | "answer_correct"
    | "answer_incorrect"
    | "hint_requested"
    | "stage_changed"
    | "lesson_paused";
  stageId?: string;
  metadata?: Record<string, string | number | boolean>;
};
```

只允許 Learn8 把事件送入 mock 模組；mock 模組不得反向呼叫課程 action。

---

## 7. Scenario Engine

### 7.1 預設狀態

| State | 產品語意 | Mock 數據方向 | UI 行為 |
|---|---|---|---|
| `calibrating` | 建立個人基準 | 數值尚未穩定 | 中性色、顯示校準進度 |
| `focused` | 穩定投入 | EI/interest 上升 | 綠藍光暈、摘要為正向 |
| `distracted` | 注意力下降 | EI 下降 | 黃色提示、避免立即打擾 |
| `frustrated` | 可能受挫 | FAA 相對基準下降，搭配答錯事件 | 提議提示或替代解釋 |
| `recovered` | 狀態恢復 | 指標逐步回到 baseline 以上 | 淡出警示 |
| `fatigued` | 持續低投入／眨眼增加 | EI 下降、BPM 上升 | 建議短暫休息 |
| `poor_signal` | 訊號不可用 | RMS 或資料流異常 | 停止認知判讀、要求調整頭帶 |

### 7.2 預設展示腳本

建議 180 秒循環：

```text
0–15s    calibrating
15–55s   focused
55–80s   distracted
80–105s  frustrated + mock answer_incorrect
105–135s recovered + mock hint_requested
135–165s focused
165–180s poor_signal，之後恢復並循環
```

### 7.3 數值生成規則

- 使用 seeded pseudo-random generator。
- 指標採 target + easing + low-frequency noise，不使用每幀獨立亂數。
- EEG 波形由多個頻帶正弦、微量雜訊、眨眼脈衝與接觸雜訊合成。
- UI frame 建議 5–10 Hz；不需要在 React state 中模擬全部 256 個 sample/s。
- 分析指標每秒更新，顯示採 10 秒移動平均。
- 狀態切換需有 dwell time 與 hysteresis，避免門檻附近跳動。

---

## 8. AI Mock Summary

第一階段使用 template/rule engine，不呼叫外部模型。原因是可重現、零成本、離線可用，也能避免 AI 產生與數據矛盾的結論。

建議輸出結構：

```ts
type NeuroCoachInsight = {
  severity: "info" | "positive" | "attention";
  title: string;
  summary: string;
  evidence: string[];
  suggestion?: string;
  generatedBy: "mock-rule-engine";
};
```

範例：

> 模擬狀態顯示最近 20 秒投入趨勢下降，且剛發生連續答錯事件。可以考慮顯示提示，或把內容改成較小的步驟。

品質不良時只能輸出：

> 目前模擬訊號品質不足，暫停狀態判讀。請先調整頭帶接觸位置。

未來若接 LLM，LLM 只能改寫已由規則引擎產生的結構化結論，不得自行計算或改變狀態。

---

## 9. 現有資料的使用方式

現有 `muse2/Data` 與 `muse2/Model/*_Experiment` 可作為 replay 與合理範圍參考，但不直接把完整研究檔打包進瀏覽器。

導入前處理：

1. 確認資料授權與受測者同意範圍。
2. 移除檔名中的受測者識別語意。
3. 裁切少量代表片段。
4. 轉成前端 fixture 格式。
5. 在 metadata 中標記 `mock: true`、來源類型與不可用於診斷。

現有資料顯示不同受測者的 EI、FAA、BPM 差異很大，因此 UI 判斷應以 baseline、相對變化與持續時間為主，不採固定絕對門檻。

---

## 10. 與 Learn8 的整合邊界

### 10.1 第一階段允許改動

- 新增獨立 feature 目錄。
- 新增獨立 dev route。
- 新增環境變數範例與文件。
- 必要時新增一個不影響現有 API 的 optional event adapter。

### 10.2 第一階段禁止改動

- 現有 API response shape。
- 課程 session state machine。
- Zustand store schema。
- backend models、migration 與資料庫。
- AI Tutor prompt 與生成流程。
- 既有得分、XP、提示與 remedial 邏輯。

### 10.3 未來課程頁接入策略

Data Lab 驗收後，才在 `LessonSessionPageClient` 增加一個 lazy-loaded optional widget。widget 只接收序列化 props/event，不取得 store action。功能旗標關閉時應與目前 bundle 行為等價。

---

## 11. 隱私與產品措辭

- 所有 mock 畫面固定顯示 `SIMULATED DATA / 模擬資料`。
- 不使用「偵測你正在焦慮／罹患注意力問題」等措辭。
- 建議用「投入趨勢」、「可能需要休息」、「模擬訊號品質」。
- 不將 raw EEG、推論狀態或學習事件送到第三方。
- 若未來接實機，必須另行設計知情同意、保存期限、刪除機制與資料匯出政策。

---

## 12. 測試與驗收標準

### 12.1 隔離性

- 功能旗標關閉時，既有頁面視覺與操作無差異。
- 不新增任何背景請求、timer 或 local storage key。
- 移除 `features/neuro-mock` 與掛載點後，專案仍可建置。

### 12.2 決定性

- 相同 scenario + seed 產生相同時間軸與狀態。
- pause/resume 不造成 sequence 倒退。
- reset 後回到相同初始 frame。

### 12.3 狀態安全

- poor signal 時，metric 可顯示 raw/unknown，但不可產生 focused/frustrated 結論。
- 所有狀態切換符合 dwell time。
- AI 摘要證據必須與當下 frame/event 一致。

### 12.4 UI

- Desktop、tablet、mobile 均不溢出。
- prefers-reduced-motion 下關閉高頻動畫。
- mock 標示不可被收合或隱藏。
- 獨立頁可完成播放、暫停、重播、倍速與情境切換。

### 12.5 效能

- 波形使用固定長度 ring buffer。
- 不讓 React 每秒建立 256 次全頁 render。
- 離開頁面後 subscription、timer、worker 全部清除。

---

## 13. 分階段交付

### Phase 0：規格凍結

- 確認本文件、命名、資料契約、免責文字與 Data Lab wireframe。
- 不寫產品程式。

### Phase 1：Standalone Data Lab

- 建立 feature 目錄、synthetic source、scenario engine 與獨立頁。
- 不接現有課程流程。

### Phase 2：Replay 與事件時間軸

- 加入經處理的 CSV replay fixture。
- 加入 mock learning events 與規則式 AI summary。

### Phase 3：Optional Lesson Widget

- 以 feature flag 與 lazy loading 接入課程頁。
- 只讀取公開事件，不改課程 state。

### Phase 4：未來實機 Proof of Concept（不在本次範圍）

- Python local gateway 將 BLE/分析結果轉成統一 frame。
- 新增 `MuseGatewaySource`，保持 UI 與資料契約不變。

---

## 14. 外包交付物清單

外包團隊必須提供：

- 資料契約與所有型別。
- Scenario 定義與 seed 說明。
- Data Lab 響應式頁面。
- Synthetic 與 CSV replay source。
- Rule engine 與文案表。
- 單元、整合與清理測試。
- 功能旗標與停用說明。
- 無障礙與效能檢查結果。
- 一份「如何新增 scenario」文件。
- 一份「如何替換成 live source」文件。

不得交付：

- 散落在現有 Learn8 頁面的 mock 判斷邏輯。
- 直接修改 lesson store 的耦合實作。
- 未標示來源的生理數據或醫療式結論。
- 依賴外部 AI API 才能啟動的 demo。

---

## 15. 完成定義

本 mock 導入視為完成，必須同時滿足：

1. 使用者可在獨立頁完整觀看 3 分鐘情境循環。
2. 可手動切換所有狀態，並看到一致的波形、指標與摘要。
3. 可重播至少一段經處理的既有實驗資料。
4. 所有畫面清楚標示為模擬資料。
5. 功能旗標關閉時，Learn8 現有功能與網路行為無差異。
6. mock 模組可在不修改核心 domain logic 的前提下移除。
7. live Muse source 未完成也不影響本階段驗收。

---

## 16. 本次決策摘要

- 先做獨立 Data Lab，再考慮課程頁 widget。
- 第一版保持純前端 mock-only。
- AI 使用規則模板，不生成底層數據。
- 使用統一 data-source contract，預留未來實機替換。
- 優先採用相對 baseline、時間趨勢與品質 gate。
- 不碰資料庫、後端模型與現有課程狀態機。
