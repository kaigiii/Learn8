import re
import io
import base64
import os
from typing import BinaryIO, Any, Optional

from markitdown import MarkItDown, DocumentConverterResult, StreamInfo
from markitdown_ocr import PdfConverterWithOCR, LLMVisionOCRService
from app.services.infra.files.service import FileService
from app.core.config import settings

# Mock OpenAI client to wrap Gemini SDK
class MockOpenAICompletions:
    def __init__(self, api_key: str):
        from google import genai
        self.client = genai.Client(api_key=api_key)

    def create(self, model: str, messages: list[dict], **kwargs) -> Any:
        prompt = ""
        image_bytes = None
        mime_type = "image/png"
        
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content")
                if isinstance(content, list):
                    for part in content:
                        if part.get("type") == "text":
                            prompt += part.get("text", "")
                        elif part.get("type") == "image_url":
                            url = part.get("image_url", {}).get("url", "")
                            if url.startswith("data:"):
                                header, data = url.split(",", 1)
                                match = re.search(r"data:(?P<mime>[^;]+);base64", header)
                                if match:
                                    mime_type = match.group("mime")
                                image_bytes = base64.b64decode(data)
                elif isinstance(content, str):
                    prompt += content
        
        contents = []
        if prompt:
            contents.append(prompt)
        if image_bytes:
            from google.genai import types
            contents.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type
                )
            )
            
        gemini_model = settings.VISION_GEMINI_MODEL
        response = self.client.models.generate_content(
            model=gemini_model,
            contents=contents
        )
        
        class Choice:
            class Message:
                def __init__(self, content):
                    self.content = content
            def __init__(self, content):
                self.message = self.Message(content)
                
        class Response:
            def __init__(self, content):
                self.choices = [Choice(content)]
                
        return Response(response.text)

class MockOpenAIChat:
    def __init__(self, api_key: str):
        self.completions = MockOpenAICompletions(api_key)

class MockOpenAIClient:
    def __init__(self, api_key: str):
        self.chat = MockOpenAIChat(api_key)


class CustomPdfConverterWithOCR(PdfConverterWithOCR):
    """
    客製化 PDF 轉換器，繼承自 markitdown_ocr.PdfConverterWithOCR。
    重寫 convert 方法，在提取並辨識圖片時，將圖片實體檔案儲存到本地 images 目錄，
    並在輸出 Markdown 中產生 ![alt](img_url) 圖片標籤。
    """
    def __init__(
        self,
        ocr_service: Optional[LLMVisionOCRService] = None,
        user_id: int = None,
        course_folder: str = None
    ):
        super().__init__(ocr_service=ocr_service)
        self.user_id = user_id
        self.course_folder = course_folder
        self.file_service = FileService()

    def convert(
        self,
        file_stream: BinaryIO,
        stream_info: StreamInfo,
        **kwargs: Any,
    ) -> DocumentConverterResult:
        import pdfminer.high_level
        import pdfplumber

        ocr_service = kwargs.get("ocr_service") or self.ocr_service

        file_stream.seek(0)
        pdf_bytes = io.BytesIO(file_stream.read())

        markdown_content = []

        try:
            with pdfplumber.open(pdf_bytes) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    markdown_content.append(f"\n## Page {page_num}\n")

                    if ocr_service:
                        images_on_page = self._extract_page_images(pdf_bytes, page_num)

                        if images_on_page:
                            # Extract text lines with Y positions
                            chars = page.chars
                            if chars:
                                lines_with_y = []
                                current_line = []
                                current_y = None

                                for char in sorted(chars, key=lambda c: (c["top"], c["x0"])):
                                    y = char["top"]
                                    if current_y is None:
                                        current_y = y
                                    elif abs(y - current_y) > 2:
                                        if current_line:
                                            text = "".join([c["text"] for c in current_line])
                                            lines_with_y.append({"y": current_y, "text": text.strip()})
                                        current_line = []
                                        current_y = y
                                    current_line.append(char)

                                if current_line:
                                    text = "".join([c["text"] for c in current_line])
                                    lines_with_y.append({"y": current_y, "text": text.strip()})
                            else:
                                text_content = page.extract_text() or ""
                                lines_with_y = [
                                    {"y": i * 10, "text": line}
                                    for i, line in enumerate(text_content.split("\n"))
                                ]

                            # OCR all images
                            image_data = []
                            for img_idx, img_info in enumerate(images_on_page):
                                try:
                                    ocr_result = ocr_service.extract_text(img_info["stream"])
                                    ocr_text = ocr_result.text.strip() if (ocr_result and ocr_result.text) else ""
                                    if not ocr_text:
                                        ocr_text = f"Weiqi Go Board Image {img_idx}"
                                except Exception:
                                    ocr_text = f"Weiqi Go Board Image {img_idx}"
                                    ocr_result = None

                                # 儲存圖片二進位數據至本地 images 目錄
                                img_url = ""
                                if self.user_id and self.course_folder:
                                    img_filename = f"p{page_num}_img{img_idx}.png"
                                    upload_dir = self.file_service.get_upload_dir(self.user_id, self.course_folder)
                                    images_dir = upload_dir / "images"
                                    os.makedirs(images_dir, exist_ok=True)
                                    img_filepath = images_dir / img_filename

                                    try:
                                        img_info["stream"].seek(0)
                                        with open(img_filepath, "wb") as f:
                                            f.write(img_info["stream"].read())
                                        img_url = f"/api/v1/courses/files/images/{self.user_id}/{self.course_folder}/{img_filename}"
                                    except Exception:
                                        pass

                                image_data.append(
                                    {
                                        "y_pos": img_info["y_pos"],
                                        "name": img_info["name"],
                                        "ocr_text": ocr_text,
                                        "type": "image",
                                        "url": img_url,
                                    }
                                )

                            # Add text items
                            content_items = [
                                {
                                    "y_pos": item["y"],
                                    "text": item["text"],
                                    "type": "text",
                                }
                                for item in lines_with_y
                                if item["text"]
                            ]
                            content_items.extend(image_data)
                            content_items.sort(key=lambda x: x["y_pos"])

                            # Build markdown by interleaving text and images
                            for item in content_items:
                                if item["type"] == "text":
                                    markdown_content.append(item["text"])
                                else: # image
                                    ocr_text = item["ocr_text"]
                                    img_url = item.get("url", "")
                                    if img_url:
                                        img_marker = f"\n\n![{ocr_text}]({img_url})\n"
                                    else:
                                        img_marker = f"\n\n*[Image OCR]\n{ocr_text}\n[End OCR]*\n"
                                    markdown_content.append(img_marker)
                        else:
                            text_content = page.extract_text() or ""
                            if text_content.strip():
                                markdown_content.append(text_content.strip())
                    else:
                        text_content = page.extract_text() or ""
                        if text_content.strip():
                            markdown_content.append(text_content.strip())

                markdown = "\n\n".join(markdown_content).strip()

                if not markdown:
                    pdf_bytes.seek(0)
                    markdown = pdfminer.high_level.extract_text(pdf_bytes)

        except Exception:
            try:
                pdf_bytes.seek(0)
                markdown = pdfminer.high_level.extract_text(pdf_bytes)
            except Exception:
                markdown = ""

        if ocr_service and (not markdown or not markdown.strip()):
            pdf_bytes.seek(0)
            markdown = self._ocr_full_pages(pdf_bytes, ocr_service)

        return DocumentConverterResult(markdown=markdown)


