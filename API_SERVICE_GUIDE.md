# 🎧 VoxCPM API 微服務啟動與使用指南

本文檔詳細說明如何啟動並使用基於 **FastAPI** 封裝的 **VoxCPM 語音合成微服務**。此微服務整合了多種音訊合成模式、非同步推論佇列（Async Inference Queueing）、完整推論參數控制、以及動態開關降噪模組功能。

---

## 🛠️ 1. 啟動微服務

### 1.1 環境準備與依賴安裝

如果您已經在專案目錄下透過 `uv` 或 `python` 設定過 `.venv`，可直接跳過此步。

#### 若是在全新的伺服器環境部署：

* **使用 `uv` 啟動並解析（推薦）**
  ```bash
  uv sync
  ```
* **使用 `pip` 獨立安裝**
  ```bash
  pip install -e .
  pip install uvicorn fastapi pydantic soundfile librosa httpx
  ```

---

### 1.2 環境變數設定 (Environment Variables)

您可以透過下列環境變數，精準控制啟動行為與推論環境：

| 環境變數 | 預設值 | 說明 |
| :--- | :--- | :--- |
| **`HOST`** | `0.0.0.0` | 服務綁定的 IP 位址。 |
| **`PORT`** | `8000` | 服務監聽的連接埠（Port）。 |
| **`VOXCPM_MODEL_ID`** | `openbmb/VoxCPM2` | 載入的模型名稱或本機權重目錄路徑。 |
| **`VOXCPM_LOAD_DENOISER`** | `False` | 是否預先載入降噪模型。在無外網或欲加速啟動時，請保持為 `False`。 |
| **`VOXCPM_OPTIMIZE`** | `True` | 是否啟用 `torch.compile` 加速。 |
| **`VOXCPM_DEVICE`** | `null` | 指定推論硬體（如：`cuda`, `mps`, `cpu`），預設為自動偵測最優硬體。 |

---

### 1.3 啟動指令範例

#### 💡 方式一：直接透過現有的 `.venv` 執行（最快）
```bash
.venv/bin/python api.py
```

#### 💡 方式二：使用 `uv` 執行（自動偵測與載入環境）
```bash
uv run python api.py
```

#### 💡 方式三：指定環境變數與 Port 啟動：
```bash
HOST=127.0.0.1 PORT=8001 VOXCPM_LOAD_DENOISER=False uv run python api.py
```

---

## 📡 2. API 端點說明

### 2.1 檢查服務狀態 (`GET /health`)

用於主動測試 API 服務是否正常運作，並查看當前微服務執行於何種硬體（如 CUDA、MPS 或 CPU）。

* **請求網址**：`http://127.0.0.1:8000/health`
* **回應範例**：
  ```json
  {
    "status": "ok",
    "device": "cuda"
  }
  ```

---

### 2.2 語音合成與克隆 (`POST /v1/audio/speech`)

此端點支援 **聲音設計（Voice Design）**、**可控克隆（Controllable Cloning）**、以及 **極致克隆（Ultimate Cloning）** 三大模式。

* **請求網址**：`http://127.0.0.1:8000/v1/audio/speech`
* **Content-Type**：`application/json`
* **回應格式**：直接返回二進位 `audio/wav` 檔案串流。

#### 📥 Payload 完整參數列表：

| 參數名稱 | 類型 | 預設值 | 是否必填 | 功能說明 |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `str` | - | **是** | 要合成朗讀的目標文字內容。 |
| `control` | `str` | `null` | 否 | **聲音設計/語氣風格控制**：用自然語言描述聲音特性（如：`"中年男性，語速緩慢"`）。 |
| `reference_wav_path` | `str` | `null` | 否 | **克隆用參考音檔**：提供您要克隆的本地參考音檔絕對路徑（支援 `.m4a`, `.wav` 等格式）。 |
| `prompt_text` | `str` | `null` | 否 | **極致克隆模式專用**：傳入參考音檔內實際上唸出的文字（ASR 的文字結果）。 |
| `cfg_value` | `float` | `2.0` | 否 | **Classifier-Free Guidance (CFG)**：引導強度，數值越高越貼近參考音色，建議 `1.0 ~ 3.0`。 |
| `inference_timesteps`| `int` | `10` | 否 | **推論流匹配迭代步數**：越高音質可能越佳，但耗時變長，一般推薦 `10 ~ 25`。 |
| `normalize` | `bool` | `true` | 否 | **文本標準化**：自動處理並標準化數字、日期。 |
| `denoise` | `bool` | `true` | 否 | **參考音訊降噪**：推論前是否對參考音訊進行 ZipEnhancer 降噪。 |
| `min_len` | `int` | `2` | 否 | 生成音訊的最小 token 長度，用來防止生成過短音訊。 |
| `max_len` | `int` | `4096` | 否 | 生成音訊的最大 token 長度，避免記憶體溢出。 |
| `retry_badcase` | `bool` | `true` | 否 | 生成音訊若發生 Bad Case（時長嚴重不符等）時是否自動重新推論。 |
| `retry_badcase_max_times` | `int` | `3` | 否 | Bad Case 自動重新推論嘗試次數。 |
| `retry_badcase_ratio_threshold` | `float`| `6.0` | 否 | 判斷生成長度是否為 Bad Case 的音訊對文字字數比例閾值。 |

