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
- 人機互動決策模擬：提示、降階、換題、短休息與恢復學習。
- 每次介入的原因、門檻、使用者選擇與介入後效果。
- 以現有實驗 CSV 進行離線 replay 的能力。
- 明顯的 `MOCK` 標示。

### 3.2 不包含

- Web Bluetooth 或 Muse 2 BLE 連線。
- Python signal monitor 的 Web API 化。
- 即時 LLM 呼叫。
- 模型訓練、模型上線或準確度宣稱。
- 將腦波資料寫入 Learn8 資料庫。
- 在現有正式課程中直接改題、跳題、扣分、加分或控制 AI Tutor。第一階段只在隔離的 mock lesson sandbox 模擬介入。
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
8. **Interaction Simulator**
   - 顯示系統準備採取的介入、觸發原因與倒數
   - 可接受、延後、拒絕或關閉自動調整
   - 對照介入前後的狀態變化

### 4.2 課程頁 Overlay（第二個掛載點）

課程頁只顯示低干擾資訊：

- 連線／訊號品質
- 目前狀態文字
- 最近 30 秒趨勢
- 展開詳細資料的按鈕

Overlay 不可遮擋教材、答題按鈕或 AI Tutor；小螢幕預設收合。第一版可先保留掛載介面，待獨立 Data Lab 驗收後再啟用。

### 4.3 核心 UX 概念：Neuro Link

整體體驗不應像醫院儀器，也不應把使用者丟進滿是折線圖的工程 dashboard。建議將 Muse 2 包裝成 Learn8 世界中的 **Neuro Link／專注連線**：使用者戴上頭帶後，Learn8 的角色、教材與環境逐步「感應」到學習狀態。

視覺語言沿用 Learn8 現有圓角、白色玻璃卡、teal、green、coral 與角色系統：

- `brand-teal`：連線、校準、平靜的系統回饋。
- `brand-green`：狀態穩定、完成校準、恢復專注。
- `brand-coral`：需要注意或可能疲勞；避免使用強烈紅色警報。
- 白色半透明卡：保留 Learn8 輕鬆、非醫療的感覺。
- 波形不是獨立裝飾，而是會流入進度條、角色光環與背景粒子，形成「系統正在感知」的連續敘事。

### 4.4 完整 UX Journey

| Moment | 使用者看到什麼 | 使用者能做什麼 | 系統目的 |
|---|---|---|---|
| 進入課程前 | `使用 Neuro Link` 的選用卡片 | 開始模擬連線、略過 | 明確自願，不強迫使用 |
| 搜尋裝置 | 頭帶輪廓由虛線逐步被掃描 | 取消、選擇 mock scenario | 建立期待，說明目前為模擬 |
| 佩戴引導 | 全畫面角色示範戴上頭帶，四個接觸點依序亮起 | 下一步、重播動畫、略過 | 把抽象電極位置變得可理解 |
| 接觸校準 | 頭部圖示上的 TP9/AF7/AF8/TP10 由灰轉 teal/green | 查看某接點提示、重新校準 | 讓「訊號品質」具體化 |
| 建立 baseline | 呼吸般的圓環與 10–15 秒倒數 | 保持放鬆、取消 | 建立個人基準而非立即判斷 |
| 進入學習 | 校準圓環縮成右上角 Neuro Orb | 展開、靜音提醒、關閉 | 平順進入課程，不突然消失 |
| 穩定學習 | Orb 緩慢呼吸，進度條有低調波紋 | 不需操作 | 讓狀態存在但不搶注意力 |
| 分心／受挫 | 先以角色表情、卡片邊緣與微文案柔和提示 | 接受提示、稍後、忽略 | 採最低必要介入 |
| 換題 | 原題縮成卡片保留在一側，替代題從另一側滑入 | 接受替代題、留在原題 | 不製造「被系統強制趕走」感 |
| 休息 | 教材淡出為低刺激休息場景 | 2 分鐘、做完再休息、今天不提醒 | 休息不是失敗，而是學習策略 |
| 回到課程 | 快速重新校準，原學習目標重新浮現 | 繼續、改用簡單模式 | 保持任務連續性 |
| 結束 session | 專注時間軸與「哪些介入有幫助」摘要 | 查看詳情、關閉 | 強調反思，不給健康評分 |

### 4.5 連線與佩戴動畫：Neuro Link Onboarding

這是最能建立產品記憶點的場景，建議使用 4 個連續 scene，而不是一個普通 loading modal。

