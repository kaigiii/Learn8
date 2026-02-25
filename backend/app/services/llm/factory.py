"""
模組名稱: app.services.llm.factory
功能描述: LLM 供應商工廠 (LLM Provider Factory)

使用 Simple Factory 模式，根據環境變數 (LLM_PROVIDER) 動態實例化對應的 LLM Provider。

支援選項:
    - "google": 使用官方 Google Gemini API (LangChain 實作)。
    - "mock": 使用 Mock 資料 (用於單元測試或無網路環境)。
"""

from typing import Optional
from app.core.config import settings
from app.services.llm.base import BaseLLMProvider
from app.services.llm.google_adapter import GoogleLLMProvider

class LLMFactory:
    @staticmethod
    def create() -> BaseLLMProvider:
        # Default to Google for now as it's the main provider
        print("[LLMFactory] Using GoogleLLMProvider")
        return GoogleLLMProvider()