---

## 🐍 3. 調用 API 範例 (Python Requests)

以下提供使用 Python 的 `requests` 庫調用微服務的範例，分為**最簡參數**與**完整參數**兩大類。

---

### 3.1 最簡參數範例

適合快速測試與整合，僅傳入必要參數，其餘參數皆自動套用微服務預設值。

#### 範例 A：聲音設計 (Voice Design)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是聲音設計模式最簡參數生成的語音。",
    "control": "年輕女性，聲音溫柔甜美"
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("voice_design_min.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 voice_design_min.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```

#### 範例 B：聲音克隆 (Voice Cloning)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是聲音克隆最簡參數生成的語音。",
    "reference_wav_path": "/Users/kaigiii/Coding/VoxCPM/新生路.m4a"
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("voice_cloning_min.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 voice_cloning_min.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```

#### 範例 C：極致克隆 (Ultimate Cloning)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是極致克隆最簡參數生成的下一句話。",
    "reference_wav_path": "/Users/kaigiii/Coding/VoxCPM/新生路.m4a",
    "prompt_text": "其實我跟大家一樣啊，我覺得自己就是非常平凡，只是學了點音樂而已啊..."
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("ultimate_cloning_min.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 ultimate_cloning_min.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```

---

### 3.2 完整參數範例

顯式傳入所有支援的進階推論參數，精準調整輸出。

#### 範例 A：聲音設計 (Voice Design)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是聲音設計模式完整參數生成的語音。",
    "control": "年輕女性，聲音低沉陰冷，語速緩慢",
    "reference_wav_path": None,
    "prompt_text": None,
    "cfg_value": 2.0,
    "inference_timesteps": 10,
    "normalize": True,
    "denoise": True,
    "min_len": 2,
    "max_len": 4096,
    "retry_badcase": True,
    "retry_badcase_max_times": 3,
    "retry_badcase_ratio_threshold": 6.0
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("voice_design_full.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 voice_design_full.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```

#### 範例 B：聲音克隆 (Voice Cloning)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是聲音克隆完整參數生成的語音。",
    "control": "開朗大笑，加快語速",
    "reference_wav_path": "/Users/kaigiii/Coding/VoxCPM/新生路.m4a",
    "prompt_text": None,
    "cfg_value": 2.0,
    "inference_timesteps": 10,
    "normalize": True,
    "denoise": True,
    "min_len": 2,
    "max_len": 4096,
    "retry_badcase": True,
    "retry_badcase_max_times": 3,
    "retry_badcase_ratio_threshold": 6.0
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("voice_cloning_full.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 voice_cloning_full.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```

#### 範例 C：極致克隆 (Ultimate Cloning)
```python
import requests

url = "http://127.0.0.1:8000/v1/audio/speech"
payload = {
    "text": "這是極致克隆模式完整參數生成的下一句話。",
    "control": None,
    "reference_wav_path": "/Users/kaigiii/Coding/VoxCPM/新生路.m4a",
    "prompt_text": "其實我跟大家一樣啊，我覺得自己就是非常平凡，只是學了點音樂而已啊，學這些音樂呢最後能夠在這個舞台演講也不容易啊，因為我沒有考上大學，但是我跟你們演講你們會會得有奇怪方文也過小學而不過他的東西能夠到教材裡面這是來點掌聲呢所我覺得厲害的人啊，我覺得不平凡的人並不是練多我覺得他要一技之本呢也要聽媽媽的話，師重那時希望我考上音樂系，然後大學考兩次。我，且打球不知道自己心裡是怎麼搞的對可能就有一種運動細胞吧。。",
    "cfg_value": 2.0,
    "inference_timesteps": 10,
    "normalize": True,
    "denoise": True,
    "min_len": 2,
    "max_len": 4096,
    "retry_badcase": True,
    "retry_badcase_max_times": 3,
    "retry_badcase_ratio_threshold": 6.0
}

response = requests.post(url, json=payload, timeout=180)
if response.status_code == 200:
    with open("ultimate_cloning_full.wav", "wb") as f:
        f.write(response.content)
    print("✅ 成功！音檔已儲存為 ultimate_cloning_full.wav")
else:
    print(f"❌ 錯誤: {response.status_code}, {response.text}")
```