class MarkItDownOfficeParser:
    """
    用於處理 Word (.docx), PowerPoint (.pptx) 與 Excel (.xlsx) 的轉檔與內嵌 Base64 圖片提取。
    """
    def __init__(self):
        self.file_service = FileService()

    def parse(self, file_path: str, max_chars: int = None) -> str:
        return self._run_conversion(file_path, user_id=None, course_folder=None)

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        return self._run_conversion(file_path, user_id=user_id, course_folder=course_folder)

    def _run_conversion(self, file_path: str, user_id: int | None, course_folder: str | None) -> str:
        md = MarkItDown()
        result = md.convert(file_path, keep_data_uris=True)
        markdown = result.text_content or ""

        if not user_id or not course_folder:
            return markdown

        upload_dir = self.file_service.get_upload_dir(user_id, course_folder)
        images_dir = upload_dir / "images"
        os.makedirs(images_dir, exist_ok=True)

        pattern = re.compile(r"!\[(?P<alt>.*?)\]\((?P<url>[^)]+)\)")
        img_idx = 0

        def replace_b64(match):
            nonlocal img_idx
            alt = match.group("alt") or f"office_img_{img_idx}"
            url = match.group("url")

            if not url.startswith("data:"):
                return match.group(0)

            # 解析 Base64 數據
            mime_match = re.match(r"data:(?P<mime>image/[^;]+);base64,(?P<b64>.+)", url)
            if not mime_match:
                return match.group(0)

            mime = mime_match.group("mime")
            b64_data = mime_match.group("b64")
            ext = mime.split("/")[-1]

            try:
                img_bytes = base64.b64decode(b64_data)
                img_filename = f"office_img_{img_idx}.{ext}"
                img_idx += 1
                img_filepath = images_dir / img_filename
                
                with open(img_filepath, "wb") as f:
                    f.write(img_bytes)

                img_url = f"/api/v1/courses/files/images/{user_id}/{course_folder}/{img_filename}"
                return f"![{alt}]({img_url})"
            except Exception:
                return match.group(0)

        return pattern.sub(replace_b64, markdown)
