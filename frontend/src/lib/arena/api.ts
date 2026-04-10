"use client";

import { apiFetch } from "@/lib/apiClient";
import type {
  ArenaCompetitiveQueueState,
  ArenaAdminMatchReview,
  ArenaAdminPlayerMatchRecord,
  ArenaAdminPublicCourse,
  ArenaAdminPublicCourseUpsertRequest,
  ArenaAdminQuestionPool,
  ArenaAdminQuestionPoolUpsertRequest,
  ArenaAdminHealthSnapshot,
  ArenaAdminSeason,
  ArenaAdminSeasonUpsertRequest,
  ArenaAnswerSubmitResponse,
  ArenaEventListResponse,
  ArenaLeaderboardResponse,
  ArenaMatchState,
  ArenaProfile,
  ArenaPublicCourse,
  ArenaRankHistoryResponse,
  ArenaRoom,
  ArenaSeasonSummary,
  ArenaAdminSyllabusQuestion,
} from "@/lib/apiTypes";

export function fetchArenaPublicCourses() {
  return apiFetch<ArenaPublicCourse[]>("/arena/public-courses");
}

export function fetchArenaSeason() {
  return apiFetch<ArenaSeasonSummary | null>("/arena/season");
}

export function fetchArenaProfile() {
  return apiFetch<ArenaProfile>("/arena/profile");
}

export function fetchArenaLeaderboard(limit = 20) {
  return apiFetch<ArenaLeaderboardResponse>(`/arena/leaderboard?limit=${limit}`);
}

export function fetchArenaSeasonLeaderboard(limit = 20, seasonId?: number | null) {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (seasonId) {
    search.set("season_id", String(seasonId));
  }
  return apiFetch<ArenaLeaderboardResponse>(`/arena/leaderboard/season?${search.toString()}`);
}

export function fetchArenaRankHistory(limit = 10) {
  return apiFetch<ArenaRankHistoryResponse>(`/arena/history?limit=${limit}`);
}

export function createArenaRoom(payload: {
  publicCourseId: number;
  mode?: string;
  visibility?: string;
  maxPlayers?: number;
  roundCount?: number;
  roundTimeSeconds?: number;
}) {
  return apiFetch<ArenaRoom>("/arena/rooms", {
    method: "POST",
    body: JSON.stringify({
      publicCourseId: payload.publicCourseId,
      mode: payload.mode ?? "private_room",
      visibility: payload.visibility ?? "private",
      maxPlayers: payload.maxPlayers ?? 4,
      roundCount: payload.roundCount ?? 5,
      roundTimeSeconds: payload.roundTimeSeconds ?? 30,
    }),
  });
}

export function joinArenaRoom(roomCode: string) {
  return apiFetch<ArenaRoom>("/arena/rooms/join", {
    method: "POST",
    body: JSON.stringify({ roomCode }),
  });
}

export function fetchArenaRoom(roomCode: string) {
  return apiFetch<ArenaRoom>(`/arena/rooms/${roomCode}`);
}

export function heartbeatArenaRoomPresence(roomCode: string) {
  return apiFetch<void>(`/arena/rooms/${roomCode}/presence`, {
    method: "POST",
  });
}

export function setArenaRoomReady(roomCode: string, isReady: boolean) {
  return apiFetch<ArenaRoom>(`/arena/rooms/${roomCode}/ready`, {
    method: "POST",
    body: JSON.stringify({ isReady }),
  });
}

export function leaveArenaRoom(roomCode: string) {
  return apiFetch<void>(`/arena/rooms/${roomCode}/leave`, {
    method: "POST",
  });
}

export function startArenaRoom(roomCode: string) {
  return apiFetch<{ roomCode: string; matchId: number; status: string }>(
    `/arena/rooms/${roomCode}/start`,
    {
      method: "POST",
    }
  );
}

export function fetchArenaMatch(matchId: number) {
  return apiFetch<ArenaMatchState>(`/arena/matches/${matchId}`);
}

export function heartbeatArenaMatchPresence(matchId: number) {
  return apiFetch<void>(`/arena/matches/${matchId}/presence`, {
    method: "POST",
  });
}

