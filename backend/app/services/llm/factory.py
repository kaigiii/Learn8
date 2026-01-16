"""
模組名稱: app.services.llm.factory
功能描述: LLM 供應商工廠 (LLM Provider Factory)

使用 Simple Factory 模式，根據環境變數 (LLM_PROVIDER) 動態實例化對應的 LLM Provider。

支援選項:
    - "google": 使用官方 Google Gemini API (LangChain 實作)。
    - "freegemini": 使用逆向工程/本地模擬的 FreeGemini 客戶端。
    - "mock": 使用 Mock 資料 (用於單元測試或無網路環境)。
"""

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
