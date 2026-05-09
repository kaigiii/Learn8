# 🎧 VoxCPM 語音合成微服務指南 (Dedicated Service Guide)

VoxCPM 是 Learn8 平台的音訊引擎核心，負責將文字轉化為具備情感與自然語氣的 AI 助教音訊。它不僅僅是 TTS (Text-to-Speech)，更是賦予平台**靈魂與個性**的關鍵組件。

---

## 🌟 0. 產品價值與 UX 亮點 (Product Value)

語音合成技術在教育產品中扮演著建立信任與降低認知負荷的角色：

- **人性化互動感 (Human-Centric Interaction)**：透過高品質的音色克隆，AI 助教不再是機械化的播報員，而是像朋友一樣溫柔鼓勵、像導師一樣清晰叮嚀。這種情感連結能顯著提升學員的學習耐性。
- **聽覺式學習優化 (Audio-Visual Learning)**：文字與語音的同步呈現（如：關卡中的朗讀功能）能同時刺激多個感官，幫助學員在碎片化時間（如通勤時）也能透過聽覺進行複習。
- **多樣化的人格設定 (Vocal Personalities)**：系統提供「溫柔姐姐」、「嚴謹導師」、「活力夥伴」等多種預設音色，學員可以根據自己的喜好切換助教個性，打造專屬的學習氛圍。

---

## 💥 1. 技術亮點與克隆模式

VoxCPM 提供了三種不同層次的音訊生成能力：

- **聲音設計 (Voice Design)**：透過文字描述（如「成熟男性的聲音」）動態控制音色。
- **可控克隆 (Controllable Cloning)**：結合參考音檔與文字描述，精準微調語氣。
- **極致克隆 (Ultimate Cloning)**：完全提取參考音檔的生物特徵，實現 1:1 的高擬真度復刻。

---

## 🏗️ 2. 環境變數與部署配置

啟動 VoxCPM 微服務時，可透過以下環境變數進行性能調優：

| 環境變數 | 預設值 | 說明 |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | 服務綁定的 IP 位址 |
| `PORT` | `15060` | 服務監聽的連接埠 |
| `VOXCPM_MODEL_ID` | `openbmb/VoxCPM2` | 預設模型 ID 或本機權重路徑 |
| `VOXCPM_LOAD_DENOISER`| `False` | 是否預載降噪模型以提升音質 |
| `VOXCPM_OPTIMIZE` | `True` | 是否啟用 `torch.compile` (需要 PyTorch 2.0+) |
| `DEVICE` | `cuda` | 運算設備 (`cuda`, `mps`, 或 `cpu`) |

---

## 📡 3. 核心 API 規格

### 3.1 語音合成 (`POST /v1/audio/speech`)

這是 Learn8 後端最常調用的端點，用於生成課程朗讀。

#### 📥 Payload 完整參數：
```json
{
  "text": "Hello, welcome to your personalized learning journey.",
  "control": "年輕女性，聲音溫柔且清晰",
  "reference_wav_path": "/app/data/presets/wise_tutor.wav",
  "cfg_value": 2.0,
  "inference_timesteps": 15,
  "normalize": true,
  "denoise": true
}
```

#### 📤 回應：
- **成功 (200)**：返回音訊流 (Content-Type: `audio/wav`)。
- **失敗 (4xx/5xx)**：返回 JSON 格式的錯誤訊息。

---

## 📂 4. 資源目錄管理

為了確保音色的一致性，VoxCPM 依賴於 `backend/data/` 下的特定目錄：

- **`presets/`**：存放官方預設的助教 WAV 檔。
- **`uploads/audio_cache/`**：存放已生成的語音片段，避免重複運算造成的延遲與資源浪費。

---

## 📋 5. 最佳實踐與優化

1.  **非同步預生成**：Learn8 後端會在課程生成完畢後，立即發起批次 Job 調用 VoxCPM，確保學員點進關卡時音檔已在快取中。
2.  **音訊標準化**：建議開啟 `normalize=true`，以確保不同音源生成的音量保持一致，避免損害學員聽覺體驗。
3.  **GPU 加速**：在生產環境中，建議至少配備 8GB 顯存的 NVIDIA GPU 以獲得秒級的生成速度。
