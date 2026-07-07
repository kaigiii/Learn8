"""Deterministic Go puzzle bank.

Boards for the圍棋 question types are served from a pre-generated, verified bank
(``data/go_puzzles.json``) instead of being invented by the LLM. Every puzzle
was constructed and checked with real Go logic, so the board always matches its
answer. Regenerate with ``python scripts/gen_go_puzzles.py``.
"""

from __future__ import annotations

import json
import random
from functools import lru_cache
from typing import Any, Optional

from app.core.config import settings

# Components whose config.data should be replaced with a bank puzzle.
GO_COMPONENTS = frozenset(
    {
        "GoCountLiberties",
        "GoCaptureStones",
        "GoNoEntry",
        "GoCountTerritory",
        "GoKo",
        "GoEscape",
        "GoConnect",
        "GoCut",
    }
)


@lru_cache(maxsize=1)
def _load_bank() -> dict[str, list[dict[str, Any]]]:
    path = settings.DATA_DIR / "go_puzzles.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:  # pragma: no cover - defensive
        print(f"Warning: could not load Go puzzle bank at {path}: {exc}")
        return {}


def random_go_puzzle(component: str) -> Optional[dict[str, Any]]:
    """Return a fresh copy of a random puzzle's config.data for ``component``."""
    puzzles = _load_bank().get(component)
    if not puzzles:
        return None
    chosen = random.choice(puzzles)
    data: dict[str, Any] = {
        "question": chosen["question"],
        "board": list(chosen["board"]),
        "expectedAnswer": chosen["expectedAnswer"],
        "explanation": chosen.get("explanation", ""),
    }
    if chosen.get("acceptableAnswers"):
        data["acceptableAnswers"] = list(chosen["acceptableAnswers"])
    return data


def apply_go_puzzle_bank(stages: list) -> None:
    """Replace每個圍棋 stage's board with a random, verified bank puzzle.

    No-op when the bank is disabled or a component/board is unavailable, so the
    lesson still works even if the bank file is missing.
    """
    if not settings.GO_USE_PUZZLE_BANK:
        return
    for stage in stages:
        component = getattr(stage, "component", None)
        if component not in GO_COMPONENTS:
            continue
        puzzle = random_go_puzzle(component)
        if puzzle is None:
            continue
        try:
            stage.config.data = puzzle
        except Exception:  # pragma: no cover - defensive against schema changes
            continue
