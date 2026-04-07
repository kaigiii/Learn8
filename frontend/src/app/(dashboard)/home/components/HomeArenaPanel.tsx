"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  createArenaRoom,
  fetchArenaLeaderboard,
  fetchArenaProfile,
  fetchArenaPublicCourses,
  fetchArenaSeason,
  joinArenaCompetitiveQueue,
  joinArenaRoom,
} from "@/lib/arena/api";
import type { ArenaLeaderboardEntry, ArenaProfile, ArenaPublicCourse, ArenaSeasonSummary } from "@/lib/apiTypes";

export function HomeArenaPanel() {
  const router = useRouter();
  const [courses, setCourses] = useState<ArenaPublicCourse[]>([]);
  const [season, setSeason] = useState<ArenaSeasonSummary | null>(null);
  const [profile, setProfile] = useState<ArenaProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextCourses, nextSeason, nextProfile, nextLeaderboard] = await Promise.all([
          fetchArenaPublicCourses(),
          fetchArenaSeason(),
          fetchArenaProfile(),
          fetchArenaLeaderboard(3),
        ]);
        if (cancelled) {
          return;
        }
        setCourses(nextCourses);
        setSeason(nextSeason);
        setProfile(nextProfile);
        setLeaderboard(nextLeaderboard.items);
        setSelectedCourseId((current) => current ?? nextCourses[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Arena");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const handleJoinCompetition = async () => {
    if (!selectedCourseId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const queueState = await joinArenaCompetitiveQueue({ publicCourseId: selectedCourseId });
      if (queueState.matchId) {
        router.push(`/arena/match/${queueState.matchId}`);
        return;
      }
      router.push("/arena/queue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join Arena competition");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedCourseId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await createArenaRoom({ publicCourseId: selectedCourseId });
      router.push(`/arena/lobby/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinArenaRoom(roomCode.trim().toUpperCase());
      router.push(`/arena/lobby/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeepGlassCard className="h-full min-h-[360px] px-6 py-6 md:px-7 md:py-7">
      <div className="flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
              Arena
            </h2>
            <p className="mt-1 text-sm text-brand-gray-400">
              Jump into official-topic competition straight from home.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/72 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal">
              {season?.name ?? "No season"}
            </p>
            <p className="mt-1 font-heading text-lg font-bold text-brand-gray-700">
              {profile?.rankTier ?? "..."}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
              Official Topic
            </span>
            <select
              className="mt-2 w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none"
              value={selectedCourseId ?? ""}
              onChange={(event) => setSelectedCourseId(Number(event.target.value))}
              disabled={loading || busy || courses.length === 0}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>

          {selectedCourse ? (
            <div className="rounded-xl border border-white/70 bg-white/72 px-4 py-3">
              <p className="text-sm font-semibold text-brand-gray-700">{selectedCourse.title}</p>
              <p className="mt-1 text-xs text-brand-gray-500">
                {selectedCourse.description || selectedCourse.topic}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3">
            <GameButton onClick={() => void handleJoinCompetition()} disabled={!selectedCourseId || busy}>
              Join Competition
            </GameButton>
            <GameButton variant="secondary" onClick={() => void handleCreateRoom()} disabled={!selectedCourseId || busy}>
              Create Room
            </GameButton>
          </div>

          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm uppercase text-brand-gray-700 outline-none"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="Room code"
            />
            <GameButton
              variant="secondary"
              className="px-5"
              onClick={() => void handleJoinRoom()}
              disabled={!roomCode.trim() || busy}
            >
              Join
            </GameButton>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
              Top Rank Snapshot
            </p>
            <Link href="/arena/leaderboard" className="text-xs font-semibold text-brand-teal hover:underline">
              View leaderboard
            </Link>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className="flex items-center justify-between rounded-xl border border-white/70 bg-white/72 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-gray-700">
                    #{index + 1} {entry.displayName}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-brand-teal">
                    {entry.rankTier}
                  </p>
                </div>
                <p className="font-heading text-lg font-bold text-brand-gray-700">{entry.rating}</p>
              </div>
            ))}
            {leaderboard.length === 0 && !loading ? (
              <p className="text-xs text-brand-gray-500">Leaderboard data will appear after competition matches are recorded.</p>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </div>
    </DeepGlassCard>
  );
}
