from fastapi import HTTPException
from typing import Any, Dict, Optional


class Learn8Exception(HTTPException):
    """Learn8 自定義錯誤的基礎類別。"""

    def __init__(
        self,
        status_code: int = 500,
        detail: Any = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class LLMGenerationError(Learn8Exception):
    """當 LLM 提供者無法產生有效回應時拋出。"""

    def __init__(self, detail: str = "LLM generation failed"):
        super().__init__(
            status_code=502, detail=detail
        )  # Bad Gateway: 下游 AI 服務失敗


class DocumentParseError(Learn8Exception):
    """當解析文件 (PDF, TXT 等) 失敗時拋出。"""

    def __init__(self, detail: str = "Failed to parse document content"):
        super().__init__(status_code=422, detail=detail)  # 無法處理的實體


class RAGIndexingError(Learn8Exception):
    """當將文件寫入向量資料庫失敗時拋出。"""

    def __init__(self, detail: str = "Failed to index document in vector store"):
        super().__init__(status_code=500, detail=detail)
