from typing import Optional
from app.core.config import settings
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.services.ai_engine.clients.google_adapter import GoogleLLMProvider
from app.services.ai_engine.clients.mock_adapter import MockLLMProvider


class LLMFactory:
    @staticmethod
    def create() -> BaseLLMProvider:
        provider = settings.LLM_PROVIDER.lower()
        if provider == "lmstudio":
            print("[LLMFactory] Using LMStudioProvider")
            return LMStudioProvider()
        elif provider == "mock":
            print("[LLMFactory] Using MockLLMProvider (Offline Mode)")
            return MockLLMProvider()

        print("[LLMFactory] Using GoogleLLMProvider")
        return GoogleLLMProvider()

    @staticmethod
    def create_vision_provider() -> BaseLLMProvider:
        provider = settings.VISION_LLM_PROVIDER.lower()
        if provider == "lmstudio":
            print("[LLMFactory] Using LMStudioProvider for Vision processing")
            return LMStudioProvider()
        elif provider == "mock":
            print("[LLMFactory] Using MockLLMProvider for Vision processing")
            return MockLLMProvider()

        print("[LLMFactory] Using GoogleLLMProvider for Vision processing")
        return GoogleLLMProvider()


# FastAPI Dependencies
def get_llm_provider() -> BaseLLMProvider:
    """Dependency injects the configured default LLM Provider."""
    return LLMFactory.create()


def get_vision_llm_provider() -> BaseLLMProvider:
    """Dependency injects the configured Vision LLM Provider."""
    return LLMFactory.create_vision_provider()
