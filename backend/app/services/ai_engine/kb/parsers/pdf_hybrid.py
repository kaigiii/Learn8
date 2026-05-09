import fitz
from app.services.domain.user.activity_logger import activity_logger
from app.services.ai_engine.kb.parsers.pdf_basic import BasicPDFParser
from app.services.ai_engine.kb.parsers.pdf_vision import VisionPDFParser


class HybridPDFParser:
    """先檢查是否含有圖片；若無則使用 BasicPDFParser，若有則使用 VisionPDFParser。"""

    def parse(self, file_path: str, max_chars: int = None) -> str:
        return BasicPDFParser().parse(file_path, max_chars)

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        try:
            doc = fitz.open(file_path)
            total_images = sum([len(page.get_images(full=True)) for page in doc])
            doc.close()

            if total_images == 0:
                activity_logger.debug(
                    f"HybridPDFParser: 0 images found in {file_path}. Routing to BasicPDFParser."
                )
                return await BasicPDFParser().parse_async(
                    file_path, max_chars, user_id, course_folder
                )
            else:
                activity_logger.info(
                    f"HybridPDFParser: {total_images} images found in {file_path}. Routing to VisionPDFParser."
                )
                return await VisionPDFParser().parse_async(
                    file_path, max_chars, user_id, course_folder
                )
        except Exception as e:
            activity_logger.warning(
                f"HybridPDFParser Check Error for {file_path}: {e}. Falling back to BasicPDFParser."
            )
            return await BasicPDFParser().parse_async(
                file_path, max_chars, user_id, course_folder
            )
