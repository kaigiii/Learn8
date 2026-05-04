import httpx
import hashlib
import os
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from app.api.dependencies import get_current_user
from app.models.user import UserModel

router = APIRouter()

VOXCPM_URL = os.getenv("VOXCPM_URL", "http://127.0.0.1:15060/v1/audio/speech")
VOXCPM_UPLOAD_URL = os.getenv("VOXCPM_UPLOAD_URL", "http://127.0.0.1:15060/v1/audio/upload")

VOICE_PRESETS = {
    "preset_01": os.path.join(os.getcwd(), "data", "presets", "gentle_sister.wav"),
    "preset_02": os.path.join(os.getcwd(), "data", "presets", "wise_tutor.wav"),
    "preset_03": os.path.join(os.getcwd(), "data", "presets", "energetic_partner.wav"),
    "preset_04": os.path.join(os.getcwd(), "data", "presets", "calm_ai.wav"),
    "preset_05": os.path.join(os.getcwd(), "data", "presets", "warm_uncle.wav")
}

@router.get("/speech")
async def get_cloned_speech(
    text: str = Query(..., description="要朗讀的題目文字內容"),
    preset: str = Query("preset_01", description="選用的助教音色編號"),
    current_user: UserModel = Depends(get_current_user),
):
    """
    透過固定參考音檔（Voice Cloning）向微服務請求生成音訊（具備伺服器端音檔快取功能）
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="文字內容不可為空")

    # 1. 產生音檔快取檔案名稱的 Hash 值
    hasher = hashlib.md5()
    hasher.update(f"{text.strip()}:{preset}".encode("utf-8"))
    cache_id = hasher.hexdigest()
    
    cache_dir = os.path.join(os.getcwd(), "data", "uploads", "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = os.path.join(cache_dir, f"{cache_id}.wav")

    # 2. 如果已有快取，直接讀取並回傳
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "rb") as f:
                content = f.read()
            return StreamingResponse(
                iter([content]), 
                media_type="audio/wav"
            )
        except Exception:
            pass

    # 3. 如果沒有快取，發送推論請求給 VoxCPM
    if preset.startswith("data/uploads/") or preset.startswith("uploads/") or preset.endswith(".wav") or preset.endswith(".mp3"):
        if not os.path.isabs(preset):
            ref_path = os.path.join(os.getcwd(), preset)
        else:
            ref_path = preset
    else:
        ref_path = VOICE_PRESETS.get(preset, VOICE_PRESETS["preset_01"])

    payload = {
        "text": text,
        "reference_wav_path": ref_path,
        "cfg_value": 2.0,
        "inference_timesteps": 15,
        "denoise": True
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(VOXCPM_URL, json=payload, timeout=180.0)
            
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"語音合成服務錯誤: {response.status_code}")
            
        # 將結果儲存進快取
        with open(cache_path, "wb") as f:
            f.write(response.content)

        return StreamingResponse(
            iter([response.content]), 
            media_type="audio/wav"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"語音微服務連線失敗: {str(e)}")

async def pregenerate_audio_cache(text: str, preset: str = "preset_01") -> str | None:
    """
    非同步預建單元音檔快取
    """
    if not text or not text.strip():
        return None

    hasher = hashlib.md5()
    hasher.update(f"{text.strip()}:{preset}".encode("utf-8"))
    cache_id = hasher.hexdigest()
    
    cache_dir = os.path.join(os.getcwd(), "data", "uploads", "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = os.path.join(cache_dir, f"{cache_id}.wav")

    if os.path.exists(cache_path):
        return cache_path

    if preset.startswith("data/uploads/") or preset.startswith("uploads/") or preset.endswith(".wav") or preset.endswith(".mp3"):
        if not os.path.isabs(preset):
            ref_path = os.path.join(os.getcwd(), preset)
        else:
            ref_path = preset
    else:
        ref_path = VOICE_PRESETS.get(preset, VOICE_PRESETS["preset_01"])
    payload = {
        "text": text,
        "reference_wav_path": ref_path,
        "cfg_value": 2.0,
        "inference_timesteps": 15,
        "denoise": True
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(VOXCPM_URL, json=payload, timeout=180.0)
            
        if response.status_code == 200:
            with open(cache_path, "wb") as f:
                f.write(response.content)
            return cache_path
    except Exception as e:
        print(f"Pregenerate audio cache failed for: {text}, error: {str(e)}")
        
    return None

@router.post("/upload-preset")
async def upload_voice_preset_bridge(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
):
    """
    檔案傳輸橋樑：Learn8 將檔案轉發給 VoxCPM 進行聲音克隆註冊
    """
    try:
        async with httpx.AsyncClient() as client:
            files = {"file": (file.filename, await file.read(), file.content_type)}
            response = await client.post(VOXCPM_UPLOAD_URL, files=files, timeout=60.0)
            
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"VoxCPM 檔案上傳失敗: {response.status_code}")
            
        return response.json()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"微服務連線失敗: {str(e)}")

@router.post("/batch-pregenerate")
async def batch_pregenerate_audios(
    current_user: UserModel = Depends(get_current_user),
):
    """
    批次補建歷史關卡音檔
    """
    from app.db.session import SessionLocal
    from app.models.lesson import LessonModel
    import asyncio
    
    db = SessionLocal()
    try:
        lessons = db.query(LessonModel).filter(LessonModel.status == "generated").all()
        texts = set()
        
        from app.core.component_loader import registry as component_registry

        for lesson in lessons:
            stages = getattr(lesson, "stages", []) or []
            for s in stages:
                content = getattr(s, "content_json", None) or getattr(s, "config_json", None) or getattr(s, "config", None)
                if hasattr(content, "data"):
                    data = content.data
                elif isinstance(content, dict):
                    data = content.get("data", {}) if "data" in content else content
                else:
                    data = {}

                if not isinstance(data, dict):
                    data = {}

                comp = component_registry.get_component(getattr(s, "component", ""))
                voice_targets = comp.get("voice_targets") if comp else None
                if not voice_targets:
                    voice_targets = ["question", "prompt", "text"]

                extracted_texts = []
                for field in voice_targets:
                    if field in data and isinstance(data[field], str) and data[field].strip():
                        extracted_texts.append(data[field].strip())

                text = " ".join(extracted_texts).strip()
                if not text:
                    text = data.get("question") or data.get("prompt") or data.get("text") or data.get("explanation") or getattr(s, "topic", "")

                if text:
                    texts.add(text)

        async def _run_batch(txts):
            for txt in txts:
                for preset_id in ["preset_01", "preset_02", "preset_03", "preset_04", "preset_05"]:
                    try:
                        await pregenerate_audio_cache(txt, preset_id)
                    except Exception:
                        pass
                    await asyncio.sleep(0.1)
                    
        asyncio.create_task(_run_batch(list(texts)))
        return {"status": "ok", "message": f"正在為 {len(texts)} 個不重複題目非同步補建音檔快取中..."}
        
    finally:
        db.close()

@router.post("/clear-cache")
async def clear_audio_cache(
    current_user: UserModel = Depends(get_current_user),
):
    """
    清除音檔快取
    """
    import shutil
    cache_dir = os.path.join(os.getcwd(), "data", "uploads", "audio_cache")
    if os.path.exists(cache_dir):
        try:
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir, exist_ok=True)
            return {"status": "ok", "message": "音檔快取已完全清除"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"清除快取失敗: {str(e)}")
    return {"status": "ok", "message": "音檔快取目錄本就為空"}