#### Scene A：尋找頭帶

- 課程地圖背景輕微失焦，中央浮出一個白色圓角舞台。
- Muse 頭帶以線稿輪廓出現；一道 teal 掃描光由左至右通過。
- 掃描時四條細波形從畫面邊緣向中央靠攏，但還沒有連接。
- 文案：`正在尋找你的 Neuro Link…`。
- Mock 模式在舞台右上角永久顯示 `SIMULATED`，不偽裝成真實硬體。

#### Scene B：佩戴示範

- 使用 Learn8 的貓頭鷹或目前登入角色作為示範者，而不是寫實頭模。
- 頭帶從角色頭頂上方落下，輕微彈性回彈後固定。
- 前額 AF7/AF8、耳後 TP9/TP10 依序出現柔和脈衝。
- 每亮起一個接點，就有一條細線連到旁邊的簡短提示：`貼合前額`、`避開頭髮`、`調整耳後位置`。
- 提供 `重播佩戴動畫` 與 `我已戴好`，不能只靠動畫結束自動前進。

#### Scene C：接觸品質校準

- 角色縮到左側；右側出現 4 個大型 channel pills。
- 每個 pill 依序呈現 `等待 → 偵測中 → 良好`。
- poor signal 時，不要整頁紅色閃爍；對應位置輕輕晃動，並顯示局部調整動作。
- 所有接點良好時，四條波形匯入中央 Neuro Orb，Orb 從空心變成實心 teal。

#### Scene D：建立個人基準

- Orb 擴張為柔和圓環，跟著 4 秒吸氣／4 秒吐氣節奏呼吸。
- 中央顯示短倒數與文案：`保持自然即可，不需要刻意專注。`
- 背景波形逐漸由不規則變得平穩，但不可暗示腦波真的被「控制」。
- 完成時圓環縮進課程頁右上角，進度條短暫閃過一條 teal 波紋，直接銜接第一題。

### 4.6 課程中的常駐元件：Neuro Orb

右上角、進度條末端適合放置一個 36–44px 的 Neuro Orb，因為現有課程頁頂部已包含離開按鈕、主進度條與 mobile tutor button。

Orb 的狀態：

| 狀態 | 視覺 | 點擊後 |
|---|---|---|
| connected/neutral | teal 外環緩慢呼吸 | 展開 30 秒趨勢與訊號品質 |
| focused | 外環略亮、波紋更規律 | 顯示「狀態穩定」，不額外讚美或打斷 |
| attention | coral 小缺口繞行，不閃爍 | 顯示可選建議 |
| poor signal | 外環斷成四段，問題 channel 呈灰色 | 顯示佩戴調整 mini guide |
| paused | 靜止、降低飽和度 | 顯示恢復按鈕 |

Orb 展開後使用 anchored popover，不使用中央 modal。Popover 只顯示：狀態趨勢、裝置品質、提醒模式與 `查看完整 Data Lab`。原始 EEG 圖表不應常駐在課程頁。

### 4.7 介入 UI：先融入教材，再出現選擇

介入不應一律使用 toast 或 modal。建議依層級使用不同載體：

| Level | UI 載體 | 動畫與行為 |
|---:|---|---|
| 0 | 無可見介入 | 只更新 Orb 與 timeline |
| 1 | Mascot micro-reaction | 角色從右側探頭 2 秒，顯示一句可忽略文字，不阻擋操作 |
| 2 | Inline support card | 在題目回饋區展開提示／圖解卡，不覆蓋題目 |
| 3 | Choice sheet | 從底部升起 2–3 個選項；背景不鎖死，使用者可關閉 |

Level 1 範例：角色輕輕敲一下對話框：`要不要把這段拆小一點？`

Level 2 範例：題目下方長出一張「換個角度」卡，先顯示一個具體例子，再提供 `我懂了`、`再簡單一點`。

Level 3 範例：底部 choice sheet 顯示：

- `換成圖像題`
- `先看一個簡單例子`
- `留在這一題`

介入原因放在可展開的 `為什麼出現這個建議？`，不要直接寫「你的腦波顯示你很挫折」。建議文案：`你在這個步驟停留了一段時間，而且剛剛有一次答錯。系統正在模擬較適合的呈現方式。`

### 4.8 換題轉場：保留方向感

換題時不能直接 replace 整個畫面，否則使用者容易感到被懲罰或失去進度。

建議轉場：

