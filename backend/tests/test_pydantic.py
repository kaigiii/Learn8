from pydantic.v1 import BaseSettings, validator
from typing import Optional

class Settings(BaseSettings):
    chroma_api_impl: str = "chromadb.api.rust.RustBindingsAPI"
    
    @validator("chroma_server_nofile", pre=True, always=True, allow_reuse=True)
    def empty_str_to_none(cls, v: str) -> Optional[str]:
        return v
        
    chroma_server_nofile: Optional[int] = None

print("Success!")
