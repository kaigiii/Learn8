from app.core.config import settings
from app.services.knowledge_base.parsers.pdf_basic import BasicPDFParser
from app.services.knowledge_base.parsers.pdf_vision import VisionPDFParser
from app.services.knowledge_base.parsers.pdf_hybrid import HybridPDFParser


class PDFParserStrategyRouter:
    """根據設定檔自動將檔案路由至對應的 PDF 解析策略。"""

    def _get_parser(self):
        strategy = settings.PDF_PARSE_STRATEGY.lower()
        if strategy == "vision":
            return VisionPDFParser()
        elif strategy == "hybrid":
            return HybridPDFParser()
        return BasicPDFParser()

    def parse(self, file_path: str, max_chars: int = None) -> str:
        return self._get_parser().parse(file_path, max_chars)

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        project_folder: str = None,
    ) -> str:
        return await self._get_parser().parse_async(
            file_path, max_chars, user_id, project_folder
        )
