from typing import Any, List, Type, Dict
import os
import hashlib
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.services.domain.user.activity_logger import ActivityLogger
import time

# Module-level cache to reuse uploaded Google files
# Key: SHA-256 hash of the file content
# Value: Google file object name (e.g., "files/...")
_uploaded_files_cache: Dict[str, str] = {}


class GoogleLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=settings.LLM_TEMPERATURE,
        )
        # Initialize Google GenAI client for File API uploads
        from google import genai
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        self.google_files: List[dict] = []
        self.bound_file_paths: List[str] = []

    def bind_files(self, files: List[str], use_google_file_api: bool = True) -> "BaseLLMProvider":
        if not files:
            return self
        self.bound_file_paths = files

        if not use_google_file_api:
            self._inject_local_files(files)
            return self

        self.google_files = []
        for file_path in files:
            try:
                if not os.path.exists(file_path):
                    continue

                # Determine MIME type
                ext = file_path.split(".")[-1].lower() if "." in file_path else ""
                mime_type = "text/plain"
                if ext == "pdf":
                    mime_type = "application/pdf"
                elif ext == "docx":
                    mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                elif ext == "pptx":
                    mime_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

                # Calculate SHA-256 hash of the file content to prevent redundant uploads
                sha256 = hashlib.sha256()
                with open(file_path, "rb") as f:
                    while chunk := f.read(8192):
                        sha256.update(chunk)
                file_hash = sha256.hexdigest()

                # Try to retrieve from global cache
                google_file_name = _uploaded_files_cache.get(file_hash)
                if google_file_name:
                    try:
                        # Check if file still exists and is active on Google server
                        google_file = self.client.files.get(name=google_file_name)
                    except Exception:
                        google_file_name = None  # Deleted or expired, force re-upload

                if not google_file_name:
                    upload_path = file_path
                    temp_file_created = False
                    try:
                        file_path.encode('ascii')
                    except UnicodeEncodeError:
                        import shutil
                        import tempfile
                        temp_dir = tempfile.gettempdir()
                        upload_path = os.path.join(temp_dir, f"upload_{file_hash}.{ext}")
                        shutil.copy2(file_path, upload_path)
                        temp_file_created = True

                    try:
                        google_file = self.client.files.upload(file=upload_path)
                        google_file_name = google_file.name
                        _uploaded_files_cache[file_hash] = google_file_name
                    finally:
                        if temp_file_created and os.path.exists(upload_path):
                            try:
                                os.remove(upload_path)
                            except Exception:
                                pass

                # Retrieve the active file descriptor to get the correct URI
                google_file = self.client.files.get(name=google_file_name)
                self.google_files.append({
                    "type": "media",
                    "file_uri": google_file.uri,
                    "mime_type": mime_type
                })
            except Exception as e:
                # Fallback to local text extraction if File API upload fails
                print(f"Failed to upload file to Google File API: {file_path}, Error: {e}")
                self._inject_local_files([file_path])

        return self

    def _attach_files_to_messages(self, messages: List[Any]) -> List[Any]:
        if not self.google_files:
            return messages

        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

        converted_messages = []
        for m in messages:
            if isinstance(m, tuple):
                role, content = m
                if role == "system":
                    converted_messages.append(SystemMessage(content=content))
                elif role in ("user", "human"):
                    converted_messages.append(HumanMessage(content=content))
                elif role in ("assistant", "ai"):
                    converted_messages.append(AIMessage(content=content))
            else:
                converted_messages.append(m)

        user_msg_idx = -1
        for idx, msg in enumerate(converted_messages):
            if isinstance(msg, HumanMessage):
                user_msg_idx = idx
                break

        if user_msg_idx != -1:
            orig_msg = converted_messages[user_msg_idx]
            if isinstance(orig_msg.content, str):
                new_content = [{"type": "text", "text": orig_msg.content}] + self.google_files
            elif isinstance(orig_msg.content, list):
                new_content = orig_msg.content + self.google_files
            else:
                new_content = self.google_files
            converted_messages[user_msg_idx] = HumanMessage(content=new_content)
        else:
            converted_messages.append(HumanMessage(content=self.google_files))

        return converted_messages

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        orig_messages = list(messages)
        attached_messages = self._attach_files_to_messages(messages)

        log_context = self.injected_context
        if self.google_files:
            log_context = "Google File API URIs: " + ", ".join(f["file_uri"] for f in self.google_files)

        if self.injected_context and not self.google_files:
            from langchain_core.messages import SystemMessage
            attached_messages = [SystemMessage(content=self.injected_context)] + attached_messages

        def _get_text(m):
            return m[1] if isinstance(m, tuple) else getattr(m, "content", "")

        def _get_type(m):
            return m[0] if isinstance(m, tuple) else getattr(m, "type", "")

        sys_prompt = next(
            (_get_text(m) for m in attached_messages if _get_type(m) == "system"), ""
        )
        user_prompt = next(
            (_get_text(m) for m in attached_messages if _get_type(m) == "user" or _get_type(m) == "human"), ""
        )
        ActivityLogger.log_llm_request(
            "google",
            settings.GEMINI_MODEL,
            sys_prompt,
            str(user_prompt),
            log_context,
        )

        try:
            start_time = time.time()
            response = await self.llm.ainvoke(attached_messages)
            latency = (time.time() - start_time) * 1000

            ActivityLogger.log_llm_response(
                "google", settings.GEMINI_MODEL, response.content, latency
            )

            content = response.content
            if isinstance(content, list):
                text_parts = []
                for part in content:
                    if isinstance(part, str):
                        text_parts.append(part)
                    elif isinstance(part, dict) and "text" in part:
                        text_parts.append(part["text"])
                content = "".join(text_parts)
            return content
        except Exception as e:
            if self.google_files and self.bound_file_paths:
                # Log warning and fall back to local text extraction
                import logging
                logger = logging.getLogger("activity")
                logger.warning(
                    f"Gemini generation with File API failed: {e}. Falling back to local text extraction."
                )
                self.google_files = []
                self._inject_local_files(self.bound_file_paths)
                # Re-run with local injected text
                return await self.generate_text(orig_messages, **kwargs)
            raise e

    async def generate_structured(
        self, messages: List[Any], schema: Type[BaseModel], **kwargs
    ) -> BaseModel:
        orig_messages = list(messages)
        attached_messages = self._attach_files_to_messages(messages)

        log_context = self.injected_context
        if self.google_files:
            log_context = "Google File API URIs: " + ", ".join(f["file_uri"] for f in self.google_files)

        if self.injected_context and not self.google_files:
            from langchain_core.messages import SystemMessage
            attached_messages = [SystemMessage(content=self.injected_context)] + attached_messages

        def _get_text(m):
            return m[1] if isinstance(m, tuple) else getattr(m, "content", "")

        def _get_type(m):
            return m[0] if isinstance(m, tuple) else getattr(m, "type", "")

        sys_prompt = next(
            (_get_text(m) for m in attached_messages if _get_type(m) == "system"), ""
        )
        user_prompt = next(
            (_get_text(m) for m in attached_messages if _get_type(m) == "user" or _get_type(m) == "human"), ""
        )
        ActivityLogger.log_llm_request(
            "google",
            settings.GEMINI_MODEL,
            sys_prompt,
            str(user_prompt),
            log_context,
        )

        try:
            start_time = time.time()
            if hasattr(self.llm, "with_structured_output"):
                structured_llm = self.llm.with_structured_output(schema)
                response = await structured_llm.ainvoke(attached_messages)
                latency = (time.time() - start_time) * 1000
                ActivityLogger.log_llm_response(
                    "google", settings.GEMINI_MODEL, response.model_dump_json(), latency
                )
                return response

            parser = PydanticOutputParser(pydantic_object=schema)
            format_instructions = parser.get_format_instructions()

            from langchain_core.messages import SystemMessage, AIMessage

            fallback_messages = attached_messages + [
                SystemMessage(
                    content=(
                        "You MUST output raw JSON exactly matching this schema. "
                        "Do not output markdown code blocks.\n"
                        f"{format_instructions}"
                    )
                )
            ]

            response = await self.llm.ainvoke(fallback_messages)
            latency = (time.time() - start_time) * 1000
            ActivityLogger.log_llm_response(
                "google", settings.GEMINI_MODEL, response.content, latency
            )
            return parser.invoke(AIMessage(content=response.content))
        except Exception as e:
            if self.google_files and self.bound_file_paths:
                import logging
                logger = logging.getLogger("activity")
                logger.warning(
                    f"Gemini structured generation with File API failed: {e}. Falling back to local text extraction."
                )
                self.google_files = []
                self._inject_local_files(self.bound_file_paths)
                # Re-run with local injected text
                return await self.generate_structured(orig_messages, schema, **kwargs)
            raise e
