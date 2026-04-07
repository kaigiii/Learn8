class ScoringService:
    def score_answer(self, *, is_correct: bool, response_time_ms: int | None, timer_seconds: int) -> int:
        if not is_correct:
            return 0

        if response_time_ms is None:
            return 600

        max_window = max(timer_seconds * 1000, 1)
        normalized = max(0.0, min(1.0, 1 - (response_time_ms / max_window)))
        return max(300, 600 + int(normalized * 400))
