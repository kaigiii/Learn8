import asyncio

import pytest

from app.schemas.questionnaire_schema import QuestionnaireResponse, QuestionnaireSubmission
from app.services.ai_agents.questionnaire_agent import QuestionnaireAgent
from app.services.llm_clients.factory import LLMFactory


def test_questionnaire_agent_uses_fake_provider_by_default(fake_provider, fake_rag_engine):
    agent = QuestionnaireAgent(fake_provider, fake_rag_engine)

    questions = asyncio.run(agent.generate_questions("Python Basics", course_id=1))

    assert len(questions) == 2
    assert all(question.options for question in questions)


def test_questionnaire_agent_summarizes_without_real_ai(fake_provider, fake_rag_engine):
    agent = QuestionnaireAgent(fake_provider, fake_rag_engine)

    submission = QuestionnaireSubmission(
        responses=[
            QuestionnaireResponse(question_id="q1", answer="Beginner"),
            QuestionnaireResponse(question_id="q2", answer="Hands-on"),
        ]
    )

    questions = asyncio.run(agent.generate_questions("Python Basics", course_id=1))
    profile = asyncio.run(agent.summarize_responses("Python Basics", submission, questions))

    assert profile.summary == "Mock learner profile."
    assert profile.attributes["style"] == "hands-on"


@pytest.mark.ai
def test_real_ai_provider_can_generate_questionnaire_smoke():
    provider = LLMFactory.create()
    fake_rag_engine = type(
        "FakeRAG",
        (),
        {
            "query_context": staticmethod(
                lambda topic, k=2, course_id=None: asyncio.sleep(0, result=[])
            )
        },
    )()
    agent = QuestionnaireAgent(provider, fake_rag_engine)

    questions = asyncio.run(agent.generate_questions("Intro to HTTP"))

    assert questions
