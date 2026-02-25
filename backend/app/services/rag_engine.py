"""
模組名稱: app.services.rag_engine
功能描述: RAG 知識檢索引擎 (Retrieval-Augmented Generation Engine)

負責將使用者的 PDF 文件轉換為向量索引 (Vector Index)，並提供語意搜尋功能。
整合了 Google Gemini Embeddings 與 ChromaDB。

核心類別:
    - RAGEngine (Class Methods, Singleton Vectorstore)

主要流程:
    1. Ingestion (索引建立):
       PDF -> PyPDFLoader -> Text Splitter (Chunking) -> Embeddings -> ChromaDB。
       *重點*: 每個 Document 都會標記 `project_id` metadata 以實現資料隔離。

    2. Retrieval (搜尋):
       Query -> Query Expansion (生成 3 個相關查詢) -> Vector Search (Chroma) -> Reranking (過濾) -> Context。

方法清單:
    - ingest_pdf: 處理檔案上傳並建立索引。
    - query_context: 根據 Topic 搜尋相關知識片段。
    - delete_project_context: 清除指定專案的所有向量資料。
"""

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
from app.services.llm.factory import LLMFactory
from langchain_core.messages import SystemMessage, HumanMessage

class RAGEngine:
    DB_DIR = "./chroma_db"
    _vectorstore: Optional[Chroma] = None
    
    @classmethod
    def get_vectorstore(cls) -> Optional[Chroma]:
        if cls._vectorstore is not None:
            return cls._vectorstore

        if not settings.GOOGLE_API_KEY:
            print("Warning: GOOGLE_API_KEY not found. RAG features will fail.")
            return None

        embedding_function = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.GOOGLE_API_KEY
        )
        cls._vectorstore = Chroma(persist_directory=cls.DB_DIR, embedding_function=embedding_function)
        return cls._vectorstore

    @staticmethod
    async def ingest_pdf(file: UploadFile, project_id: int) -> int:
        temp_filename = f"temp_{file.filename}"
        
        try:
            with open(temp_filename, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            loader = PyPDFLoader(temp_filename)
            pages = loader.load()
            
            # Add metadata for isolation
            for page in pages:
                page.metadata["project_id"] = str(project_id)
                page.metadata["source"] = file.filename
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                add_start_index=True,
            )
            splits = text_splitter.split_documents(pages)
            
            vectorstore = RAGEngine.get_vectorstore()
            if vectorstore:
                vectorstore.add_documents(documents=splits)
                return len(splits)
            else:
                return 0
            
        finally:
            if os.path.exists(temp_filename):
                os.remove(temp_filename)

    @staticmethod
    async def expand_query(query: str) -> List[str]:
        """Expands a single user query into multiple search variations using LLM."""
        provider = LLMFactory.create()
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
             response = await provider.generate_text([HumanMessage(content=prompt)])
             lines = [line.strip().replace("1. ", "").replace("2. ", "").replace("3. ", "") 
                      for line in response.split("\n") 
                      if line.strip() and (line[0].isdigit() or len(line) > 3)]
             return [query] + lines[:3] # Original + up to 3 expansions
        except Exception as e:
            print(f"Query Expansion Failed: {e}")
            return [query]

    @staticmethod
    async def rerank_documents(query: str, docs: List[Document], top_k: int = 5) -> List[str]:
        """
        Reranks documents based on relevance to the query.
        Currently a specialized prompt-based reranker or a simple placeholder.
        Real Cross-Encoders are heavy, so we might use LLM to pick the best ones.
        """
        if not docs: return []
        
        # Simple Logic for now: Just return top K from vector search.
        # UPGRADE: Add a 'Cross-Encoder' call or LLM 'Filter' here.
        # e.g. ask LLM: "Which of these snippets answer '{query}' best?"
        return [doc.page_content for doc in docs[:top_k]]

    @staticmethod
    async def delete_project_context(project_id: int):
        """Deletes all vector embeddings associated with a project."""
        vectorstore = RAGEngine.get_vectorstore()
        if vectorstore:
            try:
                # ChromaDB specific: delete by where clause
                print(f"🗑️ Deleting RAG context for project_id={project_id}")
                vectorstore.delete(where={"project_id": str(project_id)})
            except Exception as e:
                print(f"Error deleting RAG context: {e}")

    @staticmethod
    async def delete_file_context(project_id: int, filename: str):
        """Deletes vector embeddings for a specific file in a project."""
        vectorstore = RAGEngine.get_vectorstore()
        if vectorstore:
            try:
                print(f"🗑️ Deleting RAG context for file={filename} in project_id={project_id}")
                # ChromaDB where clause with multiple conditions
                vectorstore.delete(where={"$and": [{"project_id": str(project_id)}, {"source": filename}]})
            except Exception as e:
                print(f"Error deleting file context: {e}")

    @staticmethod
    async def query_context(topic: str, k: int = 4, project_id: Optional[int] = None) -> List[str]:
        vectorstore = RAGEngine.get_vectorstore()
        if not vectorstore:
            return []
            
        # 1. Expand
        queries = await RAGEngine.expand_query(topic)
        print(f"🔎 Expanded Queries: {queries}")
        
        # Prepare filter (ChromaDB uses 'filter' kwarg)
        # If project_id is provided, strict filter. If None, theoretically searches everything (or nothing? safe to search existing global?)
        # For security, ideally we force project_id, but for backward compat we might leave it optional or assume "public"
        search_kwargs = {"k": 2}
        if project_id:
            search_kwargs["filter"] = {"project_id": str(project_id)}
        
        all_docs = []
        for q in queries:
            # Search a bit more than k because we have multiple queries
            results = vectorstore.similarity_search(q, **search_kwargs) 
            all_docs.extend(results)
            
        # Deduplicate by page_content
        seen = set()
        unique_docs = []
        for d in all_docs:
            if d.page_content not in seen:
                seen.add(d.page_content)
                unique_docs.append(d)
        
        # 2. Rerank
        final_contents = await RAGEngine.rerank_documents(topic, unique_docs, top_k=k)
        
        return final_contents
