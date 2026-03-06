import asyncio
import os
from app.services.document_processor import DocumentProcessor
from app.core.config import settings

async def main():
    pdf_path = "uploads/1/9849af2f-5b22-4655-aea6-96f82b83232e/管數ch3.pdf"
    print(f"Settings PDF_PARSE_STRATEGY: {settings.PDF_PARSE_STRATEGY}")
    print(f"Testing document processor with {pdf_path}")
    
    content = await DocumentProcessor.async_read_content(
        file_path=pdf_path,
        user_id=1,
        project_folder="test_project"
    )
    
    print("\n=== EXTRACTION RESULT (First 1000 chars) ===")
    print(content[:1000])
    print("=========================")

if __name__ == "__main__":
    asyncio.run(main())
