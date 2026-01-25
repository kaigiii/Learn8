
import os
from typing import Protocol, Dict, Type, List
from langchain_community.document_loaders import PyPDFLoader

# --- Interface ---
class FileParser(Protocol):
    def parse(self, file_path: str) -> str:
        """Parses the file and returns full text content."""
        ...

# --- Implementations ---

class PDFParser:
    def parse(self, file_path: str) -> str:
        try:
            loader = PyPDFLoader(file_path)
            pages = loader.load()
            return "\n".join([p.page_content for p in pages])
        except Exception as e:
            print(f"PDF Parsing Error: {e}")
            return ""

class TextParser:
    def parse(self, file_path: str) -> str:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            print(f"Text Parsing Error: {e}")
            return ""

# Future: class DocxParser, class ImageParser (OCR), etc.

# --- Factory / Service ---

class DocumentProcessor:
    """
    Central service for handling document content extraction.
    Add new parsers here to support more file types.
    """
    _parsers: Dict[str, FileParser] = {
        ".pdf": PDFParser(),
        ".txt": TextParser(),
        ".md": TextParser(),
        ".csv": TextParser(),
        ".json": TextParser(),
        ".py": TextParser(),
        ".js": TextParser(),
        ".tsx": TextParser(),
        # Add new extensions here
    }

    @classmethod
    def register_parser(cls, extension: str, parser: FileParser):
        """Allows dynamic registration of new parsers."""
        cls._parsers[extension.lower()] = parser

    @classmethod
    def read_content(cls, file_path: str) -> str:
        """
        Determines the correct parser based on file extension and returns content.
        Returns empty string if file type is unsupported or parsing fails.
        """
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return ""

        ext = os.path.splitext(file_path)[1].lower()
        parser = cls._parsers.get(ext)

        if not parser:
            print(f"No parser found for extension: {ext}")
            return f"[Unsupported file type: {ext}]"

        return parser.parse(file_path)
