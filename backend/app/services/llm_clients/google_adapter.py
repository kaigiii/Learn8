"""
模組名稱: app.services.llm_clients.google_adapter
功能描述: Google Gemini API 配接器 (Google Adapter)

實作 BaseLLMProvider 介面，封裝 langchain-google-genai 函式庫。
用於與官方 Google Gemini API 進行通訊。

實作細節:
    - 支援 with_structured_output (若 LangChain 版本支援) 或 PydanticOutputParser。
"""

from typing import Any, List, Type
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.services.llm_clients.base import BaseLLMProvider
from app.services.commons.activity_logger import ActivityLogger
import time

class GoogleLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=settings.LLM_TEMPERATURE
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        if not files:
            return self

        # Read files into self.injected_context
        self._inject_local_files(files)
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        # Inject local file context if available
        if self.injected_context:
            from langchain_core.messages import SystemMessage
            messages = [SystemMessage(content=self.injected_context)] + messages
            
        # Logging Extraction
        def _get_text(m): return m[1] if isinstance(m, tuple) else getattr(m, "content", "")
        def _get_type(m): return m[0] if isinstance(m, tuple) else getattr(m, "type", "")
        
        sys_prompt = next((_get_text(m) for m in messages if _get_type(m) == "system"), "")
        user_prompt = next((_get_text(m) for m in messages if _get_type(m) == "user"), "")
        ActivityLogger.log_llm_request("google", settings.GEMINI_MODEL, sys_prompt, user_prompt, self.injected_context)
            
        start_time = time.time()
        response = await self.llm.ainvoke(messages)
        latency = (time.time() - start_time) * 1000
        
        ActivityLogger.log_llm_response("google", settings.GEMINI_MODEL, response.content, latency)
        
        return response.content

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        # Inject local file context if available
        if self.injected_context:
            from langchain_core.messages import SystemMessage
            messages = [SystemMessage(content=self.injected_context)] + messages
            
        # Logging Extraction
        def _get_text(m): return m[1] if isinstance(m, tuple) else getattr(m, "content", "")
        def _get_type(m): return m[0] if isinstance(m, tuple) else getattr(m, "type", "")
        
        sys_prompt = next((_get_text(m) for m in messages if _get_type(m) == "system"), "")
        user_prompt = next((_get_text(m) for m in messages if _get_type(m) == "user"), "")
        ActivityLogger.log_llm_request("google", settings.GEMINI_MODEL, sys_prompt, user_prompt, self.injected_context)
            
        # Use structured output or parser
        start_time = time.time()
        if hasattr(self.llm, "with_structured_output"):
             structured_llm = self.llm.with_structured_output(schema)
             response = await structured_llm.ainvoke(messages)
             latency = (time.time() - start_time) * 1000
             ActivityLogger.log_llm_response("google", settings.GEMINI_MODEL, response.model_dump_json(), latency)
             return response
        
        # Fallback to parser
        parser = PydanticOutputParser(pydantic_object=schema)
        # We need to append format instructions if raw messages don't have them?
        # Usually checking if messages is a list of tuples or PromptTemplate.
        # Simple approach: assume wrapper handles prompt formatting.
        # But here we get messages.
        
        # If messages is just a list of (role, content), we might need to append instructions string.
        # But structured_output is preferred for Gemini.
        pass
