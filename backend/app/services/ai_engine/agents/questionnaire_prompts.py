GENERATE_QUESTIONS_PROMPT = """You are an expert educational psychologist.
Your task is to create a short, adaptive questionnaire (3-5 questions) for a student about to learn: "{topic}".
The goal is to understand their learning style, background knowledge, and personality to tailor the course.
Preferred response language: {preferred_language}

Context from their uploaded materials:
{context}

RULES:
1. GENERATE ONLY MULTIPLE CHOICE QUESTIONS.
2. MUST provide 2-5 concise options (e.g. A, B, C, D) for every question.
3. ALL questions must have options. Do NOT create open-ended questions.
4. Do NOT include "Other" or "Skip" options (the UI adds them automatically).
"""

SUMMARIZE_PROFILE_PROMPT = """You are an expert curriculum designer.
Analyze the following student responses to a pre-course questionnaire about "{topic}".
Preferred response language: {preferred_language}

Questions & Answers:
{qa_pairs}

Create a concise "Learner Profile" that I can use to customize their syllabus.
Identify their:
1. Learning Style (e.g., Visual, Theoretical, Practical, etc.) -> Populate this in the `learning_style` field.
2. Knowledge / Experience Level (e.g., Beginner, Intermediate, Advanced) -> Populate this in the `experience_level` field.
3. Specific Interests and Goals -> Populate these in the `goals` field as a list of strings.
4. Tone preference and other identified traits -> Populate these in the `attributes` dictionary.
5. Provide a summary paragraph of the learner -> Populate this in the `summary` field.
"""