1. 原題卡縮小到左後方，保留題號與 `稍後回來` 標籤。
2. 中央出現一條短路徑，標示共同 learning objective。
3. 替代題從右側滑入，顯示 `同一概念・另一種方式`。
4. 答對替代題後，兩張卡以線條連起來，詢問要回原題確認或繼續。

這個動畫讓使用者理解自己沒有退級，也沒有遺失原本進度。

### 4.9 休息模式：從學習場景自然退場

休息不應是一個冷冰冰的 timer modal。建議：

- 教材卡向下淡出，但頁面主背景仍保留，避免像離開 Learn8。
- 角色坐到畫面中央，頭帶仍在但燈光降低。
- Neuro Orb 擴張成呼吸圈，顯示 2 分鐘環形計時。
- 提供三種低刺激內容：看遠方、肩頸伸展、自然呼吸；不做遊戲化連點。
- 隨時可按 `提早回來`。
- 返回時先顯示 10–15 秒 mini calibration，再把原題或替代題從下方帶回。

### 4.10 訊號中斷與錯誤復原

BLE／mock stream 中斷時，教材不要整頁消失：

- Neuro Orb 變為分段灰環。
- 頂部出現非阻塞提示：`Neuro Link 暫時中斷，學習可以繼續。`
- 所有自適應介入立即停止，但答題流程維持正常。
- 點開後用簡化頭部圖指出可能鬆脫的位置。
- 重新連線成功後只顯示短暫 `已恢復`，不重新播放完整 onboarding；若中斷超過門檻才做 mini calibration。

這能清楚表達「腦波是加值層，不是 Learn8 的單點故障」。

### 4.11 Session 結束：互動成效回顧

結果頁不提供單一「腦力分數」。改用一條可理解的 journey：

- 穩定學習區段。
- 系統何時提出提示／替代題／休息。
- 使用者接受或拒絕了什麼。
- 介入後是否 `helped / no_change / made_worse`。
- 一句中性摘要：`圖像化提示後，你較快回到題目；休息提醒被略過。`

避免排行榜、紅綠評分或把 EEG 指標轉成個人能力標籤。

### 4.12 Data Lab 的展示模式

Data Lab 建議提供雙視圖：

1. **Learner View**：完整模擬使用者看見的 onboarding、課程介入與休息動畫。
2. **Operator View**：右側同步顯示 raw mock metrics、threshold、state、proposal、cooldown 與事件 log。

兩者共用同一 scenario clock。外包驗收或展示時，可以在 Operator View 點選 `持續分心`、`答錯`、`疲勞`、`訊號鬆脫`，左側立即播放對應 UX，而不是只看 dashboard 數字變化。

### 4.13 Motion 與感官原則

- 預設動畫長度 180–500ms；佩戴 onboarding 可使用 700–1200ms 的敘事動畫。
- 所有狀態動畫必須可 seek、可重播，scenario reset 後回到相同畫面。
- 不使用高頻閃爍、劇烈震動或紅色全屏警告。
- 專注狀態不做強烈慶祝，以免反而打斷專注。
- `prefers-reduced-motion` 下，佩戴與換題動畫改為分步淡入，保留資訊但移除大幅位移。
- 音效預設關閉；若啟用，只在連線完成與使用者主動接受介入時播放柔和提示音。

### 4.14 素材與實作位置建議

第一版優先使用 CSS、SVG 與 Framer Motion，避免導入大型動畫 runtime。建議素材：

- Muse 頭帶簡化 SVG，可分別控制外框與四個接點。
- Learn8 貓頭鷹／登入角色的「佩戴頭帶」狀態圖。
- 頭部接點位置 SVG。
- Neuro Orb SVG／CSS component。
- 波形 path 與流動粒子。

建議元件拆分：

```text
frontend/src/features/neuro-mock/components/
  onboarding/
    NeuroConnectStage.tsx
    WearablePlacementScene.tsx
    ContactCalibrationScene.tsx
    BaselineScene.tsx
  lesson/
    NeuroOrb.tsx
    NeuroPopover.tsx
    AdaptiveNudge.tsx
    InterventionChoiceSheet.tsx
    QuestionSwapTransition.tsx
    NeuroBreakMode.tsx
  lab/
    LearnerPreview.tsx
    OperatorConsole.tsx
    ScenarioTransport.tsx
  summary/
    InterventionJourney.tsx
```

與 Learn8 現有畫面的建議掛載位置：

