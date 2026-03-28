import os
import shutil
from typing import List, Optional, Tuple
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from app.core.config import settings
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.services.commons.activity_logger import activity_logger
from app.core.exceptions import RAGIndexingError, LLMGenerationError
from langchain_core.messages import SystemMessage, HumanMessage


class TextSplitterService:
    """處理將大型文件切分為較小區塊，以便進行向量索引 (Vector Indexing)。"""

    def split_document(
        self,
        text: str,
        source: str,
        course_id: int | None = None,
    ) -> List[Document]:
        metadata = {"source": source}
        if course_id is not None:
            metadata["course_id"] = str(course_id)
        doc = Document(
            page_content=text,
            metadata=metadata,
        )

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            add_start_index=True,
        )

        return text_splitter.split_documents([doc])


class RAGEngine:
    DB_DIR = "./chroma_db"

    def __init__(self, llm_provider: BaseLLMProvider):
        self._llm_provider = llm_provider
        self._text_splitter = TextSplitterService()
        self._vectorstore = self._init_vectorstore()

    def _init_vectorstore(self) -> Optional[Chroma]:
        if not settings.GOOGLE_API_KEY:
            activity_logger.warning("GOOGLE_API_KEY not found. RAG features will fail.")
            return None

        try:
            embedding_function = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=settings.GOOGLE_API_KEY,
            )
            return Chroma(
                persist_directory=self.DB_DIR, embedding_function=embedding_function
            )
        except Exception as e:
            activity_logger.error(f"Failed to initialize Chroma vectorstore: {e}")
            return None

    def get_vectorstore(self) -> Optional[Chroma]:
        return self._vectorstore

    async def ingest_document(
        self,
        file: UploadFile,
        course_id: int | None = None,
        user_id: int = None,
        course_folder: str = None,
    ) -> int:
        os.makedirs("temp", exist_ok=True)
        temp_filename = os.path.join("temp", f"temp_{file.filename}")

        try:
            with open(temp_filename, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            from app.services.knowledge_base.document_processor import DocumentProcessor

            # 使用統一的 DocumentProcessor 來讀取支援的所有檔案格式
            content = await DocumentProcessor.async_read_content(
                file_path=temp_filename, user_id=user_id, project_folder=course_folder
            )
            if not content:
                activity_logger.warning(
                    f"Unsupported document or empty content for {file.filename}. Skipping RAG ingestion."
                )
                return 0

            splits = self._text_splitter.split_document(
                content, file.filename, course_id=course_id
            )

            vectorstore = self.get_vectorstore()

            if vectorstore:
                vectorstore.add_documents(documents=splits)
                activity_logger.info(
                    f"Ingested {len(splits)} chunks for {file.filename} into RAG."
                )
                return len(splits)
            else:
                raise RAGIndexingError("Vectorstore is not initialized.")

        # Ensuring finally block properly catches any exceptions that occurred inside try block.
        except Exception as e:
            activity_logger.error(
                f"Error during RAG ingestion for {file.filename}: {e}"
            )
            raise RAGIndexingError(f"Failed to index document: {e}")

        finally:
            if os.path.exists(temp_filename):
                os.remove(temp_filename)

    async def expand_query(self, query: str) -> List[str]:
        """透過 LLM 將使用者的單一查詢擴展為多個相似搜尋詞 (Query Expansion)。"""
        prompt = f"""You are a helpful research assistant. 
        Generate 3 related search queries for the following topic to broaden the search scope.
        Topic: "{query}"
        
        Output START:
        1. 
        2. 
        3. 
        Output END.
        Just return the 3 lines of queries, nothing else."""

        try:
            # Depending on provider type, we might need different call.
            # BaseLLMProvider.generate_text handles simple string generation.
            response = await self._llm_provider.generate_text(
                [HumanMessage(content=prompt)]
            )
            lines = [
                line.strip().replace("1. ", "").replace("2. ", "").replace("3. ", "")
                for line in response.split("\n")
                if line.strip() and (line[0].isdigit() or len(line) > 3)
            ]
            return [query] + lines[:3]  # Original + up to 3 expansions
        except Exception as e:
            activity_logger.error(f"Query Expansion Failed for '{query}': {e}")
            return [query]

    async def rerank_documents(
        self, query: str, docs: List[Document], top_k: int = 5
    ) -> List[Document]:
        """
        根據查詢關聯性重新排序文件 (Reranking)。
        目前保留給未來實作 Cross-Encoder 或 LLM 篩選。
        """
        if not docs:
            return []

        # Simple Logic for now: Just return top K from vector search.
        # UPGRADE: Add a 'Cross-Encoder' call or LLM 'Filter' here.
        # e.g. ask LLM: "Which of these snippets answer '{query}' best?"
        return docs[:top_k]

    async def delete_course_context(self, course_id: int):
        vectorstore = self.get_vectorstore()
        if vectorstore:
            try:
                activity_logger.info(
                    f"Deleting RAG context for course_id={course_id}"
                )
                vectorstore.delete(where={"course_id": str(course_id)})
            except Exception as e:
                activity_logger.error(
                    f"Error deleting RAG context for course {course_id}: {e}"
                )

    async def delete_file_context(
        self,
        filename: str,
        course_id: int | None = None,
    ):
        """Deletes vector embeddings for a specific file in a scoped container."""
        vectorstore = self.get_vectorstore()
        if vectorstore:
            try:
                scope_filter = None
                if course_id is not None:
                    activity_logger.info(
                        f"Deleting RAG context for file={filename} in course_id={course_id}"
                    )
                    scope_filter = {"course_id": str(course_id)}

                if scope_filter is None:
                    return

                vectorstore.delete(where={"$and": [scope_filter, {"source": filename}]})
            except Exception as e:
                activity_logger.error(
                    f"Error deleting file context {filename}: {e}"
                )

    async def query_context(
        self,
        topic: str,
        k: Optional[int] = None,
        course_id: Optional[int] = None,
    ) -> List[str]:
        vectorstore = self.get_vectorstore()
        if not vectorstore:
            return []

        k_val = k if k is not None else settings.RAG_TOP_K

        # 1. 查詢擴充 (Query Expansion)
        if settings.RAG_ENABLE_QUERY_EXPANSION:
            queries = await self.expand_query(topic)
            activity_logger.info(f"Expanded Queries for '{topic}': {queries}")
        else:
            queries = [topic]

        # Prepare filter (ChromaDB uses 'filter' kwarg)
        search_kwargs = {"k": settings.RAG_SEARCH_K}
        if course_id:
            search_kwargs["filter"] = {"course_id": str(course_id)}

        all_docs = []
        for q in queries:
            # Search a bit more than k because we have multiple queries
            results = vectorstore.similarity_search(q, **search_kwargs)
            all_docs.extend(results)

        # 過濾重複內容 (Deduplication)
        seen = set()
        unique_docs = []
        for d in all_docs:
            if d.page_content not in seen:
                seen.add(d.page_content)
                unique_docs.append(d)

        # 2. 重新排序 (Reranking)
        top_docs = await self.rerank_documents(topic, unique_docs, top_k=k_val)

        # 3. 加入來源標籤 (Source Metadata Injection)
        final_contents = []
        for doc in top_docs:
            source_name = doc.metadata.get("source", "Unknown Document")
            final_contents.append(f"[Source: {source_name}]\n{doc.page_content}")

        return final_contents


from fastapi import Depends
from app.services.llm_clients.factory import get_llm_provider


def get_rag_engine(
    llm_provider: BaseLLMProvider = Depends(get_llm_provider),
) -> RAGEngine:
    """FastAPI Dependency for RAGEngine"""
    return RAGEngine(llm_provider=llm_provider)
