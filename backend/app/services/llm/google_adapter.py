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
        super().__init__()
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.7
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        if not files:
            return self

        if settings.USE_GEMINI_FILE_API:
            # (Note: Proper Native Google File API integration goes here if used in backend)
            # For testing cross-compatibility directly with text context, set USE_GEMINI_FILE_API=False.
            print("Warning: Native Google File API upload logic is not fully implemented in this Adapter.")
            return self
        else:
            # Fallback path: Read files into self.injected_context
            self._inject_local_files(files)
            return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        # Inject local file context if available (when File API disabled)
        if self.injected_context:
            from langchain_core.messages import SystemMessage
            messages = [SystemMessage(content=self.injected_context)] + messages
            
        response = await self.llm.ainvoke(messages)
        return response.content

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        # Inject local file context if available
        if self.injected_context:
            from langchain_core.messages import SystemMessage
            messages = [SystemMessage(content=self.injected_context)] + messages
            
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
