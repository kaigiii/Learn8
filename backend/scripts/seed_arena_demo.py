from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.db import registry as _registry  # noqa: F401
from app.db.session import SessionLocal
from app.domain.arena_ranks import resolve_arena_rank_tier
from app.models.arena_question_pool import ArenaQuestionPoolItemModel, ArenaQuestionPoolModel
from app.models.arena_rating import (
    ArenaPlayerTopicRatingModel,
    ArenaRankHistoryModel,
    ArenaRatingModel,
)
from app.models.arena_season import ArenaSeasonModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel


@dataclass(frozen=True)
class SeedCourse:
    slug: str
    title: str
    topic: str
    description: str
    difficulty: str
    tags: list[str]
    pool_slug: str
    pool_title: str
    pool_description: str
    questions: list[dict]


COURSE_SEEDS: list[SeedCourse] = [
    SeedCourse(
        slug="calculus-sprint",
        title="Calculus Sprint",
        topic="Limits, derivatives, and core rate-of-change intuition",
        description="Fast Arena topic covering first-pass differential calculus concepts.",
        difficulty="intermediate",
        tags=["calculus", "derivatives", "limits"],
        pool_slug="calculus-sprint-v1",
        pool_title="Calculus Sprint Pool",
        pool_description="Balanced private-room pool for intro calculus battles.",
        questions=[
            {
                "questionKey": "calc-derivative-x2",
                "prompt": "What is the derivative of x^2?",
                "correctOptionId": "a",
                "difficulty": "normal",
                "knowledgeTags": ["derivatives", "power-rule"],
                "explanation": "The power rule turns x^2 into 2x.",
                "options": [
                    {"id": "a", "text": "2x"},
                    {"id": "b", "text": "x"},
                    {"id": "c", "text": "x^3"},
                    {"id": "d", "text": "2"},
                ],
            },
            {
                "questionKey": "calc-limit-constant",
                "prompt": "What is lim(x->3) 7?",
                "correctOptionId": "c",
                "difficulty": "normal",
                "knowledgeTags": ["limits"],
                "explanation": "The limit of a constant is the constant itself.",
                "options": [
                    {"id": "a", "text": "0"},
                    {"id": "b", "text": "3"},
                    {"id": "c", "text": "7"},
                    {"id": "d", "text": "Undefined"},
                ],
            },
            {
                "questionKey": "calc-derivative-sin",
                "prompt": "What is the derivative of sin(x)?",
                "correctOptionId": "b",
                "difficulty": "hard",
                "knowledgeTags": ["derivatives", "trigonometry"],
                "explanation": "d/dx sin(x) = cos(x).",
                "options": [
                    {"id": "a", "text": "-cos(x)"},
                    {"id": "b", "text": "cos(x)"},
                    {"id": "c", "text": "-sin(x)"},
                    {"id": "d", "text": "tan(x)"},
                ],
            },
            {
                "questionKey": "calc-tangent-meaning",
                "prompt": "The derivative at a point gives the slope of which line?",
                "correctOptionId": "d",
                "difficulty": "normal",
                "knowledgeTags": ["derivatives", "interpretation"],
                "explanation": "A derivative at a point is the slope of the tangent line there.",
                "options": [
                    {"id": "a", "text": "A vertical line"},
                    {"id": "b", "text": "A secant through the origin"},
                    {"id": "c", "text": "Any parallel line"},
                    {"id": "d", "text": "The tangent line"},
                ],
            },
            {
                "questionKey": "calc-power-rule-x5",
                "prompt": "Using the power rule, what is the derivative of x^5?",
                "correctOptionId": "a",
                "difficulty": "normal",
                "knowledgeTags": ["derivatives", "power-rule"],
                "explanation": "Bring down the exponent and subtract one: 5x^4.",
                "options": [
                    {"id": "a", "text": "5x^4"},
                    {"id": "b", "text": "4x^5"},
                    {"id": "c", "text": "5x"},
                    {"id": "d", "text": "x^4"},
                ],
            },
        ],
    ),
    SeedCourse(
        slug="python-core-clash",
        title="Python Core Clash",
        topic="Python basics, data structures, and everyday language behavior",
        description="Official Arena topic for Python syntax and reasoning fundamentals.",
        difficulty="beginner",
        tags=["python", "programming", "basics"],
        pool_slug="python-core-clash-v1",
        pool_title="Python Core Clash Pool",
        pool_description="Starter coding knowledge questions for private matches.",
        questions=[
            {
                "questionKey": "py-list-mutable",
                "prompt": "Which Python built-in collection is mutable?",
                "correctOptionId": "b",
                "difficulty": "normal",
                "knowledgeTags": ["python", "data-structures"],
                "explanation": "Lists are mutable; tuples are not.",
                "options": [
                    {"id": "a", "text": "tuple"},
                    {"id": "b", "text": "list"},
                    {"id": "c", "text": "str"},
                    {"id": "d", "text": "frozenset"},
                ],
            },
            {
                "questionKey": "py-len-dict",
                "prompt": "What does len({'a': 1, 'b': 2}) return?",
                "correctOptionId": "c",
                "difficulty": "normal",
                "knowledgeTags": ["python", "dict"],
                "explanation": "len on a dict returns the number of keys.",
                "options": [
                    {"id": "a", "text": "1"},
                    {"id": "b", "text": "4"},
                    {"id": "c", "text": "2"},
                    {"id": "d", "text": "Error"},
                ],
            },
            {
                "questionKey": "py-for-range-3",
                "prompt": "How many times does `for i in range(3):` loop?",
                "correctOptionId": "a",
                "difficulty": "normal",
                "knowledgeTags": ["python", "loops"],
                "explanation": "range(3) yields 0, 1, 2.",
                "options": [
                    {"id": "a", "text": "3"},
                    {"id": "b", "text": "2"},
                    {"id": "c", "text": "4"},
                    {"id": "d", "text": "Infinite"},
                ],
            },
            {
                "questionKey": "py-boolean-none",
                "prompt": "What is bool(None) in Python?",
                "correctOptionId": "d",
                "difficulty": "normal",
                "knowledgeTags": ["python", "truthiness"],
                "explanation": "None is falsy, so bool(None) is False.",
                "options": [
                    {"id": "a", "text": "None"},
                    {"id": "b", "text": "0"},
                    {"id": "c", "text": "True"},
                    {"id": "d", "text": "False"},
                ],
            },
            {
                "questionKey": "py-string-index",
                "prompt": "What is 'learn'[0]?",
                "correctOptionId": "a",
                "difficulty": "easy",
                "knowledgeTags": ["python", "strings"],
                "explanation": "Python strings are zero-indexed.",
                "options": [
                    {"id": "a", "text": "l"},
                    {"id": "b", "text": "e"},
                    {"id": "c", "text": "n"},
                    {"id": "d", "text": "Error"},
                ],
            },
        ],
    ),
    SeedCourse(
        slug="world-history-rush",
        title="World History Rush",
        topic="Big-picture events, chronology, and global historical turning points",
        description="General-history topic built for casual social Arena matches.",
        difficulty="intermediate",
        tags=["history", "civilizations", "timeline"],
        pool_slug="world-history-rush-v1",
        pool_title="World History Rush Pool",
        pool_description="Chronology-heavy history pool for Arena demo sessions.",
        questions=[
            {
                "questionKey": "hist-french-revolution",
                "prompt": "In which country did the French Revolution begin?",
                "correctOptionId": "b",
                "difficulty": "easy",
                "knowledgeTags": ["history", "europe"],
                "explanation": "The French Revolution began in France in 1789.",
                "options": [
                    {"id": "a", "text": "Spain"},
                    {"id": "b", "text": "France"},
                    {"id": "c", "text": "Italy"},
                    {"id": "d", "text": "Austria"},
                ],
            },
            {
                "questionKey": "hist-ww2-end",
                "prompt": "World War II ended in what year?",
                "correctOptionId": "d",
                "difficulty": "normal",
                "knowledgeTags": ["history", "ww2"],
                "explanation": "World War II ended in 1945.",
                "options": [
                    {"id": "a", "text": "1939"},
                    {"id": "b", "text": "1941"},
                    {"id": "c", "text": "1944"},
                    {"id": "d", "text": "1945"},
                ],
            },
            {
                "questionKey": "hist-roman-empire",
                "prompt": "Which city is traditionally considered the center of the Roman Empire?",
                "correctOptionId": "a",
                "difficulty": "normal",
                "knowledgeTags": ["history", "rome"],
                "explanation": "Rome was the political and symbolic center of the empire.",
                "options": [
                    {"id": "a", "text": "Rome"},
                    {"id": "b", "text": "Athens"},
                    {"id": "c", "text": "Alexandria"},
                    {"id": "d", "text": "Carthage"},
                ],
            },
            {
                "questionKey": "hist-industrial-revolution",
                "prompt": "The Industrial Revolution began first in which country?",
                "correctOptionId": "c",
                "difficulty": "hard",
                "knowledgeTags": ["history", "industrial-revolution"],
                "explanation": "It began in Great Britain before spreading elsewhere.",
                "options": [
                    {"id": "a", "text": "Germany"},
                    {"id": "b", "text": "United States"},
                    {"id": "c", "text": "Great Britain"},
                    {"id": "d", "text": "Japan"},
                ],
            },
            {
                "questionKey": "hist-cold-war",
                "prompt": "The Cold War was primarily a rivalry between the United States and which state?",
                "correctOptionId": "b",
                "difficulty": "normal",
                "knowledgeTags": ["history", "cold-war"],
                "explanation": "The central rivalry was between the United States and the Soviet Union.",
                "options": [
                    {"id": "a", "text": "France"},
                    {"id": "b", "text": "Soviet Union"},
                    {"id": "c", "text": "China"},
                    {"id": "d", "text": "Italy"},
                ],
            },
        ],
    ),
]


