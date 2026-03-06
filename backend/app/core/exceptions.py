from fastapi import HTTPException
from typing import Any, Dict, Optional

class Learn8Exception(HTTPException):
    """Base exception for Learn8 custom errors."""
    def __init__(self, status_code: int = 500, detail: Any = None, headers: Optional[Dict[str, str]] = None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)

class LLMGenerationError(Learn8Exception):
    """Raised when the LLM provider fails to generate a valid response."""
    def __init__(self, detail: str = "LLM generation failed"):
        super().__init__(status_code=502, detail=detail) # Bad Gateway indicates failure from downstream AI service

class DocumentParseError(Learn8Exception):
    """Raised when parsing a document (PDF, TXT, etc.) fails."""
    def __init__(self, detail: str = "Failed to parse document content"):
        super().__init__(status_code=422, detail=detail) # Unprocessable Entity

class RAGIndexingError(Learn8Exception):
    """Raised when ingesting documents into the vector database fails."""
    def __init__(self, detail: str = "Failed to index document in vector store"):
        super().__init__(status_code=500, detail=detail)
