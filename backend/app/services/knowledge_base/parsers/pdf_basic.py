from langchain_community.document_loaders import PyPDFLoader
from app.core.config import settings
from app.services.commons.activity_logger import activity_logger
from app.core.exceptions import DocumentParseError


class BasicPDFParser:
    def parse(self, file_path: str, max_chars: int = None) -> str:
        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        try:
            loader = PyPDFLoader(file_path)
            pages = loader.load()
            content = "\n".join([p.page_content for p in pages])
            if len(content) > limit:
                return content[:limit] + "\n...[Content Truncated]..."
            return content
        except Exception as e:
            activity_logger.error(f"BasicPDF Parsing Error for {file_path}: {e}")
            raise DocumentParseError(f"Failed to parse basic PDF: {e}")

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        return self.parse(file_path, max_chars)
