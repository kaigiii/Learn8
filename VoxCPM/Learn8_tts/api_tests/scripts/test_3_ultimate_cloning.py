import httpx
import asyncio
import os

api_url = "http://127.0.0.1:8000/v1/audio/speech"

# 確保輸出目錄存在
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../outputs"))
os.makedirs(output_dir, exist_ok=True)

# 獲取專案根目錄的 test_output.wav 當作參考音檔
ref_wav = "/Users/kaigiii/Coding/VoxCPM/新生路.m4a"
ref_transcript = "其實我跟大家一樣啊，我覺得自己就是非常平凡，只是學了點音樂而已啊，學這些音樂呢最後能夠在這個舞台演講也不容易啊，因為我沒有考上大學，但是我跟你們演講你們會會得有奇怪方文也過小學而不過他的東西能夠到教材裡面這是來點掌聲呢所我覺得厲害的人啊，我覺得不平凡的人並不是練多我覺得他要一技之本呢也要聽媽媽的話，師重那時希望我考上音樂系，然後大學考兩次。我，且打球不知道自己心裡是怎麼搞的對可能就有一種運動細胞吧。。"

payload = {
    "text": "這是極致克隆模式生成的下一句話，模型會把參考音檔當作前文直接接續，完美保留呼吸聲與語調。",
    "reference_wav_path": ref_wav,
    "prompt_text": ref_transcript,
    "cfg_value": 2.0,
    "inference_timesteps": 10
}

async def main():
    if not os.path.exists(ref_wav):
        print(f"找不到參考音檔：{ref_wav}，請先確認專案根目錄有 test_output.wav。")
        return

    print("正在發送 模式 3：極致克隆 請求...")
    async with httpx.AsyncClient() as client:
        response = await client.post(api_url, json=payload, timeout=180.0)
        if response.status_code == 200:
            output_file = os.path.join(output_dir, "output_3_ultimate_cloning.wav")
            with open(output_file, "wb") as f:
                f.write(response.content)
            print(f"✅ 成功！極致克隆音檔已儲存至：{output_file}")
        else:
            print(f"❌ 失敗：HTTP {response.status_code}, {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
