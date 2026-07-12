import os
from typing import Any, Type

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./learn8-test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("GOOGLE_API_KEY", "dummy-key-for-testing")
os.environ.setdefault("GEMINI_API_KEY", "dummy-key-for-testing")

from app.db.base import Base
from app.db import registry  # noqa: F401
from app.models.user import UserModel
from app.schemas.questionnaire_schema import LearnerProfile, Question
from app.services.ai_engine.clients.base_provider import BaseLLMProvider


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    run_ai_tests = os.getenv("LEARN8_RUN_AI_TESTS") == "1"
    if run_ai_tests:
        return

    skip_ai = pytest.mark.skip(reason="AI tests are disabled by default. Set LEARN8_RUN_AI_TESTS=1 to enable.")
    for item in items:
        if "ai" in item.keywords:
            item.add_marker(skip_ai)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """
    Ensure the database is initialized (tables created) and seeded 
    with public courses before running any tests.
    """
    from app.db.session import engine
    from app.core.course_loader import registry as course_registry
    from app.db.session import SessionLocal

    # Create all tables on the target database (e.g., learn8-ci.db in GHA)
    Base.metadata.create_all(bind=engine)

    # Automatically sync public courses so integration tests have data
    db = SessionLocal()
    try:
        course_registry.sync_to_db(db)
    finally:
        db.close()


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def user(db_session):
    db_user = UserModel(
        email="test@learn8.ai",
        hashed_password="hashed",
        credits=100,
        xp=0,
        level=1,
        xp_to_next_level=100,
    )
    db_session.add(db_user)
    db_session.commit()
    db_session.refresh(db_user)
    return db_user


class FakeLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()
        self.last_messages: list[Any] | None = None

    def bind_files(self, files: list[str], use_google_file_api: bool = True) -> "FakeLLMProvider":
        self._inject_local_files(files)
        return self

    async def generate_text(self, messages: list[Any], **kwargs) -> str:
        self.last_messages = messages
        return "Mocked plain-text response."

    async def generate_structured(self, messages: list[Any], schema: Type[Any], **kwargs) -> Any:
        self.last_messages = messages
        if schema.__name__ == "QuestionList":
            return schema(
                questions=[
                    Question(
                        id="q1",
                        text="What is your current familiarity with this topic?",
                        options=["Beginner", "Intermediate", "Advanced"],
                    ),
                    Question(
                        id="q2",
                        text="How do you prefer to learn?",
                        options=["Visual", "Hands-on", "Theory-first"],
                    ),
                ]
            )
        if schema is LearnerProfile:
            return LearnerProfile(
                summary="Mock learner profile.",
                attributes={"pace": "steady", "style": "hands-on"},
            )
        if schema.__name__ == "FeynmanGrade":
            return schema(isCorrect=True, feedback="Nice explanation.")
        raise AssertionError(f"FakeLLMProvider has no stub for schema {schema.__name__}")


class FakeRAGEngine:
    async def query_context(self, topic: str, k: int | None = None, course_id: int | None = None):
        return [f"[Source: test]\nContext for {topic}"]


@pytest.fixture()
def fake_provider():
    return FakeLLMProvider()


@pytest.fixture()
def fake_rag_engine():
    return FakeRAGEngine()
