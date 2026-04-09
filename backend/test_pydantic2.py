from pydantic.v1 import BaseSettings, validator
from typing import Optional

class Settings(BaseSettings):
    chroma_server_nofile: Optional[int] = None
    
    @validator("chroma_server_nofile", pre=True, always=True, allow_reuse=True)
    def empty_str_to_none(cls, v: str) -> Optional[str]:
        return v

print("Success!")