def main() -> None:
    db = SessionLocal()
    try:
        print("Seeding Arena demo data...")
        season = upsert_active_season(db)
        course_models = [upsert_course_bundle(db, seed) for seed in COURSE_SEEDS]
        seeded_users = seed_ratings_for_existing_users(db, course_models, season.id)
        print(f"Seeded {len(course_models)} public courses with active question pools.")
        print(f"Seeded ratings/history for {seeded_users} existing users.")
        print("Arena demo seed complete.")
    finally:
        db.close()


def upsert_active_season(db: Session):
    season_name = "Founders Preseason"
    season = (
        db.query(ArenaSeasonModel)
        .filter(ArenaSeasonModel.name == season_name)
        .first()
    )

    if season is None:
        season = ArenaSeasonModel(name=season_name)
        db.add(season)

    db.query(ArenaSeasonModel).update({"is_active": False})
    season.status = "active"
    season.is_active = True
    season.started_at = season.started_at or utc_now_naive()
    season.leaderboard_config_json = {"mode": "global", "label": "Demo season"}
    season.reward_config_json = {"xp_bonus": 50, "credits_bonus": 25}
    db.commit()
    db.refresh(season)
    return season


def upsert_course_bundle(db: Session, seed: SeedCourse) -> PublicCourseModel:
    course = (
        db.query(PublicCourseModel)
        .filter(PublicCourseModel.slug == seed.slug)
        .first()
    )

    if course is None:
        course = PublicCourseModel(
            slug=seed.slug,
            title=seed.title,
            topic=seed.topic,
            description=seed.description,
            difficulty=seed.difficulty,
            is_published=True,
            is_arena_enabled=True,
            tags_json=seed.tags,
        )
        db.add(course)
        db.flush()

    course.title = seed.title
    course.topic = seed.topic
    course.description = seed.description
    course.difficulty = seed.difficulty
    course.is_published = True
    course.is_arena_enabled = True
    course.tags_json = seed.tags
    course.syllabus_json = {
        "courseTitle": seed.title,
        "description": seed.description,
        "units": [
            {
                "unitId": f"{seed.slug}-unit-1",
                "unitTitle": "Core Concepts",
                "unitDescription": "Foundational topics for this arena.",
                "nodes": [
                    {
                        "id": f"{seed.slug}-node-1",
                        "title": "Introduction",
                        "description": "Welcome to the arena prep for " + seed.title,
                        "status": "available",
                        "hasGeneratedLesson": False
                    },
                    {
                        "id": f"{seed.slug}-node-2",
                        "title": "Advanced Drills",
                        "description": "More complex challenges.",
                        "status": "locked",
                        "hasGeneratedLesson": False
                    }
                ]
            }
        ]
    }
    db.add(course)
    db.flush()

    pool = (
        db.query(ArenaQuestionPoolModel)
        .filter(
            ArenaQuestionPoolModel.public_course_id == course.id,
            ArenaQuestionPoolModel.slug == seed.pool_slug,
        )
        .first()
    )
    if pool is None:
        pool = ArenaQuestionPoolModel(
            public_course_id=course.id,
            slug=seed.pool_slug,
            title=seed.pool_title,
            description=seed.pool_description,
            is_active=True,
            version=1,
        )
        db.add(pool)
        db.flush()

    pool.title = seed.pool_title
    pool.description = seed.pool_description
    pool.is_active = True
    pool.version = 1
    db.add(pool)
    db.flush()

    existing_items = {
        item.question_key: item
        for item in db.query(ArenaQuestionPoolItemModel)
        .filter(ArenaQuestionPoolItemModel.pool_id == pool.id)
        .all()
    }

    incoming_keys = set()
    for question in seed.questions:
        incoming_keys.add(question["questionKey"])
        item = existing_items.get(question["questionKey"])
        if item is None:
            item = ArenaQuestionPoolItemModel(
                pool_id=pool.id,
                question_key=question["questionKey"],
            )
            db.add(item)

        item.prompt = question["prompt"]
        item.options_json = question["options"]
        item.correct_option_id = question["correctOptionId"]
        item.difficulty = question.get("difficulty", "normal")
        item.knowledge_tags_json = question.get("knowledgeTags", [])
        item.explanation = question.get("explanation")
        item.source_unit_id = question.get("sourceUnitId")
        item.source_node_id = question.get("sourceNodeId")
        item.is_active = True
        db.add(item)

    for question_key, item in existing_items.items():
        if question_key not in incoming_keys:
            db.delete(item)

    db.commit()
    db.refresh(course)
    return course


