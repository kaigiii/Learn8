import pytest

def test_questionnaire_prompts_format():
    from app.services.ai_engine.agents.questionnaire_prompts import (
        GENERATE_QUESTIONS_PROMPT,
        SUMMARIZE_PROFILE_PROMPT,
    )
    # Verify that formatting doesn't raise KeyError or other exceptions
    q_formatted = GENERATE_QUESTIONS_PROMPT.format(
        topic="Go Game",
        preferred_language="zh-TW",
        context="Go is a board game played on a grid."
    )
    assert "Go Game" in q_formatted
    assert "zh-TW" in q_formatted

    p_formatted = SUMMARIZE_PROFILE_PROMPT.format(
        topic="Go Game",
        preferred_language="zh-TW",
        qa_pairs="Q: How do you play?\nA: Placed on cross-points."
    )
    assert "Go Game" in p_formatted
    assert "zh-TW" in p_formatted


def test_course_architect_prompts_format():
    from app.services.ai_engine.agents.course_architect_prompts import (
        build_node_system_prompt,
        build_remedial_system_prompt,
        SYSTEM_PROMPT_FEYNMAN_STUDENT,
        SYSTEM_PROMPT_FEYNMAN_ADVISOR,
    )
    
    # 1. Test build_node_system_prompt
    node_prompt = build_node_system_prompt(component_names=["MultipleChoice"])
    formatted_node_prompt = node_prompt.format(profile="Learner loves hands-on coding")
    assert "Learner loves hands-on coding" in formatted_node_prompt
    assert "MultipleChoice" in formatted_node_prompt

    # 2. Test build_remedial_system_prompt
    remedial_prompt = build_remedial_system_prompt(profile="Struggles with coordinates")
    assert "Struggles with coordinates" in remedial_prompt

    # 3. Test SYSTEM_PROMPT_FEYNMAN_STUDENT
    student_formatted = SYSTEM_PROMPT_FEYNMAN_STUDENT.format(
        topic="Counting liberties",
        context="A stone on the board has liberties on adjacent cross-points."
    )
    assert "Counting liberties" in student_formatted
    assert "adjacent cross-points" in student_formatted

    # 4. Test SYSTEM_PROMPT_FEYNMAN_ADVISOR
    advisor_formatted = SYSTEM_PROMPT_FEYNMAN_ADVISOR.format(
        topic="Counting liberties",
        round_count=3,
        context="A stone on the board has liberties on adjacent cross-points."
    )
    assert "Counting liberties" in advisor_formatted
    assert "adjacent cross-points" in advisor_formatted
    assert "3" in advisor_formatted


def test_syllabus_prompts():
    from app.services.ai_engine.agents.syllabus_prompts import (
        PLANNER_SYSTEM_PROMPT,
        AUDITOR_SYSTEM_PROMPT,
    )
    # Simply assert that they are non-empty strings
    assert len(PLANNER_SYSTEM_PROMPT.strip()) > 0
    assert len(AUDITOR_SYSTEM_PROMPT.strip()) > 0