- 課程開始前：利用現有 immersive status 區域呈現 Neuro Link onboarding。
- 課程頂部：在 `TopProgressBar` 後方加入 optional `NeuroOrb` slot。
- 題目介入：由 `LessonStageRenderer` 外層的 optional overlay/inline slot 顯示，不修改各題型 component。
- 右側 Tutor：只顯示 intervention explanation，不把 EEG dashboard 塞入聊天訊息。
- 結果頁：增加 optional `InterventionJourney` section，不改既有分數計算。

視覺資產需要另行設計；若未來建立 moodboard 或角色佩戴頭帶的概念圖，再使用 image generation。實作階段應優先產出 SVG／元件化版本，保持清晰、可動畫與可換色。

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

正式 Learn8 整合時只允許 Learn8 把事件送入 mock 模組；mock 模組不得直接反向呼叫課程 action。mock lesson sandbox 可透過另一個明確的 `InterventionPort` 模擬換題等行為，避免展示邏輯與正式課程 store 耦合。

### 6.3 介入建議契約

狀態判斷不能直接等同於操作。決策層必須先產生一筆可檢查、可拒絕的介入建議：

```ts
type NeuroInterventionProposal = {
  id: string;
  timestampMs: number;
  level: 0 | 1 | 2 | 3;
  action:
    | "observe"
    | "soft_nudge"
    | "offer_hint"
    | "simplify_explanation"
    | "change_question"
    | "suggest_break"
    | "pause_for_signal";
  reasonCode: string;
  evidenceWindowSeconds: number;
  evidence: Array<{
    metric: string;
    value: number | string;
    baseline?: number;
    threshold?: number;
  }>;
  mode: "silent" | "ask-first" | "automatic";
  expiresAtMs: number;
};
```

執行結果另記為 `accepted`、`declined`、`dismissed`、`expired` 或 `auto-applied`，以便呈現使用者是否接受系統幫助，以及介入是否真的改善後續狀態。

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

### 7.4 人機互動閉環

Mock 的核心展示流程應是：

```text
感測訊號
  → 通過品質檢查
  → 與個人 baseline 比較
  → 結合答題與停留時間等學習事件
  → 形成狀態假設
  → 選擇最低必要介入
  → 讓使用者接受、拒絕或延後
  → 觀察介入後 20–60 秒是否改善
  → 維持、升級或停止介入
```

系統目的不是看到低數值就立刻打斷，而是使用最低干擾的方法幫助學習者回到可學習狀態。

### 7.5 介入層級

| Level | 介入程度 | 適用條件 | 範例 |
|---:|---|---|---|
| 0 | 只觀察 | 訊號短暫波動，或證據不足 | 不改畫面，只記錄趨勢 |
| 1 | 輕提示 | 分心持續但尚未答錯 | 動態角色提醒「我們換個節奏？」 |
| 2 | 學習支援 | 分心／受挫持續，並有答錯或提示事件 | 提供提示、拆小步驟、切換圖像解釋 |
| 3 | 流程調整 | 多次支援後仍未恢復，或明顯疲勞 | 詢問是否換題、降階或休息 |

介入從 Level 0 逐級升高，不能從單一 EEG frame 直接跳到換題或中止學習。

### 7.6 建議門檻與觸發規則

門檻全部建立在校準後的 0–100 normalized score 與個人 baseline 上；以下是 mock 展示預設值，不是醫療或科學判定標準。

| 情境 | 必要證據 | 最短持續 | 建議介入 |
|---|---|---:|---|
| 短暫分心 | engagement 低於 baseline 15 點 | 10 秒 | Level 0，只觀察 |
| 持續分心 | engagement 低於 baseline 20 點 | 25 秒 | Level 1，輕提示 |
| 可能受挫 | approach 低於 baseline 20 點，且 90 秒內至少一次答錯 | 15 秒 | Level 2，提供提示或換解釋 |
| 題目不適配 | Level 2 已介入、再答錯一次，且狀態 30 秒未恢復 | 30 秒 | Level 3，詢問換同目標的替代題 |
| 可能疲勞 | fatigue 高於 70，且 engagement 低於 35 | 45 秒 | Level 3，提示 2–5 分鐘休息 |
| 嚴重疲勞 | 疲勞條件持續，且使用者已完成至少 15 分鐘學習 | 90 秒 | 建議暫停；仍由使用者決定 |
| 訊號不良 | quality gate 未通過 | 3 秒 | 暫停推論，只提示調整裝置 |
| 恢復 | engagement 回到 baseline ±10，品質良好 | 20 秒 | 解除提示並進入冷卻期 |

