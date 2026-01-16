
import os
import shutil
from typing import List, Optional
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from app.core.config import settings

class RAGEngine:
    DB_DIR = "./chroma_db"
    
    @staticmethod
    def get_vectorstore() -> Optional[Chroma]:
        if not settings.GOOGLE_API_KEY:
            print("Warning: GOOGLE_API_KEY not found. RAG features will fail.")
            return None

        embedding_function = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=settings.GOOGLE_API_KEY
        )
        return Chroma(persist_directory=RAGEngine.DB_DIR, embedding_function=embedding_function)

    @staticmethod
    async def ingest_pdf(file: UploadFile) -> int:
        temp_filename = f"temp_{file.filename}"
        
        try:
            with open(temp_filename, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            loader = PyPDFLoader(temp_filename)
            pages = loader.load()
            
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
    def query_context(topic: str, k: int = 4) -> List[str]:
        vectorstore = RAGEngine.get_vectorstore()
        if not vectorstore:
            return []
        results = vectorstore.similarity_search(topic, k=k)
        return [doc.page_content for doc in results]
