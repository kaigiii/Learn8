from typing import Any, List, Type
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.services.commons.activity_logger import ActivityLogger
import time


class GoogleLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=settings.LLM_TEMPERATURE,
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        if not files:
            return self

        # 將檔案讀取至 self.injected_context
        self._inject_local_files(files)
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        # 若有本地檔案上下文則進行注入
        if self.injected_context:
            from langchain_core.messages import SystemMessage

            messages = [SystemMessage(content=self.injected_context)] + messages

        # 擷取系統與使用者提示詞以供日誌紀錄
        def _get_text(m):
            return m[1] if isinstance(m, tuple) else getattr(m, "content", "")

        def _get_type(m):
            return m[0] if isinstance(m, tuple) else getattr(m, "type", "")

        sys_prompt = next(
            (_get_text(m) for m in messages if _get_type(m) == "system"), ""
        )
        user_prompt = next(
            (_get_text(m) for m in messages if _get_type(m) == "user"), ""
        )
        ActivityLogger.log_llm_request(
            "google",
            settings.GEMINI_MODEL,
            sys_prompt,
            user_prompt,
            self.injected_context,
        )

        start_time = time.time()
        response = await self.llm.ainvoke(messages)
        latency = (time.time() - start_time) * 1000

        ActivityLogger.log_llm_response(
            "google", settings.GEMINI_MODEL, response.content, latency
        )

        return response.content

    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        # 若有本地檔案上下文則進行注入
        if self.injected_context:
            from langchain_core.messages import SystemMessage

            messages = [SystemMessage(content=self.injected_context)] + messages

        # 擷取系統與使用者提示詞以供日誌紀錄
        def _get_text(m):
            return m[1] if isinstance(m, tuple) else getattr(m, "content", "")

        def _get_type(m):
            return m[0] if isinstance(m, tuple) else getattr(m, "type", "")

        sys_prompt = next(
            (_get_text(m) for m in messages if _get_type(m) == "system"), ""
        )
        user_prompt = next(
            (_get_text(m) for m in messages if _get_type(m) == "user"), ""
        )
        ActivityLogger.log_llm_request(
            "google",
            settings.GEMINI_MODEL,
            sys_prompt,
            user_prompt,
            self.injected_context,
        )

        # 嘗試使用結構化輸出或解析器
        start_time = time.time()
        if hasattr(self.llm, "with_structured_output"):
            structured_llm = self.llm.with_structured_output(schema)
            response = await structured_llm.ainvoke(messages)
            latency = (time.time() - start_time) * 1000
            ActivityLogger.log_llm_response(
                "google", settings.GEMINI_MODEL, response.model_dump_json(), latency
            )
            return response

        # 若模型不支援 with_structured_output，退回使用 PydanticOutputParser
        parser = PydanticOutputParser(pydantic_object=schema)
        format_instructions = parser.get_format_instructions()

        from langchain_core.messages import SystemMessage, AIMessage

        fallback_messages = messages + [
            SystemMessage(
                content=(
                    "You MUST output raw JSON exactly matching this schema. "
                    "Do not output markdown code blocks.\n"
                    f"{format_instructions}"
                )
            )
        ]

        response = await self.llm.ainvoke(fallback_messages)
        latency = (time.time() - start_time) * 1000
        ActivityLogger.log_llm_response(
            "google", settings.GEMINI_MODEL, response.content, latency
        )
        return parser.invoke(AIMessage(content=response.content))
