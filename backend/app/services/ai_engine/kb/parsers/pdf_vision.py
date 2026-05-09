import os
import base64
import fitz
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.services.ai_engine.clients.factory import LLMFactory
from app.services.domain.user.activity_logger import activity_logger
from app.services.ai_engine.kb.parsers.pdf_basic import BasicPDFParser


class VisionPDFParser:
    """使用 PyMuPDF 擷取影像，並將每一頁送給 Vision LLM 生成 Markdown。"""

    def parse(self, file_path: str, max_chars: int = None) -> str:
        # 若同步呼叫，則退回使用 Basic 解析器
        return BasicPDFParser().parse(file_path, max_chars)

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> str:
        from app.services.infra.files.service import FileService
        from app.core.predict import predict_image_bytes

        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        filter_enabled = settings.IMAGE_FILTER_ENABLED
        model_path = settings.IMAGE_FILTER_MODEL_PATH
        image_size = settings.IMAGE_FILTER_IMAGE_SIZE

        if filter_enabled and not os.path.exists(model_path):
            activity_logger.warning(
                f"Image filter model not found at {model_path}. Skipping image filtering."
            )
            filter_enabled = False

        try:
            doc = fitz.open(file_path)
            full_markdown = []
            char_count = 0

            provider = LLMFactory.create_vision_provider()
            sys_msg = SystemMessage(
                content="You are an expert document parser. Read the provided text and images for this page and convert it into beautiful, structured Markdown. Extract all tables as Markdown tables. If there are images, embed them in your output using the provided URL exactly as `![description](url)`. Make sure your output only contains the final Markdown content without any surrounding dialogue."
            )

            for page_num in range(len(doc)):
                if char_count >= limit:
                    break

                page = doc[page_num]
                page_text = page.get_text()
                image_list = page.get_images(full=True)

                content_parts = [
                    {
                        "type": "text",
                        "text": f"-- Page {page_num + 1} Original Text --\n{page_text}\n",
                    }
                ]

                if image_list and user_id and course_folder:
                    kept_images = []

                    for img_index, img in enumerate(image_list):
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        ext = base_image["ext"]
                        if ext.lower() not in ["png", "jpeg", "jpg", "webp"]:
                            ext = "png"  # Fallback for base64 mime type safely

                        if filter_enabled:
                            try:
                                pred = predict_image_bytes(
                                    image_bytes,
                                    model_path=model_path,
                                    image_size=image_size,
                                )
                                activity_logger.info(
                                    f"[ImageFilter] page={page_num + 1} image={img_index} pred={pred}"
                                )
                                if pred != 1:
                                    continue
                            except Exception as pred_error:
                                activity_logger.warning(
                                    f"Image filter failed on page {page_num + 1} image {img_index}: {pred_error}"
                                )

                        kept_images.append((img_index, image_bytes, ext))

                    if kept_images:
                        images_dir = os.path.join(
                            FileService().get_upload_dir(user_id, course_folder), "images"
                        )
                        os.makedirs(images_dir, exist_ok=True)

                        content_parts.append(
                            {
                                "type": "text",
                                "text": "Please integrate these embedded images into the Markdown:\n",
                            }
                        )

                        for img_index, image_bytes, ext in kept_images:
                            img_filename = f"p{page_num + 1}_img{img_index}.{ext}"
                            img_path = os.path.join(images_dir, img_filename)
                            with open(img_path, "wb") as f:
                                f.write(image_bytes)

                            img_url = f"/api/v1/courses/files/images/{user_id}/{course_folder}/{img_filename}"
                            b64_img = base64.b64encode(image_bytes).decode("utf-8")

                            content_parts.append(
                                {"type": "text", "text": f"Image URL: {img_url}\n"}
                            )
                            content_parts.append(
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/{ext};base64,{b64_img}"
                                    },
                                }
                            )

                # 送給 Vision LLM
                user_msg = HumanMessage(content=content_parts)
                try:
                    response_text = await provider.generate_text([sys_msg, user_msg])
                    full_markdown.append(response_text)
                    char_count += len(response_text)
                except Exception as llm_e:
                    activity_logger.warning(
                        f"Vision Parsing failed on page {page_num}, fallback to text: {llm_e}"
                    )
                    full_markdown.append(page_text)
                    char_count += len(page_text)

            doc.close()
            final_content = "\n\n".join(full_markdown)
            if len(final_content) > limit:
                return final_content[:limit] + "\n...[Content Truncated]..."
            return final_content

        except Exception as e:
            activity_logger.error(f"Vision Parsing Error for {file_path}: {e}")
            # 若 Vision 解析崩潰，退回至基礎文字解析以避免完全失敗
            activity_logger.info(
                f"Falling back to BasicPDFParser for {file_path} due to error."
            )
            return await BasicPDFParser().parse_async(
                file_path, max_chars, user_id, course_folder
            )
