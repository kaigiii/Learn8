from app.core.config import settings
from app.services.commons.activity_logger import activity_logger
from app.core.exceptions import DocumentParseError


class TextParser:
    def parse(self, file_path: str, max_chars: int = None) -> str:
        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(limit + 1)
                if len(content) > limit:
                    return content[:limit] + "\n...[Content Truncated]..."
                return content
        except Exception as e:
            activity_logger.error(f"Text Parsing Error for {file_path}: {e}")
            raise DocumentParseError(f"Failed to parse text file: {e}")

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        return self.parse(file_path, max_chars)
