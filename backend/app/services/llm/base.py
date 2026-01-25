"""
模組名稱: app.services.llm.base
功能描述: LLM 供應商介面 (LLM Provider Interface)

定義了所有 LLM Provider 必須實作的抽象基底類別 (ABC)。
這使得系統可以隨意切換底層模型 (Google Gemini, OpenAI, Claude, Local LLM) 而不影響上層業務邏輯。

主要方法:
    1. bind_files(files): 綁定本地檔案 (主要用於 RAG 或 長文本功能)。
    2. generate_text(messages): 生成純文字回應。
    3. generate_structured(messages, schema): 生成符合 Pydantic Schema 的結構化 JSON 資料。
"""

from abc import ABC, abstractmethod
from typing import Any, List, Optional, Type
from pydantic import BaseModel

class BaseLLMProvider(ABC):
    @abstractmethod
    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        """Bind files to the LLM context (mostly for FreeGemini)."""
        pass

    @abstractmethod
    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        """Generate plain text from messages."""
        pass

    @abstractmethod
    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        """Generate structured data validating against a Pydantic schema."""
        pass
