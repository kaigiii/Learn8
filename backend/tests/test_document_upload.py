import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import UploadFile
from app.api.v1.endpoints.courses import upload_course_document
from app.models.user import UserModel
from app.models.course import CourseModel
from app.domain.statuses import CourseStatus
from app.services.infra.files.service import FileService
from app.services.ai_engine.kb.rag_engine import RAGEngine
from sqlalchemy.orm import Session


@pytest.mark.anyio
async def test_upload_course_document_skip_rag():
    file_mock = MagicMock(spec=UploadFile)
    file_mock.seek = AsyncMock()
    current_user = UserModel(id=1, email="test@example.com")
    
    db_mock = MagicMock(spec=Session)
    course_mock = CourseModel(id=42, user_id=1, folder_name="test-folder", status=CourseStatus.DRAFT)
    db_mock.query().filter().first.return_value = course_mock
    
    file_service_mock = MagicMock(spec=FileService)
    rag_engine_mock = MagicMock(spec=RAGEngine)
    rag_engine_mock.ingest_document = AsyncMock()

    # Call with ingest_rag = False
    result = await upload_course_document(
        file=file_mock,
        course_id=42,
        ingest_rag=False,
        current_user=current_user,
        db=db_mock,
        file_service=file_service_mock,
        rag_engine=rag_engine_mock
    )
    
    # Verify save_upload_file is called, but ingest_document is NOT called
    file_service_mock.save_upload_file.assert_called_once_with(file_mock, 1, "test-folder")
    rag_engine_mock.ingest_document.assert_not_called()
    assert result == {"message": "File uploaded successfully (RAG ingestion skipped)."}


@pytest.mark.anyio
async def test_upload_course_document_with_rag():
    file_mock = MagicMock(spec=UploadFile)
    file_mock.seek = AsyncMock()
    current_user = UserModel(id=1, email="test@example.com")
    
    db_mock = MagicMock(spec=Session)
    course_mock = CourseModel(id=42, user_id=1, folder_name="test-folder", status=CourseStatus.DRAFT)
    db_mock.query().filter().first.return_value = course_mock
    
    file_service_mock = MagicMock(spec=FileService)
    rag_engine_mock = MagicMock(spec=RAGEngine)
    rag_engine_mock.ingest_document = AsyncMock()

    # Call with ingest_rag = True
    result = await upload_course_document(
        file=file_mock,
        course_id=42,
        ingest_rag=True,
        current_user=current_user,
        db=db_mock,
        file_service=file_service_mock,
        rag_engine=rag_engine_mock
    )
    
    # Verify save_upload_file is called, and ingest_document is called
    file_service_mock.save_upload_file.assert_called_once_with(file_mock, 1, "test-folder")
    rag_engine_mock.ingest_document.assert_called_once()
    assert result == {"message": "File uploaded and ingested."}