export function submitArenaAnswer(
  matchId: number,
  payload: { roundId: number; selectedOptionId?: string | null; answerPayload?: any }
) {
  return apiFetch<ArenaAnswerSubmitResponse>(`/arena/matches/${matchId}/answers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchArenaRoomEvents(roomCode: string, afterCursor = 0, limit = 100) {
  return apiFetch<ArenaEventListResponse>(
    `/arena/rooms/${roomCode}/events?after_cursor=${afterCursor}&limit=${limit}`
  );
}

export function fetchArenaMatchEvents(matchId: number, afterCursor = 0, limit = 100) {
  return apiFetch<ArenaEventListResponse>(
    `/arena/matches/${matchId}/events?after_cursor=${afterCursor}&limit=${limit}`
  );
}

export function buildArenaRoomStreamPath(roomCode: string) {
  const roomCodeValue = encodeURIComponent(roomCode.toUpperCase());
  return `/arena/rooms/${roomCodeValue}/stream`;
}

export function buildArenaMatchStreamPath(matchId: number) {
  return `/arena/matches/${matchId}/stream`;
}

export function fetchArenaAdminPublicCourses() {
  return apiFetch<ArenaAdminPublicCourse[]>("/arena/admin/public-courses");
}

export function createArenaAdminPublicCourse(payload: ArenaAdminPublicCourseUpsertRequest) {
  return apiFetch<ArenaAdminPublicCourse>("/arena/admin/public-courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateArenaAdminPublicCourse(
  publicCourseId: number,
  payload: ArenaAdminPublicCourseUpsertRequest
) {
  return apiFetch<ArenaAdminPublicCourse>(`/arena/admin/public-courses/${publicCourseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ...existing code...

export function fetchArenaAdminAvailableQuestions(publicCourseId: number) {
  return apiFetch<ArenaAdminSyllabusQuestion[]>(
    `/arena/admin/public-courses/${publicCourseId}/available-questions`
  );
}

export function fetchArenaAdminQuestionPools(publicCourseId?: number | null) {
  const search = new URLSearchParams();
  if (publicCourseId) {
    search.set("public_course_id", String(publicCourseId));
  }
  const suffix = search.toString();
  return apiFetch<ArenaAdminQuestionPool[]>(
    `/arena/admin/question-pools${suffix ? `?${suffix}` : ""}`
  );
}

export function createArenaAdminQuestionPool(payload: ArenaAdminQuestionPoolUpsertRequest) {
  return apiFetch<ArenaAdminQuestionPool>("/arena/admin/question-pools", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateArenaAdminQuestionPool(
  poolId: number,
  payload: ArenaAdminQuestionPoolUpsertRequest
) {
  return apiFetch<ArenaAdminQuestionPool>(`/arena/admin/question-pools/${poolId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteArenaAdminQuestionPool(poolId: number) {
  return apiFetch<{ status: string }>(`/arena/admin/question-pools/${poolId}`, {
    method: "DELETE",
  });
}
export function fetchArenaAdminSeasons() {
  return apiFetch<ArenaAdminSeason[]>("/arena/admin/seasons");
}

export function fetchArenaAdminHealthSnapshot() {
  return apiFetch<ArenaAdminHealthSnapshot>("/arena/admin/health");
}

export function fetchArenaAdminPlayerMatches(search?: string, limit = 50) {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (search?.trim()) {
    query.set("search", search.trim());
  }
  return apiFetch<ArenaAdminPlayerMatchRecord[]>(`/arena/admin/player-matches?${query.toString()}`);
}

export function fetchArenaAdminMatchReviews(limit = 25) {
  return apiFetch<ArenaAdminMatchReview[]>(`/arena/admin/match-reviews?limit=${limit}`);
}

export function createArenaAdminSeason(payload: ArenaAdminSeasonUpsertRequest) {
  return apiFetch<ArenaAdminSeason>("/arena/admin/seasons", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateArenaAdminSeason(
  seasonId: number,
  payload: ArenaAdminSeasonUpsertRequest
) {
  return apiFetch<ArenaAdminSeason>(`/arena/admin/seasons/${seasonId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function joinArenaCompetitiveQueue(payload: {
  publicCourseId: number;
  roundCount?: number;
  roundTimeSeconds?: number;
}) {
  return apiFetch<ArenaCompetitiveQueueState>("/arena/competitive/queue", {
    method: "POST",
    body: JSON.stringify({
      publicCourseId: payload.publicCourseId,
      roundCount: payload.roundCount ?? 5,
      roundTimeSeconds: payload.roundTimeSeconds ?? 30,
    }),
  });
}

export function fetchCurrentArenaCompetitiveQueue() {
  return apiFetch<ArenaCompetitiveQueueState | null>("/arena/competitive/queue/current");
}

export function cancelCurrentArenaCompetitiveQueue() {
  return apiFetch<void>("/arena/competitive/queue/current", {
    method: "DELETE",
  });
}
