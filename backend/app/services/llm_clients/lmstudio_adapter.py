from typing import Any, List, Type
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser
from app.core.config import settings
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.services.commons.activity_logger import ActivityLogger
import time


class LMStudioProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()
        # Initializing an OpenAI compatible client pointing to the local LM Studio server
        self.llm = ChatOpenAI(
            base_url=settings.LMSTUDIO_BASE_URL,
            api_key="lm-studio",  # API key is required by the library but ignored by LM Studio
            model=settings.LMSTUDIO_MODEL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LMSTUDIO_MAX_TOKENS,
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        # Local models don't have a Cloud File API. Read locally and inject into context.
        if files:
            self._inject_local_files(files)
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        # Inject local file context if available
        if self.injected_context:
            from langchain_core.messages import SystemMessage

            messages = [SystemMessage(content=self.injected_context)] + messages

        # Logging Extraction
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
            "lmstudio",
            settings.LMSTUDIO_MODEL,
            sys_prompt,
            user_prompt,
            self.injected_context,
        )

        start_time = time.time()
        response = await self.llm.ainvoke(messages)
        latency = (time.time() - start_time) * 1000
        ActivityLogger.log_llm_response(
            "lmstudio", settings.LMSTUDIO_MODEL, response.content, latency
        )

        return response.content

    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        # Many local models via LM Studio struggle with native 'tools' or 'structured_output'
        # when dealing with highly complex nested/union Pydantic schemas (yielding 400 Invalid JSON Schema).
        # We enforce pure JSON mode with a PydanticOutputParser instead.

        parser = PydanticOutputParser(pydantic_object=schema)
        format_instructions = parser.get_format_instructions()

        # Append format instructions to the last message or create a system message
        from langchain_core.messages import SystemMessage, HumanMessage

        # Add a system message prompting for JSON
        json_prompt = SystemMessage(
            content=f"You MUST output raw JSON exactly matching this schema. Do not output markdown code blocks. \n{format_instructions}"
        )

        # Inject local file context if available
        if self.injected_context:
            context_prompt = SystemMessage(content=self.injected_context)
            messages_with_instructions = [context_prompt] + messages + [json_prompt]
        else:
            messages_with_instructions = messages + [json_prompt]

        # Logging Extraction
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
            "lmstudio",
            settings.LMSTUDIO_MODEL,
            sys_prompt,
            user_prompt,
            self.injected_context,
        )

        start_time = time.time()
        # Force JSON response output (if model supports it, most do now)
        try:
            llm_json_mode = self.llm.bind(response_format={"type": "json_object"})
            response = await llm_json_mode.ainvoke(messages_with_instructions)
        except Exception:
            # Fallback if bind fails
            response = await self.llm.ainvoke(messages_with_instructions)

        latency = (time.time() - start_time) * 1000
        ActivityLogger.log_llm_response(
            "lmstudio", settings.LMSTUDIO_MODEL, response.content, latency
        )

        import re
        import json
        from json_repair import repair_json

        text_content = response.content

        # Strip <think> tags commonly produced by local reasoning models
        text_content = re.sub(r"<think>.*?</think>", "", text_content, flags=re.DOTALL)

        # Strip markdown json wrappers if any
        text_content = re.sub(r"```json\s*", "", text_content)
        text_content = re.sub(r"```\s*", "", text_content)

        # Extract everything from the first { or [ to the last } or ]
        first_brace = min(
            [
                text_content.find("{") if "{" in text_content else len(text_content),
                text_content.find("[") if "[" in text_content else len(text_content),
            ]
        )
        last_brace = max(text_content.rfind("}"), text_content.rfind("]"))

        if (
            first_brace != len(text_content)
            and last_brace != -1
            and last_brace >= first_brace
        ):
            text_content = text_content[first_brace : last_brace + 1]

        # Repair potentially truncated JSON (common with local LLMs running out of context)
        repaired_json_str = repair_json(text_content)

        # Because we need BaseModel out, we instantiate the schema object directly
        # Pydantic Output Parser can be fragile with repaired json strings,
        # so we parse the repaired JSON string to a dict and map it.
        try:
            parsed_data = json.loads(repaired_json_str)

            # Robust fallback for Local Models:
            # Often models output a raw list `[...]` when the schema is a Wrapper object
            # (e.g. `StageListWrapper` expecting `{"stages": [...]}`).
            if isinstance(parsed_data, list):
                # Find the first field name of the Pydantic schema
                fields = list(
                    getattr(
                        schema, "model_fields", getattr(schema, "__fields__", {})
                    ).keys()
                )
                if len(fields) == 1:
                    parsed_data = {fields[0]: parsed_data}
                elif len(fields) > 1 and "stages" in fields:
                    parsed_data = {"stages": parsed_data}

            return schema.model_validate(parsed_data)
        except Exception as e:
            print(f"[LMStudioProvider] Final fallback parse failed: {e}")
            # Let the original parser try one last time, it will likely throw a validation error
            from langchain_core.messages import AIMessage

            return parser.invoke(AIMessage(content=repaired_json_str))