def seed_ratings_for_existing_users(
    db: Session,
    courses: list[PublicCourseModel],
    season_id: int,
) -> int:
    users = db.query(UserModel).order_by(UserModel.id.asc()).all()
    if not users:
        return 0

    for index, user in enumerate(users):
        base_rating = 980 + (index * 85)
        wins = 3 + index
        losses = max(0, index // 2)
        draws = 1 if index % 3 == 0 else 0
        rank_tier = resolve_arena_rank_tier(base_rating)

        rating = db.query(ArenaRatingModel).filter(ArenaRatingModel.user_id == user.id).first()
        if rating is None:
            rating = ArenaRatingModel(user_id=user.id)
            db.add(rating)

        rating.rating = base_rating
        rating.rank_tier = rank_tier
        rating.best_rank_tier = rank_tier
        rating.wins = wins
        rating.losses = losses
        rating.draws = draws
        rating.ranked_matches = wins + losses + draws
        db.add(rating)
        db.flush()

        for course_offset, course in enumerate(courses):
            topic_rating_value = base_rating + (course_offset * 15) - 10
            topic_rating = (
                db.query(ArenaPlayerTopicRatingModel)
                .filter(
                    ArenaPlayerTopicRatingModel.user_id == user.id,
                    ArenaPlayerTopicRatingModel.public_course_id == course.id,
                )
                .first()
            )
            if topic_rating is None:
                topic_rating = ArenaPlayerTopicRatingModel(
                    user_id=user.id,
                    public_course_id=course.id,
                )
                db.add(topic_rating)

            topic_rating.rating = topic_rating_value
            topic_rating.rank_tier = resolve_arena_rank_tier(topic_rating_value)
            db.add(topic_rating)

        existing_history_count = (
            db.query(ArenaRankHistoryModel)
            .filter(ArenaRankHistoryModel.user_id == user.id, ArenaRankHistoryModel.season_id == season_id)
            .count()
        )
        if existing_history_count == 0:
            for history_index, delta in enumerate((25, -10, 30)):
                rating_before = base_rating - delta - ((2 - history_index) * 10)
                rating_after = rating_before + delta
                db.add(
                    ArenaRankHistoryModel(
                        user_id=user.id,
                        season_id=season_id,
                        rating_before=rating_before,
                        rating_after=rating_after,
                        rating_delta=delta,
                        rank_tier_before=resolve_arena_rank_tier(rating_before),
                        rank_tier_after=resolve_arena_rank_tier(rating_after),
                        match_id=None,
                    )
                )

    db.commit()
    return len(users)


if __name__ == "__main__":
    main()
