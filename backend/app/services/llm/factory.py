
from typing import Optional
from app.core.config import settings
from app.services.llm.base import BaseLLMProvider
from app.services.llm.google_adapter import GoogleLLMProvider
from app.services.llm.local_adapter import FreeGeminiLLMProvider
from app.services.llm.mock_adapter import MockLLMProvider

class LLMFactory:
    @staticmethod
    def create() -> BaseLLMProvider:
        if settings.LLM_PROVIDER == "google" and settings.GOOGLE_API_KEY:
            print("[LLMFactory] Using GoogleLLMProvider")
            return GoogleLLMProvider()
        elif settings.LLM_PROVIDER == "mock":
            print("[LLMFactory] Using MockLLMProvider")
            return MockLLMProvider()
        else:
            print(f"[LLMFactory] Using FreeGeminiLLMProvider (Config: {settings.LLM_PROVIDER})")
            return FreeGeminiLLMProvider()
