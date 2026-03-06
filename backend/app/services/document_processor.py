import os
import fitz
import base64
from typing import Protocol, Dict, Type, List, Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.services.llm.factory import LLMFactory
from app.services.activity_logger import activity_logger
from app.core.exceptions import DocumentParseError

# --- Interface ---
class FileParser(Protocol):
    def parse(self, file_path: str, max_chars: int = None) -> str:
        """Parses the file and returns full text content, up to max_chars."""
        ...
        
    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        """Parses the file asynchronously (needed for API calls or image saving)."""
        ...

# --- Implementations ---

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

    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        return self.parse(file_path, max_chars)

class VisionPDFParser:
    """Extracts images using PyMuPDF and sends each page to the Vision LLM for Markdown generation."""
    def parse(self, file_path: str, max_chars: int = None) -> str:
        # Fallback to Basic if called synchronously
        return BasicPDFParser().parse(file_path, max_chars)

    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        from app.services.file_service import FileService
        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        
        try:
            doc = fitz.open(file_path)
            full_markdown = []
            char_count = 0
            
            provider = LLMFactory.create_vision_provider()
            sys_msg = SystemMessage(content="You are an expert document parser. Read the provided text and images for this page and convert it into beautiful, structured Markdown. Extract all tables as Markdown tables. If there are images, embed them in your output using the provided URL exactly as `![description](url)`. Make sure your output only contains the final Markdown content without any surrounding dialogue.")

            for page_num in range(len(doc)):
                if char_count >= limit:
                    break
                    
                page = doc[page_num]
                page_text = page.get_text()
                image_list = page.get_images(full=True)
                
                content_parts = [{"type": "text", "text": f"-- Page {page_num + 1} Original Text --\n{page_text}\n"}]
                
                if image_list and user_id and project_folder:
                    images_dir = os.path.join(FileService().get_upload_dir(user_id, project_folder), "images")
                    os.makedirs(images_dir, exist_ok=True)
                    
                    content_parts.append({"type": "text", "text": "Please integrate these embedded images into the Markdown:\n"})
                    
                    for img_index, img in enumerate(image_list):
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        ext = base_image["ext"]
                        if ext.lower() not in ["png", "jpeg", "jpg", "webp"]:
                            ext = "png" # Fallback for base64 mime type safely
                            
                        img_filename = f"p{page_num+1}_img{img_index}.{ext}"
                        img_path = os.path.join(images_dir, img_filename)
                        with open(img_path, "wb") as f:
                            f.write(image_bytes)
                            
                        img_url = f"/api/v1/projects/files/images/{user_id}/{project_folder}/{img_filename}"
                        b64_img = base64.b64encode(image_bytes).decode('utf-8')
                        
                        content_parts.append({"type": "text", "text": f"Image URL: {img_url}\n"})
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/{ext};base64,{b64_img}"}
                        })
                
                # Send to Vision LLM
                user_msg = HumanMessage(content=content_parts)
                try:
                    response_text = await provider.generate_text([sys_msg, user_msg])
                    full_markdown.append(response_text)
                    char_count += len(response_text)
                except Exception as llm_e:
                    print(f"Vision Parsing failed recursively on page {page_num}, fallback to text: {llm_e}")
                    full_markdown.append(page_text)
                    char_count += len(page_text)
            
            doc.close()
            final_content = "\n\n".join(full_markdown)
            if len(final_content) > limit:
                return final_content[:limit] + "\n...[Content Truncated]..."
            return final_content
            
        except Exception as e:
            activity_logger.error(f"Vision Parsing Error for {file_path}: {e}")
            # Fallback to basic processing instead of failing completely if VISION parsing blows up
            activity_logger.info(f"Falling back to BasicPDFParser for {file_path} due to error.")
            return await BasicPDFParser().parse_async(file_path, max_chars, user_id, project_folder)


class HybridPDFParser:
    """Checks for images first; if none, uses BasicPDFParser. If images exist, uses VisionPDFParser."""
    def parse(self, file_path: str, max_chars: int = None) -> str:
        return BasicPDFParser().parse(file_path, max_chars)

    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        try:
            doc = fitz.open(file_path)
            total_images = sum([len(page.get_images(full=True)) for page in doc])
            doc.close()
            
            if total_images == 0:
                activity_logger.debug(f"HybridPDFParser: 0 images found in {file_path}. Routing to BasicPDFParser.")
                return await BasicPDFParser().parse_async(file_path, max_chars, user_id, project_folder)
            else:
                activity_logger.info(f"HybridPDFParser: {total_images} images found in {file_path}. Routing to VisionPDFParser.")
                return await VisionPDFParser().parse_async(file_path, max_chars, user_id, project_folder)
        except Exception as e:
            activity_logger.warning(f"HybridPDFParser Check Error for {file_path}: {e}. Falling back to BasicPDFParser.")
            return await BasicPDFParser().parse_async(file_path, max_chars, user_id, project_folder)


class PDFParserStrategyRouter:
    """Routes to the correct parser based on settings."""
    def _get_parser(self):
        strategy = settings.PDF_PARSE_STRATEGY.lower()
        if strategy == "vision":
            return VisionPDFParser()
        elif strategy == "hybrid":
            return HybridPDFParser()
        return BasicPDFParser()

    def parse(self, file_path: str, max_chars: int = None) -> str:
        return self._get_parser().parse(file_path, max_chars)

    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        return await self._get_parser().parse_async(file_path, max_chars, user_id, project_folder)


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

    async def parse_async(self, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        return self.parse(file_path, max_chars)

# --- Factory / Service ---

class DocumentProcessor:
    """
    Central service for handling document content extraction.
    Add new parsers here to support more file types.
    """
    _parsers: Dict[str, FileParser] = {}

    @classmethod
    def register_parser(cls, extension: str, parser: FileParser):
        """Allows dynamic registration of new parsers."""
        cls._parsers[extension.lower()] = parser

    @classmethod
    def read_content(cls, file_path: str, max_chars: int = None) -> str:
        """
        Determines the correct parser based on file extension and returns content.
        Returns empty string if file type is unsupported or parsing fails.
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
    async def async_read_content(cls, file_path: str, max_chars: int = None, user_id: int = None, project_folder: str = None) -> str:
        """
        Determines the correct parser and runs async extraction.
        """
        if not os.path.exists(file_path):
            activity_logger.error(f"File not found for async read: {file_path}")
            raise DocumentParseError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        parser = cls._parsers.get(ext)

        if not parser:
            activity_logger.warning(f"No parser registered for extension: {ext}")
            return f"[Unsupported file type: {ext}]"

        return await parser.parse_async(file_path, max_chars=max_chars, user_id=user_id, project_folder=project_folder)

# Initialize Default Parsers
DocumentProcessor.register_parser(".pdf", PDFParserStrategyRouter())
DocumentProcessor.register_parser(".txt", TextParser())
DocumentProcessor.register_parser(".md", TextParser())
DocumentProcessor.register_parser(".csv", TextParser())
DocumentProcessor.register_parser(".json", TextParser())
DocumentProcessor.register_parser(".py", TextParser())
DocumentProcessor.register_parser(".js", TextParser())
DocumentProcessor.register_parser(".tsx", TextParser())
