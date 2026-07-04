from app.core.config import settings
from app.services.ai_engine.kb.parsers.pdf_hybrid import BasicPDFParser, VisionPDFParser, HybridPDFParser


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
        strategy = settings.PDF_PARSE_STRATEGY.lower()
        if strategy == "ocr":
            return BasicPDFParser().parse(file_path, max_chars)
        return self._get_parser().parse(file_path, max_chars)

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        strategy = settings.PDF_PARSE_STRATEGY.lower()
        if strategy == "ocr":
            from app.services.ai_engine.kb.parsers.markitdown_parser import CustomPdfConverterWithOCR, MockOpenAIClient
            from markitdown_ocr import LLMVisionOCRService
            from markitdown import StreamInfo

            client = MockOpenAIClient(api_key=settings.GOOGLE_API_KEY)
            ocr_service = LLMVisionOCRService(
                client=client,
                model=settings.VISION_GEMINI_MODEL
            )

            converter = CustomPdfConverterWithOCR(
                ocr_service=ocr_service,
                user_id=user_id,
                course_folder=course_folder
            )

            with open(file_path, "rb") as f:
                stream_info = StreamInfo(extension=".pdf", mimetype="application/pdf")
                res = converter.convert(f, stream_info)
                return getattr(res, "markdown", "") or getattr(res, "markdown_content", "")
                
        return await self._get_parser().parse_async(
            file_path, max_chars, user_id, course_folder
        )
