import os
import requests

def main():
    presets_dir = os.path.join(os.getcwd(), "presets")
    os.makedirs(presets_dir, exist_ok=True)
    
    url = "http://127.0.0.1:15060/v1/audio/speech"
    
    presets = [
        {
            "filename": "gentle_sister.wav",
            "control": "年輕女性，聲音溫柔甜美、親切流暢、不疾不徐",
            "text": "親愛的朋友您好，歡迎來到學習的世界。我是您的語音助理溫柔大姐，我將會在每一個關卡陪伴著您，幫助您輕鬆理解課程中的所有重點，祝您學習愉快！"
        },
        {
            "filename": "wise_tutor.wav",
            "control": "中年男性，沉穩厚實、有智慧且專業，帶有信賴感",
            "text": "各位同學好。在學習的道路上，掌握核心概念是非常關鍵的。我是您的導讀助理智慧導師，我會帶領大家有條理地分析問題，相信透過我們的共同思考，您能學得更深入。"
        },
        {
            "filename": "energetic_partner.wav",
            "control": "年輕女性，聲音高昂清亮、富有朝氣、充滿活力熱情",
            "text": "嘿！大家好呀，我是您的活力夥伴！看到您在學習上如此投入，我真的很為您感到高興呢！讓我們一起元氣滿滿地挑戰接下來的每個任務，加油，您一定可以的！"
        },
        {
            "filename": "calm_ai.wav",
            "control": "中性聲線，說話語氣平穩中肯，語速均勻精準",
            "text": "系統已成功啟動。我是您的課程導航平平靜 AI。在接下來的學習模組中，我將以標準的速率為您播報問題與選項，協助您維持最佳的專注狀態。請準備開始。"
        },
        {
            "filename": "warm_uncle.wav",
            "control": "中年男性，嗓音沉厚溫暖、磁性且親切，說話語速適中",
            "text": "哈哈，大家好啊。我是您的導讀助理暖心大叔。別給自己太大的壓力，學習就像是探索新世界一樣，放輕鬆，遇到不會的問題沒關係，大叔我隨時都會在這裡陪著你。"
        }
    ]
    
    for p in presets:
        target_path = os.path.join(presets_dir, p["filename"])
        print(f"Generating for {p['filename']}...")
        payload = {
            "text": p["text"],
            "control": p["control"],
            "cfg_value": 2.0,
            "inference_timesteps": 12,
            "denoise": True
        }
        try:
            resp = requests.post(url, json=payload, timeout=60)
            if resp.status_code == 200:
                with open(target_path, "wb") as f:
                    f.write(resp.content)
                print(f"Successfully saved {p['filename']} to {target_path}")
            else:
                print(f"Failed for {p['filename']}: HTTP {resp.status_code}")
        except Exception as e:
            print(f"Error for {p['filename']}: {e}")

if __name__ == "__main__":
    main()
