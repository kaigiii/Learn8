import os
import sys

# 將 VoxCPM 專案根目錄與 src 目錄加入 Python 的模組搜尋路徑中
_parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_src_dir = os.path.join(_parent_dir, "src")
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import torch
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import soundfile as sf
import io
import asyncio
import shutil

import voxcpm

app = FastAPI(
    title="VoxCPM API",
    description="Clean and straightforward FastAPI wrapper for VoxCPM2 with Async Lock queuing.",
    version="1.1.0"
)

model = None
inference_lock = asyncio.Lock()

def get_model():
    global model
    if model is None:
        model_id = os.environ.get("VOXCPM_MODEL_ID", "openbmb/VoxCPM2")
        load_denoiser = os.environ.get("VOXCPM_LOAD_DENOISER", "False").lower() == "true"
        optimize = os.environ.get("VOXCPM_OPTIMIZE", "True").lower() == "true"
        device = os.environ.get("VOXCPM_DEVICE", None)
        print(f"Loading VoxCPM model: {model_id} (load_denoiser={load_denoiser}, optimize={optimize}, device={device})")
        model = voxcpm.VoxCPM.from_pretrained(model_id, optimize=optimize, load_denoiser=load_denoiser, device=device)
        print("Model loaded successfully.")
    return model

class TTSRequest(BaseModel):
    text: str
    control: Optional[str] = None
    reference_wav_path: Optional[str] = None
    prompt_text: Optional[str] = None
    cfg_value: float = 2.0
    inference_timesteps: int = 10
    normalize: bool = True
    denoise: bool = True
    min_len: int = 2
    max_len: int = 4096
    retry_badcase: bool = True
    retry_badcase_max_times: int = 3
    retry_badcase_ratio_threshold: float = 6.0

@app.get("/health")
def health_check():
    """ 檢查服務是否正常運作 """
    return {"status": "ok", "device": "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")}

@app.post("/v1/audio/upload")
async def upload_reference_wav(file: UploadFile = File(...)):
    """ 
    接收來自後端轉發的檔案並儲存，回傳微服務伺服器端的儲存路徑 
    """
    try:
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads"))
        os.makedirs(uploads_dir, exist_ok=True)
        
        target_path = os.path.join(uploads_dir, file.filename)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"status": "ok", "saved_path": target_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"微服務上傳失敗: {str(e)}")

@app.post("/v1/audio/speech")
async def generate_speech(req: TTSRequest):
    """
    非同步排隊、安全推論生成語音並返回 WAV 音檔
    """
    async with inference_lock:
        try:
            current_model = get_model()
            
            # 將深度學習推論放到執行緒，避免阻塞事件迴圈
            def _inference():
                ref_path = req.reference_wav_path
                if ref_path and not os.path.exists(ref_path):
                    alt_paths = [
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "../examples/example.wav")),
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "../examples/reference_speaker.wav")),
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../examples/example.wav")),
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../examples/reference_speaker.wav")),
                    ]
                    for alt in alt_paths:
                        if os.path.exists(alt):
                            ref_path = alt
                            break
                    else:
                        ref_path = None

                ctrl = req.control
                if not ref_path and not ctrl:
                    ctrl = "溫柔、博學的中文女聲"

                final_text = req.text
                if ctrl:
                    final_text = f"({ctrl}){final_text}"

                print(f"Generating speech for text: '{final_text}' with ref: {ref_path}")
                return current_model.generate(
                    text=final_text,
                    reference_wav_path=ref_path,
                    prompt_wav_path=ref_path if req.prompt_text else None,
                    prompt_text=req.prompt_text,
                    cfg_value=req.cfg_value,
                    inference_timesteps=req.inference_timesteps,
                    normalize=req.normalize,
                    denoise=req.denoise,
                    min_len=req.min_len,
                    max_len=req.max_len,
                    retry_badcase=req.retry_badcase,
                    retry_badcase_max_times=req.retry_badcase_max_times,
                    retry_badcase_ratio_threshold=req.retry_badcase_ratio_threshold
                )

            wav = await asyncio.to_thread(_inference)

            # 將 numpy 陣列轉換為 WAV 格式字節流
            buffer = io.BytesIO()
            sf.write(buffer, wav, current_model.tts_model.sample_rate, format='WAV', subtype='PCM_16')
            buffer.seek(0)
            
            return Response(content=buffer.read(), media_type="audio/wav")

        except Exception as e:
            print(f"Generation error: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 15060))
    uvicorn.run(app, host=host, port=port)
