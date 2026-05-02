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