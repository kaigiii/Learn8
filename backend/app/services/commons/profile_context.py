def build_generation_profile_context(
    profile_summary: str | None,
    preferred_language: str | None,
    default_summary: str,
) -> str:
    summary = (profile_summary or "").strip() or default_summary
    language = (preferred_language or "").strip()
    if language:
        return f"{summary}\nPreferred response language: {language}"
    return summary
