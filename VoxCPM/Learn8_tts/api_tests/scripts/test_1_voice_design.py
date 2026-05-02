import httpx
import asyncio
import os

api_url = "http://127.0.0.1:8000/v1/audio/speech"

# 確保輸出目錄存在
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../outputs"))
os.makedirs(output_dir, exist_ok=True)

payload = {
    "text": "矮油，不錯哦",
    "control": "周杰倫的聲音，普通話", # 聲音設計描述
    "cfg_value": 2.0,
    "inference_timesteps": 10
}

async def main():
    print("正在發送 模式 1：聲音設計 請求...")
    async with httpx.AsyncClient() as client:
        response = await client.post(api_url, json=payload, timeout=60.0)
        if response.status_code == 200:
            output_file = os.path.join(output_dir, "output_1_voice_design.wav")
            with open(output_file, "wb") as f:
                f.write(response.content)
            print(f"✅ 成功！聲音設計音檔已儲存至：{output_file}")
        else:
            print(f"❌ 失敗：HTTP {response.status_code}, {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