額外限制：

- 至少兩種證據才可觸發 Level 2/3，例如生理趨勢加答題事件。
- `poor_signal`、分頁切到背景、lesson paused 時不累積認知狀態門檻。
- 同一題前 10 秒不判斷分心，避免把閱讀題幹誤認為低投入。
- 答題後 5 秒內不立即介入，讓使用者先閱讀回饋。

### 7.7 換題不是跳過學習目標

「更換題目」應維持相同 learning objective，只更換呈現形式或難度，而不是把不會的內容直接略過。

優先順序：

1. 原題增加一個小提示。
2. 把題目拆成較小步驟。
3. 從文字切換成圖像、例子或互動操作。
4. 換成同概念、較低難度的替代題。
5. 暫存原題，完成替代題後再回來確認理解。

Mock lesson sandbox 應展示「原題 → 介入原因 → 替代題 → 是否恢復 → 是否回到原學習目標」的完整過程。

### 7.8 休息提示設計

休息提示不應像錯誤警報。建議提供三個選項：

- `休息 2 分鐘`
- `完成這題再休息`
- `今天不要再提醒`

接受休息後，畫面進入低刺激模式、停止題目倒數，並顯示簡單呼吸／伸展提示；返回時重新做 10–15 秒快速 baseline，而不是沿用休息前狀態。

### 7.9 使用者控制權與自動化模式

Mock Data Lab 應能切換三種策略，比較人機互動差異：

| 模式 | 系統權限 | 適合展示 |
|---|---|---|
| `Observe` | 只觀察與記錄，不打斷 | 對照組、建立信任 |
| `Assist` | 提示、換解釋、換題、休息都先詢問 | 建議作為產品預設 |
| `Adaptive Demo` | Level 1/2 可自動執行；換題與休息仍需確認 | 展示閉環自適應能力 |

即使在 Adaptive Demo，系統也不能自動結束課程、扣分或將題目標為完成。

### 7.10 冷卻、抑制與防打擾

- Level 1 介入後至少 45 秒不重複提醒。
- Level 2 介入後至少觀察 30 秒再決定是否升級。
- Level 3 被拒絕後，至少 3 分鐘不再提出同類建議。
- 每 10 分鐘最多兩次主動打斷。
- 使用者連續拒絕兩次後，本 session 自動降為 Observe。
- 狀態恢復時不以彈窗慶祝，只在狀態卡安靜顯示「已恢復」。

### 7.11 介入效果評估

每次介入都比較介入前後的固定觀察窗：

- 前窗：介入前 30 秒。
- 後窗：介入後 30–60 秒。
- 指標：engagement 變化、approach 變化、答題結果、使用者是否拒絕。

Mock 應能展示三種結果：

- `helped`：狀態改善或完成學習目標。
- `no_change`：沒有明顯效果，維持觀察或升級。
- `made_worse`：狀態惡化，停止同類介入並把控制權交還使用者。

這讓產品重點從「AI 說使用者分心」轉成「系統採取什麼行動，以及該行動是否真的有幫助」。

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
- 單一指標或單一瞬間不得直接觸發換題或休息。
- Level 2/3 介入必須能追溯至少兩項證據。
- 介入被拒絕後必須遵守 cooldown，不可反覆詢問。
- 介入不得自動改變分數、完成狀態或學習進度。

### 12.4 人機互動

- 可分別重播 `helped`、`no_change`、`made_worse` 三種介入結果。
- Assist 模式下，換題與休息必須先取得使用者確認。
- 使用者能查看「為什麼出現這個建議」。
- 使用者可關閉本次 session 的自動調整。
- 替代題保持相同 learning objective，且能回到原學習目標。
- 休息返回後重新校準，不沿用休息前 baseline。

### 12.5 UI

- Desktop、tablet、mobile 均不溢出。
- prefers-reduced-motion 下關閉高頻動畫。
- mock 標示不可被收合或隱藏。
- 獨立頁可完成播放、暫停、重播、倍速與情境切換。
- onboarding 可完整走過搜尋、佩戴、接點校準與 baseline 四個 scene。
- 每個佩戴步驟都能手動前進、重播或略過，不依賴動畫自動完成。
- Neuro Orb 在 neutral、attention、poor-signal、paused 狀態都有可辨識但不干擾的視覺。
- 換題轉場保留原題、共同 learning objective 與返回路徑。
- 休息模式能提早返回，且返回後播放 mini calibration。
- stream 中斷時課程仍可答題，且自適應介入停止。
- Learner View 與 Operator View 使用相同 scenario clock。
- 所有狀態不能只靠顏色表達，需同時具備文字、形狀或 icon 差異。

