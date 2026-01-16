
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
