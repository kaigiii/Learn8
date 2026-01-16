"""
模組名稱: app.services.llm.local_adapter
功能描述: FreeGemini 配接器 (Local Adapter)

實作 BaseLLMProvider 介面，用於連接本地或非官方的 FreeGemini 服務。
此模組包含較多的自定義邏輯，用於處理非官方 API 的格式怪癖 (Quirks)。

特殊處理:
    - bind_files: 支援本地檔案直接綁定 (這是 FreeGemini 的強項)。
    - JSON Parsing: 內建了多重清洗邏輯 (去除 Markdown, 去除 [QUOTE] 標籤)，
      盡力修復 LLM 輸出的損壞 JSON 字串。
"""

import os
import json
import sys
from pathlib import Path

# [HACK] Add project root to sys.path to find 'FreeGemini' module
# Since we moved it out of backend/app/services, it is now a sibling of backend
# Assumes structure: /root/backend/app/services/llm/local_adapter.py
# We want to add /root to sys.path
project_root = Path(__file__).resolve().parents[4] # up to Learna_v3
sys.path.append(str(project_root))

from typing import Any, List, Type, Optional
from pydantic import BaseModel
try:
    from FreeGemini.freegemini_langchain import ChatFreeGemini
except ImportError:
    print("Warning: FreeGemini module not found. Local adapter will fail.")
    ChatFreeGemini = None
from app.core.config import settings
from app.services.llm.base import BaseLLMProvider
from langchain_core.output_parsers import PydanticOutputParser

class FreeGeminiLLMProvider(BaseLLMProvider):
    def __init__(self, user_id: Optional[int] = None, project_id: Optional[str] = None):
        if user_id and project_id:
            pid = f"learna-v3-{user_id}-{project_id}"
        elif user_id:
            pid = f"learna-v3-{user_id}" 
        else:
            pid = "learna-v3-global"
            
        self.llm = ChatFreeGemini(
            pid=pid,
            model=settings.GEMINI_MODEL,
            project_root=os.getcwd(),
            memory=False 
        )

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        self.llm = self.llm.bind(files=files)
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        response = await self.llm.ainvoke(messages)
        return response.content

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        parser = PydanticOutputParser(pydantic_object=schema)
        
        # FreeGemini might not support with_structured_output fully yet, use Parser Chain
        # We need to ensure format instructions are in the prompt.
        # This implies calls to this method MUST ensure instructions are present or we inject them?
        # A better pattern: The caller provides the PromptTemplate, not just messages?
        # BaseLLMProvider signature was `messages: List[Any]`.
        
        # Let's simple chain it: input -> llm -> parser
        # Custom parsing logic to handle FreeGemini quirks (Markdown, [QUOTE], truncation)
        
        # INJECT SCHEMA instructions manually for FreeGemini
        schema_json = schema.model_json_schema()
        format_instructions = f"""
        \n\n### REQUIRED OUTPUT FORMAT
        You MUST output a valid JSON object matching this schema:
        {json.dumps(schema_json, indent=2)}
        
        IMPORTANT:
        - DO NOT wrap the output in markdown code blocks (e.g. ```json).
        - RETURN RAW JSON ONLY.
        """
        
        # Append instructions to the last message or system message
        # Since messages is a list of tuples or BaseMessages, we need to handle carefully. 
        # Ideally, we append a new SystemMessage or HumanMessage.
        # Simple approach: append to the last user message content if possible, or add a new message.
        
        from langchain_core.messages import SystemMessage, HumanMessage
        
        messages_with_instr = list(messages)
        messages_with_instr.append(SystemMessage(content=format_instructions))

        response_msg = await self.llm.ainvoke(messages_with_instr)
        text = response_msg.content
        
        # 1. Strip Markdown Code Blocks
        if "```json" in text:
            text = text.split("```json")[1]
            if "```" in text:
                text = text.split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
            
        # 2. Clean known artifacts
        text = text.replace("[QUOTE]", "").strip()
        
        # 3. Handle truncated JSON (heuristic: try to close brackets if missing)
        # For now, let's rely on the parser to fail if it's too broken, but we gave it a best shot.
        
        try:
            return parser.parse(text)
        except Exception as e:
            # Fallback: validation error? try to repair or just re-raise with clearer error
            print(f"JSON Parse Error: {e}\nRaw Text: {text}")
            raise e
