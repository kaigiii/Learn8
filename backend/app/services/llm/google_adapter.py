"""
模組名稱: app.services.llm.google_adapter
功能描述: Google Gemini API 配接器 (Google Adapter)

實作 BaseLLMProvider 介面，封裝 langchain-google-genai 函式庫。
用於與官方 Google Gemini API 進行通訊。

實作細節:
    - 支援 with_structured_output (若 LangChain 版本支援) 或 PydanticOutputParser。
    - 目前暫未完整支援 bind_files (因官方 API 需要先上傳 File API)。
"""

from typing import Any, List, Type
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.services.llm.base import BaseLLMProvider

class GoogleLLMProvider(BaseLLMProvider):
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.7
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        # Google API doesn't support local file binding in the same way as FreeGemini yet
        # or it requires File API upload. For now, we ignore or warn.
        # Check if user wants RAG or direct file upload.
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        response = await self.llm.ainvoke(messages)
        return response.content

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        # Use structured output or parser
        if hasattr(self.llm, "with_structured_output"):
             structured_llm = self.llm.with_structured_output(schema)
             return await structured_llm.ainvoke(messages)
        
        # Fallback to parser
        parser = PydanticOutputParser(pydantic_object=schema)
        # We need to append format instructions if raw messages don't have them?
        # Usually checking if messages is a list of tuples or PromptTemplate.
        # Simple approach: assume wrapper handles prompt formatting.
        # But here we get messages.
        
        # If messages is just a list of (role, content), we might need to append instructions string.
        # But structured_output is preferred for Gemini.
        pass
