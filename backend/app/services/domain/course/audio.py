import os
import httpx
import hashlib
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models.lesson import LessonModel

class AudioService:
    VOICE_PRESETS = {
        "preset_01": settings.PRESETS_DIR / "gentle_sister.wav",
        "preset_02": settings.PRESETS_DIR / "wise_tutor.wav",
        "preset_03": settings.PRESETS_DIR / "energetic_partner.wav",
        "preset_04": settings.PRESETS_DIR / "calm_ai.wav",
        "preset_05": settings.PRESETS_DIR / "warm_uncle.wav"
    }

    @staticmethod
    def get_cache_path(text: str, preset: str) -> Path:
        """計算並回傳音檔快取路徑。"""
        text_hash = hashlib.md5(text.encode("utf-8")).hexdigest()
        cache_filename = f"{preset}_{text_hash}.wav"
        cache_dir = settings.UPLOAD_DIR / "audio_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / cache_filename

    @staticmethod
    def resolve_reference_path(preset: str) -> Path:
        """解析參考音檔的路徑（預設音色或上傳檔案）。"""
        if preset.startswith("data/uploads/") or preset.startswith("uploads/") or preset.endswith(".wav") or preset.endswith(".mp3"):
            if not os.path.isabs(preset):
                return settings.BASE_DIR / preset
            return Path(preset)
        
        return AudioService.VOICE_PRESETS.get(preset, AudioService.VOICE_PRESETS["preset_01"])

    @staticmethod
    async def generate_speech(text: str, preset: str) -> bytes:
        """向 VoxCPM 請求語音合成並回傳音訊位元組。"""
        ref_path = AudioService.resolve_reference_path(preset)
        
        payload = {
            "text": text,
            "reference_wav_path": str(ref_path),
            "cfg_value": 2.0,
            "inference_timesteps": 15,
            "denoise": True
        }
        
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(settings.VOXCPM_URL, json=payload)
                
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"語音合成服務錯誤: {response.status_code}")
                
            return response.content
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"語音微服務連線失敗: {str(e)}")

    @staticmethod
    async def get_or_generate_speech(text: str, preset: str) -> bytes:
        """獲取快取或生成新的語音。"""
        if not text.strip():
            raise HTTPException(status_code=400, detail="文字內容不可為空")
            
        cache_path = AudioService.get_cache_path(text, preset)
        
        if cache_path.exists():
            try:
                return cache_path.read_bytes()
            except Exception:
                pass
                
        content = await AudioService.generate_speech(text, preset)
        
        # 寫入快取
        try:
            cache_path.write_bytes(content)
        except Exception as e:
            print(f"Failed to save audio cache: {e}")
            
        return content

    @staticmethod
    async def pregenerate_audio_cache(text: str, preset: str = "preset_01") -> Optional[str]:
        """非同步預建音檔快取，不拋出 HTTPException。"""
        if not text or not text.strip():
            return None
            
        try:
            await AudioService.get_or_generate_speech(text, preset)
            return str(AudioService.get_cache_path(text, preset))
        except Exception as e:
            print(f"Pregenerate audio cache failed: {e}")
            return None

    @staticmethod
    def extract_texts_from_lessons(db: Session) -> List[str]:
        """從資料庫課綱中提取需要朗讀的文字。"""
        from app.core.component_loader import registry as component_registry
        
        lessons = db.query(LessonModel).filter(LessonModel.status == "generated").all()
        texts = set()
        
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

                extracted = []
                for field in voice_targets:
                    if field in data and isinstance(data[field], str) and data[field].strip():
                        extracted.append(data[field].strip())

                text = " ".join(extracted).strip()
                if not text:
                    text = data.get("question") or data.get("prompt") or data.get("text") or data.get("explanation") or getattr(s, "topic", "")

                if text:
                    texts.add(text)
        
        return list(texts)

    @staticmethod
    async def batch_pregenerate_all(db: Session):
        """批次生成所有遺漏的快取。"""
        texts = AudioService.extract_texts_from_lessons(db)
        presets = ["preset_01", "preset_02", "preset_03", "preset_04", "preset_05"]
        
        for txt in texts:
            for p in presets:
                await AudioService.pregenerate_audio_cache(txt, p)
                await asyncio.sleep(0.1)

    @staticmethod
    def clear_cache():
        """完全清除音檔快取目錄。"""
        import shutil
        cache_dir = settings.UPLOAD_DIR / "audio_cache"
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
            cache_dir.mkdir(parents=True, exist_ok=True)
