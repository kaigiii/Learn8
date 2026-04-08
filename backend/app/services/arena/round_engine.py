from __future__ import annotations

from statistics import mean

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.time import utc_now_naive
from app.domain.arena_statuses import ArenaMatchStatus, ArenaRoundStatus, ArenaRoomStatus
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_round import ArenaAnswerModel, ArenaRoundModel
from app.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.public_course import PublicCourseModel
from app.models.user import UserModel
from app.services.arena.presence_service import PresenceService
from app.services.arena.question_pool_service import QuestionPoolService
from app.services.arena.rating_service import RatingService
from app.services.arena.realtime_gateway import RealtimeGateway
from app.services.arena.scoring_service import ScoringService


class RoundEngine:
    STALE_MATCH_FINALIZE_SECONDS = settings.ARENA_MATCH_STALE_FINALIZE_SECONDS

    def __init__(
        self,
        question_pool_service: QuestionPoolService | None = None,
        scoring_service: ScoringService | None = None,
        rating_service: RatingService | None = None,
    ):
        self.question_pool_service = question_pool_service or QuestionPoolService()
        self.scoring_service = scoring_service or ScoringService()
        self.rating_service = rating_service or RatingService()
        self.realtime_gateway = RealtimeGateway()
        self.presence_service = PresenceService(self.realtime_gateway)

    def _base_match_query(self, db: Session):
        return db.query(ArenaMatchModel).options(
            selectinload(ArenaMatchModel.players).selectinload(ArenaMatchPlayerModel.user),
            selectinload(ArenaMatchModel.public_course),
        )

    def _base_round_query(self, db: Session):
        return db.query(ArenaRoundModel).options(selectinload(ArenaRoundModel.answers))

    def get_match(self, db: Session, match_id: int) -> ArenaMatchModel | None:
        return self._base_match_query(db).filter(ArenaMatchModel.id == match_id).first()

    def get_active_match_for_user(self, db: Session, user_id: int) -> ArenaMatchModel | None:
        row = (
            db.query(ArenaMatchPlayerModel.match_id)
            .join(ArenaMatchModel, ArenaMatchModel.id == ArenaMatchPlayerModel.match_id)
            .filter(
                ArenaMatchPlayerModel.user_id == user_id,
                ArenaMatchModel.status == ArenaMatchStatus.IN_PROGRESS,
            )
            .order_by(ArenaMatchModel.started_at.desc(), ArenaMatchModel.id.desc())
            .first()
        )
        if not row:
            return None
        return self.get_match(db, row[0])

    def initialize_match_rounds(self, db: Session, match_id: int) -> None:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")

        existing_round = db.query(ArenaRoundModel.id).filter(ArenaRoundModel.match_id == match.id).first()
        if existing_round:
            return

        public_course = (
            db.query(PublicCourseModel)
            .filter(PublicCourseModel.id == match.public_course_id)
            .first()
        )
        if not public_course:
            raise HTTPException(status_code=404, detail="Arena public course not found")

        rules = match.rules_snapshot_json if isinstance(match.rules_snapshot_json, dict) else {}
        round_count = int(rules.get("round_count") or 5)
        timer_seconds = int(rules.get("round_time_seconds") or 30)
        questions = self.question_pool_service.build_round_questions(
            db,
            public_course,
            round_count=round_count,
        )
        match.round_count = len(questions)
        match.player_count = len(match.players)
        match.completed_round_count = 0
        db.add(match)

        for index, question in enumerate(questions):
            round_model = ArenaRoundModel(
                match_id=match.id,
                round_index=index,
                status=ArenaRoundStatus.ACTIVE if index == 0 else ArenaRoundStatus.PENDING,
                question_key=str(question.get("question_id") or ""),
                difficulty=str(question.get("difficulty") or "") or None,
                question_count=max(1, len(list(question.get("options") or []))),
                question_snapshot_json=question,
                timer_seconds=timer_seconds,
            )
            if index == 0:
                now = utc_now_naive()
                round_model.started_at = now
                round_model.deadline_at = now + self._seconds_delta(timer_seconds)
            db.add(round_model)

        db.commit()
        active_round = (
            self._base_round_query(db)
            .filter(ArenaRoundModel.match_id == match.id, ArenaRoundModel.round_index == 0)
            .first()
        )
        if active_round:
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.started",
                payload={
                    "matchId": match.id,
                    "roundId": active_round.id,
                    "roundIndex": active_round.round_index,
                    "timerSeconds": active_round.timer_seconds,
                },
            )

    def _seconds_delta(self, seconds: int):
        from datetime import timedelta

        return timedelta(seconds=seconds)

    def _get_participant(self, match: ArenaMatchModel, user_id: int) -> ArenaMatchPlayerModel | None:
        return next((player for player in match.players if player.user_id == user_id), None)

    def _ensure_participant(self, match: ArenaMatchModel, current_user: UserModel) -> None:
        if not self._get_participant(match, current_user.id):
            raise HTTPException(status_code=403, detail="You are not part of this Arena match")

    def _get_rounds(self, db: Session, match_id: int) -> list[ArenaRoundModel]:
        return (
            self._base_round_query(db)
            .filter(ArenaRoundModel.match_id == match_id)
            .order_by(ArenaRoundModel.round_index.asc())
            .all()
        )

    def _get_active_round(self, rounds: list[ArenaRoundModel]) -> ArenaRoundModel | None:
        return next((round_item for round_item in rounds if round_item.status == ArenaRoundStatus.ACTIVE), None)

    def _ensure_round_progress(self, db: Session, match: ArenaMatchModel) -> ArenaMatchModel:
        rounds = self._get_rounds(db, match.id)
        active_round = self._get_active_round(rounds)
        if active_round and active_round.deadline_at and active_round.deadline_at <= utc_now_naive():
            self._close_round(db, match, active_round)
            db.commit()
            return self.get_match(db, match.id)
        if match.status == ArenaMatchStatus.IN_PROGRESS and not active_round:
            if rounds and all(round_item.status == ArenaRoundStatus.CLOSED for round_item in rounds):
                self._finalize_match_if_needed(db, match, rounds)
                db.commit()
                return self.get_match(db, match.id)
            if match.started_at and (utc_now_naive() - match.started_at).total_seconds() > self.STALE_MATCH_FINALIZE_SECONDS:
                self._finalize_match_if_needed(db, match, rounds)
                db.commit()
                return self.get_match(db, match.id)
        return match

    def _finalize_match_if_needed(
        self,
        db: Session,
        match: ArenaMatchModel,
        rounds: list[ArenaRoundModel],
    ) -> None:
        if match.status == ArenaMatchStatus.FINISHED and isinstance(match.standings_json, list):
            return

        standings = self._build_standings(match, rounds)
        if not isinstance(match.standings_json, list):
            match.standings_json = self.rating_service.settle_match(db, match, standings)
        match.completed_round_count = max(int(match.completed_round_count or 0), len(rounds))
        if isinstance(match.standings_json, list) and match.standings_json:
            top_row = match.standings_json[0]
            top_user_id = top_row.get("userId")
            match.winner_user_id = int(top_user_id) if top_user_id is not None else None
        match.status = ArenaMatchStatus.FINISHED
        match.ended_at = match.ended_at or utc_now_naive()
        db.add(match)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="match.finished",
            payload={
                "matchId": match.id,
                "standings": match.standings_json,
                "recovered": True,
            },
        )

    def _close_round(self, db: Session, match: ArenaMatchModel, round_model: ArenaRoundModel) -> None:
        if round_model.status != ArenaRoundStatus.ACTIVE:
            return

        answered_user_ids = {
            row[0]
            for row in db.query(ArenaAnswerModel.user_id)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .all()
        }
        for player in match.players:
            if player.user_id in answered_user_ids:
                continue
            db.add(
                ArenaAnswerModel(
                    match_id=match.id,
                    round_id=round_model.id,
                    user_id=player.user_id,
                    selected_option_id=None,
                    answer_payload_json={"selectedOptionId": None, "timedOut": True},
                    is_correct=False,
                    score_awarded=0,
                    response_time_ms=None,
                    submitted_at=utc_now_naive(),
                )
            )
        db.flush()

        question = round_model.question_snapshot_json if isinstance(round_model.question_snapshot_json, dict) else {}
        round_model.answered_count = (
            db.query(ArenaAnswerModel)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .count()
        )
        round_model.correct_count = (
            db.query(ArenaAnswerModel)
            .filter(
                ArenaAnswerModel.round_id == round_model.id,
                ArenaAnswerModel.is_correct.is_(True),
            )
            .count()
        )
        round_model.status = ArenaRoundStatus.CLOSED
        round_model.closed_at = utc_now_naive()
        round_model.revealed_answer_json = {
            "correctOptionId": question.get("correct_option_id"),
            "explanation": question.get("explanation") or "",
        }
        db.add(round_model)
        match.completed_round_count = max(int(match.completed_round_count or 0), round_model.round_index + 1)
        db.add(match)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="round.revealed",
            payload={
                "matchId": match.id,
                "roundId": round_model.id,
                "roundIndex": round_model.round_index,
                "revealedAnswer": round_model.revealed_answer_json,
            },
        )

        all_rounds = self._get_rounds(db, match.id)
        next_round = next(
            (
                item
                for item in all_rounds
                if item.round_index == round_model.round_index + 1 and item.status == ArenaRoundStatus.PENDING
            ),
            None,
        )
        if next_round:
            next_round.status = ArenaRoundStatus.ACTIVE
            next_round.started_at = utc_now_naive()
            next_round.deadline_at = next_round.started_at + self._seconds_delta(next_round.timer_seconds)
            db.add(next_round)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.started",
                payload={
                    "matchId": match.id,
                    "roundId": next_round.id,
                    "roundIndex": next_round.round_index,
                    "timerSeconds": next_round.timer_seconds,
                },
            )
        else:
            final_standings = self._build_standings(match, self._get_rounds(db, match.id))
            match.status = ArenaMatchStatus.FINISHED
            match.ended_at = utc_now_naive()
            match.completed_round_count = max(int(match.completed_round_count or 0), len(all_rounds))
            match.standings_json = self.rating_service.settle_match(db, match, final_standings)
            if isinstance(match.standings_json, list) and match.standings_json:
                top_row = match.standings_json[0]
                top_user_id = top_row.get("userId")
                match.winner_user_id = int(top_user_id) if top_user_id is not None else None
            db.add(match)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="match.finished",
                payload={
                    "matchId": match.id,
                    "standings": match.standings_json,
                },
            )
            if match.room_id:
                room = db.query(ArenaRoomModel).filter(ArenaRoomModel.id == match.room_id).first()
                if room:
                    room.status = ArenaRoomStatus.LOBBY
                    room.latest_match_id = match.id
                    players = (
                        db.query(ArenaRoomPlayerModel)
                        .filter(ArenaRoomPlayerModel.room_id == room.id)
                        .all()
                    )
                    for player in players:
                        player.is_ready = False
                        db.add(player)
                    db.add(room)
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="standings.updated",
            payload={
                "matchId": match.id,
                "standings": self._build_standings(match, self._get_rounds(db, match.id)),
            },
        )

    def _build_standings(self, match: ArenaMatchModel, rounds: list[ArenaRoundModel]) -> list[dict]:
        answer_map: dict[int, list[ArenaAnswerModel]] = {player.user_id: [] for player in match.players}
        for round_item in rounds:
            for answer in round_item.answers:
                answer_map.setdefault(answer.user_id, []).append(answer)

        rows = []
        for player in match.players:
            answers = answer_map.get(player.user_id, [])
            score = sum(answer.score_awarded for answer in answers)
            correct_count = sum(1 for answer in answers if answer.is_correct)
            answered_count = len(answers)
            incorrect_count = answered_count - correct_count
            response_times = [answer.response_time_ms for answer in answers if answer.response_time_ms is not None]
            average_response_ms = int(mean(response_times)) if response_times else None
            rows.append(
                {
                    "userId": player.user_id,
                    "displayName": player.user.full_name or player.user.email.split("@")[0],
                    "score": score,
                    "correctCount": correct_count,
                    "incorrectCount": incorrect_count,
                    "answeredCount": answered_count,
                    "averageResponseMs": average_response_ms,
                }
            )

        rows.sort(key=lambda item: (-item["score"], -item["correctCount"], item["averageResponseMs"] or 10**9, item["displayName"]))
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        return rows

    def get_match_state(self, db: Session, match_id: int, current_user: UserModel) -> dict:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")
        self._ensure_participant(match, current_user)

        match = self._ensure_round_progress(db, match)
        self.presence_service.touch_match_presence(db, match, current_user)
        db.flush()
        rounds = self._get_rounds(db, match.id)
        active_round = self._get_active_round(rounds)
        standings = match.standings_json if isinstance(match.standings_json, list) and match.status == ArenaMatchStatus.FINISHED else self._build_standings(match, rounds)
        current_player_result = next(
            (row for row in standings if int(row.get("userId", 0)) == current_user.id),
            None,
        )

        active_round_payload = None
        if active_round:
            question = active_round.question_snapshot_json if isinstance(active_round.question_snapshot_json, dict) else {}
            active_round_payload = {
                "roundId": active_round.id,
                "roundIndex": active_round.round_index,
                "status": active_round.status,
                "timerSeconds": active_round.timer_seconds,
                "startedAt": active_round.started_at.isoformat() if active_round.started_at else None,
                "deadlineAt": active_round.deadline_at.isoformat() if active_round.deadline_at else None,
                "revealedAnswer": active_round.revealed_answer_json,
                "question": {
                    "questionId": str(question.get("question_id") or active_round.id),
                    "prompt": str(question.get("prompt") or ""),
                    "options": list(question.get("options") or []),
                    "difficulty": question.get("difficulty"),
                    "knowledgeTags": list(question.get("knowledge_tags") or []),
                },
                "submittedPlayerIds": [answer.user_id for answer in active_round.answers],
                "hasSubmitted": any(answer.user_id == current_user.id for answer in active_round.answers),
            }

        current_round_index = active_round.round_index if active_round else max((round_item.round_index for round_item in rounds), default=0)

        return {
            "matchId": match.id,
            "roomCode": match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            "status": match.status,
            "mode": match.mode,
            "publicCourseId": match.public_course_id,
            "publicCourseTitle": match.public_course.title if match.public_course else "Unknown",
            "totalRounds": len(rounds),
            "currentRoundIndex": current_round_index,
            "activeRound": active_round_payload,
            "standings": standings,
            "currentPlayerResult": current_player_result,
            "presenceStates": self.presence_service.build_match_presence_states(match),
            "startedAt": match.started_at.isoformat() if match.started_at else None,
            "endedAt": match.ended_at.isoformat() if match.ended_at else None,
        }

    def submit_answer(
        self,
        db: Session,
        *,
        match_id: int,
        round_id: int,
        current_user: UserModel,
        selected_option_id: str,
    ) -> dict:
        match = self.get_match(db, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Arena match not found")
        self._ensure_participant(match, current_user)
        match = self._ensure_round_progress(db, match)
        self.presence_service.touch_match_presence(db, match, current_user)
        db.flush()
        if match.status != ArenaMatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Arena match is not accepting answers")

        round_model = (
            self._base_round_query(db)
            .filter(ArenaRoundModel.id == round_id, ArenaRoundModel.match_id == match.id)
            .first()
        )
        if not round_model:
            raise HTTPException(status_code=404, detail="Arena round not found")
        if round_model.status != ArenaRoundStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="Arena round is not active")

        existing = (
            db.query(ArenaAnswerModel)
            .filter(
                ArenaAnswerModel.round_id == round_model.id,
                ArenaAnswerModel.user_id == current_user.id,
            )
            .first()
        )
        if existing:
            state = self.get_match_state(db, match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": True,
                "roundClosed": round_model.status == ArenaRoundStatus.CLOSED,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }

        if round_model.deadline_at and round_model.deadline_at <= utc_now_naive():
            self._close_round(db, match, round_model)
            db.commit()
            state = self.get_match_state(db, match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": False,
                "roundClosed": True,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }

        question = round_model.question_snapshot_json if isinstance(round_model.question_snapshot_json, dict) else {}
        correct_option_id = str(question.get("correct_option_id") or "")
        is_correct = selected_option_id == correct_option_id
        response_time_ms = None
        if round_model.started_at:
            response_time_ms = max(0, int((utc_now_naive() - round_model.started_at).total_seconds() * 1000))
        self.presence_service.record_answer_submission(
            db,
            match=match,
            user_id=current_user.id,
            response_time_ms=response_time_ms,
        )
        score_awarded = self.scoring_service.score_answer(
            is_correct=is_correct,
            response_time_ms=response_time_ms,
            timer_seconds=round_model.timer_seconds,
        )
        try:
            db.add(
                ArenaAnswerModel(
                    match_id=match.id,
                    round_id=round_model.id,
                    user_id=current_user.id,
                    answer_payload_json={"selectedOptionId": selected_option_id},
                    selected_option_id=selected_option_id,
                    is_correct=is_correct,
                    score_awarded=score_awarded,
                    response_time_ms=response_time_ms,
                    submitted_at=utc_now_naive(),
                )
            )
            db.flush()
            round_model.answered_count = (
                db.query(ArenaAnswerModel)
                .filter(ArenaAnswerModel.round_id == round_model.id)
                .count()
            )
            round_model.correct_count = (
                db.query(ArenaAnswerModel)
                .filter(
                    ArenaAnswerModel.round_id == round_model.id,
                    ArenaAnswerModel.is_correct.is_(True),
                )
                .count()
            )
            db.add(round_model)
        except IntegrityError:
            db.rollback()
            refreshed_match = self.get_match(db, match.id)
            if not refreshed_match:
                raise HTTPException(status_code=404, detail="Arena match not found")
            state = self.get_match_state(db, refreshed_match.id, current_user)
            return {
                "accepted": False,
                "alreadySubmitted": True,
                "roundClosed": round_model.status == ArenaRoundStatus.CLOSED,
                "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
                "state": state,
            }
        self.realtime_gateway.publish_event(
            db,
            stream_type="match",
            room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
            match_id=match.id,
            event_type="round.answer_received",
            payload={
                "matchId": match.id,
                "roundId": round_model.id,
                "userId": current_user.id,
                "selectedOptionId": selected_option_id,
            },
        )

        answer_count = (
            db.query(ArenaAnswerModel)
            .filter(ArenaAnswerModel.round_id == round_model.id)
            .count()
        )
        round_closed = False
        if answer_count >= len(match.players):
            round_closed = True
            refreshed_round = self._base_round_query(db).filter(ArenaRoundModel.id == round_model.id).first()
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="round.answer_locked",
                payload={
                    "matchId": match.id,
                    "roundId": refreshed_round.id,
                    "roundIndex": refreshed_round.round_index,
                },
            )
            self._close_round(db, match, refreshed_round)

        db.commit()
        state = self.get_match_state(db, match.id, current_user)
        return {
            "accepted": True,
            "alreadySubmitted": False,
            "roundClosed": round_closed,
            "matchFinished": state["status"] == ArenaMatchStatus.FINISHED,
            "state": state,
        }
