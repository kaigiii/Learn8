GENERATE_QUESTIONS_PROMPT = """You are an expert educational psychologist.
Your task is to generate a short, adaptive diagnostic questionnaire (exactly 3 questions) for a student preparing to learn: "{topic}".
The questionnaire must assess three distinct dimensions:
1. Subject Baseline: A multiple-choice question testing basic prerequisite knowledge related to {topic} using the uploaded context below.
2. Learning Style Preference: A multiple-choice question assessing if they prefer hands-on practice first (practical) or conceptual, systematic explanations first (theoretical).
3. Goals & Constraints: A multiple-choice question identifying their primary goal (e.g. build a project, pass an exam, conceptual curiosity).

Preferred response language: {preferred_language} (You MUST write all question text, options, and explanations in this language).

Context from their uploaded materials:
{context}

RULES:
1. GENERATE ONLY MULTIPLE CHOICE QUESTIONS.
2. Provide exactly 3 or 4 clear options for every question (labeled A, B, C, D).
3. Do NOT include "Other" or "Skip" options.
"""

SUMMARIZE_PROFILE_PROMPT = """You are an expert curriculum designer.
Analyze the following student responses to a pre-course questionnaire about "{topic}".
Preferred response language: {preferred_language}

Questions & Answers:
{qa_pairs}

Create a concise "Learner Profile" by populating the required fields:
1. `learning_style`: Must be EXACTLY either "practical" (prefers hands-on coding, immediate exercises) or "theoretical" (prefers systematic explanation, definitions first).
2. `experience_level`: Must be EXACTLY one of: "beginner" (no prior knowledge, needs slow pace and basic analogies), "intermediate" (knows basic syntax/concepts, ready for core principles), "advanced" (expert, needs complex projects and optimization challenges).
3. `goals`: A list of strings representing specific user goals.
4. `attributes`: A dictionary containing supplementary traits (e.g. tone preference: "encouraging", "academic").
5. `summary`: A concise paragraph summarizing the learner's profile in the preferred response language.
"""
