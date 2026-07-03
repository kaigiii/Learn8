import httpx
import hashlib
import os
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from app.api.dependencies import get_current_user
from app.core.config import settings
from app.models.user import UserModel
from app.services.domain.course.audio import AudioService

router = APIRouter()

@router.get("/speech")
async def get_cloned_speech(
    text: str = Query(..., description="要朗讀的題目文字內容"),
    preset: str = Query("preset_01", description="選用的助教音色編號"),
    current_user: UserModel = Depends(get_current_user),
):
    content = await AudioService.get_or_generate_speech(text, preset)
    return StreamingResponse(iter([content]), media_type="audio/wav")

async def pregenerate_audio_cache(text: str, preset: str = "preset_01") -> str | None:
    return await AudioService.pregenerate_audio_cache(text, preset)

@router.post("/upload-preset")
async def upload_voice_preset_bridge(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
):
    """
    檔案傳輸橋樑：Learn8 將檔案轉發給 VoxCPM 進行聲音克隆註冊
    """
    if not settings.AUDIO_ENABLED:
        raise HTTPException(status_code=400, detail="語音功能已關閉。")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": (file.filename, await file.read(), file.content_type)}
            response = await client.post(settings.VOXCPM_UPLOAD_URL, files=files)
            
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
    if not settings.AUDIO_ENABLED:
        raise HTTPException(status_code=400, detail="語音功能已關閉。")
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        asyncio.create_task(AudioService.batch_pregenerate_all(db))
        return {"status": "ok", "message": "正在後台補建音檔快取中..."}
    finally:
        db.close()

@router.post("/clear-cache")
async def clear_audio_cache(
    current_user: UserModel = Depends(get_current_user),
):
    """
    清除音檔快取
    """
    try:
        AudioService.clear_cache()
        return {"status": "ok", "message": "音檔快取已完全清除"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除快取失敗: {str(e)}")