### 12.6 效能

- 波形使用固定長度 ring buffer。
- 不讓 React 每秒建立 256 次全頁 render。
- 離開頁面後 subscription、timer、worker 全部清除。

---

## 13. 分階段交付

### Phase 0：規格凍結

- 確認本文件、命名、資料契約、免責文字與 Data Lab wireframe。
- 不寫產品程式。

### Phase 1：Standalone Data Lab

- 建立 feature 目錄、synthetic source、scenario engine、interaction simulator 與獨立頁。
- 完成 Learner View／Operator View，以及連線、佩戴、校準、baseline 的 UX prototype。
- 不接現有課程流程。

### Phase 2：Replay 與事件時間軸

- 加入經處理的 CSV replay fixture。
- 加入 mock learning events 與規則式 AI summary。
- 加入 mock lesson sandbox，展示提示、換解釋、替代題、休息與恢復閉環。
- 完成 Neuro Orb、漸進式介入、換題轉場與休息模式。

### Phase 3：Optional Lesson Widget

- 以 feature flag 與 lazy loading 接入課程頁。
- 初期只讀取公開事件並輸出 intervention proposal，不直接改課程 state。
- 只有在獨立 sandbox 驗收後，才評估由正式課程 host 主動接受 proposal。

### Phase 4：未來實機 Proof of Concept（不在本次範圍）

- Python local gateway 將 BLE/分析結果轉成統一 frame。
- 新增 `MuseGatewaySource`，保持 UI 與資料契約不變。

---

## 14. 外包交付物清單

外包團隊必須提供：

- 資料契約與所有型別。
- Scenario 定義與 seed 說明。
- Data Lab 響應式頁面。
- Neuro Link onboarding 的四個可重播 scene。
- Learn8 角色佩戴頭帶、四接點位置與 Neuro Orb 的 SVG／可動畫素材。
- Learner View 與 Operator View 的同步展示。
- Synthetic 與 CSV replay source。
- Rule engine 與文案表。
- 介入層級、門檻、cooldown 與使用者控制策略。
- 可替換題目、提示及休息流程的 mock lesson sandbox。
- 每次介入的 audit log 與效果比較畫面。
- 單元、整合與清理測試。
- 功能旗標與停用說明。
- 無障礙與效能檢查結果。
- desktop、tablet、mobile 與 reduced-motion 的 UI 驗收紀錄。
- 各主要流程的互動 prototype 或錄影：佩戴、校準、介入、換題、休息、中斷恢復。
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
8. 可完整展示「持續分心 → 輕提示 → 仍未恢復 → 提供提示／替代題 → 狀態恢復」流程。
9. 可完整展示疲勞時的休息建議、拒絕、冷卻與返回後重新校準。
10. 每次介入都能查看觸發證據、使用者決定與介入後結果。
11. 可完整展示「連接 → 佩戴動畫 → 四接點校準 → baseline → 進入第一題」且過程可略過或重播。
12. 換題時使用者能理解原題仍被保留，並知道替代題與原題屬於相同學習目標。
13. 訊號中斷時 Learn8 仍可正常作答，重新連線不會遺失目前題目。
14. Data Lab 可同步顯示 Learner View 的 UX 與 Operator View 的觸發證據。

---

## 16. 本次決策摘要

- 先做獨立 Data Lab，再考慮課程頁 widget。
- 第一版保持純前端 mock-only。
- AI 使用規則模板，不生成底層數據。
- 使用統一 data-source contract，預留未來實機替換。
- 優先採用相對 baseline、時間趨勢與品質 gate。
- 產品主軸是人機互動閉環，不是單純腦波 dashboard。
- UI/UX 主敘事是 Neuro Link：從佩戴動畫、接點校準一路自然縮成課程中的 Neuro Orb。
- Data Lab 採 Learner／Operator 雙視圖，讓動畫體驗與底層觸發原因能同時驗證。
- 採漸進式介入；提示優先於換題，換題與休息保留使用者決定權。
- 每次介入都要可解釋、可拒絕、可冷卻，並評估是否真正改善學習狀態。
- 不碰資料庫、後端模型與現有課程狀態機。
