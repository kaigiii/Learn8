"""
模組名稱: app.services.llm.base
功能描述: LLM 供應商介面 (LLM Provider Interface)

定義了所有 LLM Provider 必須實作的抽象基底類別 (ABC)。
這使得系統可以隨意切換底層模型 (Google Gemini, OpenAI, Claude, Local LLM) 而不影響上層業務邏輯。

主要方法:
    1. bind_files(files): 綁定本地檔案 (主要用於 RAG 或 長文本功能)。
    2. generate_text(messages): 生成純文字回應。
    3. generate_structured(messages, schema): 生成符合 Pydantic Schema 的結構化 JSON 資料。
"""

from abc import ABC, abstractmethod
from typing import Any, List, Optional, Type
from pydantic import BaseModel

class BaseLLMProvider(ABC):
    def __init__(self):
        self.injected_context: Optional[str] = None

    def _inject_local_files(self, files: List[str]):
        """Reads local files and stores them as a string limit to ~15,000 characters."""
        context_parts = []
        char_count = 0
        MAX_CHARS = 15000
        
        for file_path in files:
            if char_count > MAX_CHARS:
                break
            try:
                ext = file_path.split('.')[-1].lower() if '.' in file_path else ""
                content = ""
                
                if ext == "pdf":
                    import fitz
                    doc = fitz.open(file_path)
                    for page in doc:
                        content += page.get_text()
                        if len(content) > (MAX_CHARS - char_count):
                            break
                    doc.close()
                elif ext in ["docx", "doc"]:
                    import docx2txt
                    content = docx2txt.process(file_path)
                else:
                    # Fallback for text files (txt, md, csv, etc.)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read(MAX_CHARS - char_count)
                        
                # Ensure we strictly don't exceed the limit
                content = content[:(MAX_CHARS - char_count)]
                context_parts.append(f"--- File: {file_path.split('/')[-1]} ---\n{content}")
                char_count += len(content)
            except Exception as e:
                print(f"Failed to read file for injection: {file_path}, Error: {e}")
                
        if context_parts:
            self.injected_context = "Relevant User Documents:\n" + "\n".join(context_parts)

    @abstractmethod
    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        """Bind files to the LLM context (Native File API or Local Injection)."""
        pass

    @abstractmethod
    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        """Generate plain text from messages."""
        pass

    @abstractmethod
    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        """Generate structured data validating against a Pydantic schema."""
        pass
