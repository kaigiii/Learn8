import asyncio
from app.services.llm.factory import get_llm_provider
from app.services.rag_engine import get_rag_engine
from app.services.file_service import get_file_service

async def test():
    try:
        provider = get_llm_provider()
        print("LLM Provider loaded.")
        file_srv = get_file_service()
        print("File Service loaded.")
        rag = get_rag_engine(llm_provider=provider)
        print("RAG Engine loaded.")
        print(rag.get_vectorstore())
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
