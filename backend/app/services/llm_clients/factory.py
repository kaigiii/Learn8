from typing import Optional
from app.core.config import settings
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.services.llm_clients.google_adapter import GoogleLLMProvider
from app.services.llm_clients.lmstudio_adapter import LMStudioProvider


class LLMFactory:
    @staticmethod
    def create() -> BaseLLMProvider:
        provider = settings.LLM_PROVIDER.lower()
        if provider == "lmstudio":
            print("[LLMFactory] Using LMStudioProvider")
            return LMStudioProvider()

        print("[LLMFactory] Using GoogleLLMProvider")
        return GoogleLLMProvider()

    @staticmethod
    def create_vision_provider() -> BaseLLMProvider:
        provider = settings.VISION_LLM_PROVIDER.lower()
        if provider == "lmstudio":
            print("[LLMFactory] Using LMStudioProvider for Vision processing")
            # In the future, LMStudioProvider can be customized if vision needs different handling
            return LMStudioProvider()

        print("[LLMFactory] Using GoogleLLMProvider for Vision processing")
        return GoogleLLMProvider()


# FastAPI Dependencies
def get_llm_provider() -> BaseLLMProvider:
    """Dependency injects the configured default LLM Provider."""
    return LLMFactory.create()


def get_vision_llm_provider() -> BaseLLMProvider:
    """Dependency injects the configured Vision LLM Provider."""
    return LLMFactory.create_vision_provider()
