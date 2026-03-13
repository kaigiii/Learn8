import os
from typing import Dict

from app.services.knowledge_base.parsers.base_parser import FileParser
from app.services.knowledge_base.parsers.pdf_router import PDFParserStrategyRouter
from app.services.knowledge_base.parsers.text import TextParser
from app.services.commons.activity_logger import activity_logger
from app.core.exceptions import DocumentParseError


class DocumentProcessor:
    """
    處理文件內容擷取的中央服務。
    可在此註冊新的解析策略以支援更多檔案格式。
    """

    _parsers: Dict[str, FileParser] = {}

    @classmethod
    def register_parser(cls, extension: str, parser: FileParser):
        """允許動態註冊新的解析器。"""
        cls._parsers[extension.lower()] = parser

    @classmethod
    def read_content(cls, file_path: str, max_chars: int = None) -> str:
        """
        根據副檔名決定正確的解析器並回傳內容。
        若不支援或失敗則回傳提示字串。
        """
        if not os.path.exists(file_path):
            activity_logger.error(f"File not found: {file_path}")
            raise DocumentParseError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        parser = cls._parsers.get(ext)

        if not parser:
            activity_logger.warning(f"No parser registered for extension: {ext}")
            return f"[Unsupported file type: {ext}]"

        return parser.parse(file_path, max_chars=max_chars)

    @classmethod
    async def async_read_content(
        cls,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        project_folder: str = None,
    ) -> str:
        """
        根據副檔名決定正確的解析器並執行非同步擷取。
        """
        if not os.path.exists(file_path):
            activity_logger.error(f"File not found for async read: {file_path}")
            raise DocumentParseError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        parser = cls._parsers.get(ext)

        if not parser:
            activity_logger.warning(f"No parser registered for extension: {ext}")
            return f"[Unsupported file type: {ext}]"

        return await parser.parse_async(
            file_path,
            max_chars=max_chars,
            user_id=user_id,
            project_folder=project_folder,
        )


# 系統啟動時註冊預設解析器
DocumentProcessor.register_parser(".pdf", PDFParserStrategyRouter())
DocumentProcessor.register_parser(".txt", TextParser())
DocumentProcessor.register_parser(".md", TextParser())
DocumentProcessor.register_parser(".csv", TextParser())
DocumentProcessor.register_parser(".json", TextParser())
DocumentProcessor.register_parser(".py", TextParser())
DocumentProcessor.register_parser(".js", TextParser())
DocumentProcessor.register_parser(".tsx", TextParser())
