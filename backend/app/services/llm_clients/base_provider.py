from abc import ABC, abstractmethod
from typing import Any, List, Optional, Type
from pydantic import BaseModel


class BaseLLMProvider(ABC):
    def __init__(self):
        self.injected_context: Optional[str] = None

    def _inject_local_files(self, files: List[str]):
        """讀取本地檔案並儲存為字串，限制約 15,000 字元以免超過 Token 上限。"""
        context_parts = []
        char_count = 0
        MAX_CHARS = 15000

        for file_path in files:
            if char_count > MAX_CHARS:
                break
            try:
                ext = file_path.split(".")[-1].lower() if "." in file_path else ""
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
                    # 文字檔案 (txt, md, csv 等) 的退回處理方式
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read(MAX_CHARS - char_count)

                # 確保嚴格不超過字元上限
                content = content[: (MAX_CHARS - char_count)]
                context_parts.append(
                    f"--- File: {file_path.split('/')[-1]} ---\n{content}"
                )
                char_count += len(content)
            except Exception as e:
                print(f"Failed to read file for injection: {file_path}, Error: {e}")

        if context_parts:
            self.injected_context = "Relevant User Documents:\n" + "\n".join(
                context_parts
            )

    @abstractmethod
    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        """將檔案綁定至 LLM 上下文 (透過原生 File API 或本地文本注入)。"""
        pass

    @abstractmethod
    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        """從訊息陣列中生成純文字回應。"""
        pass

    @abstractmethod
    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        """生成結構化資料，並針對 Pydantic schema 進行驗證。"""
        pass
