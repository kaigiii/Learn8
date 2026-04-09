"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  createArenaRoom,
  fetchArenaProfile,
  fetchArenaPublicCourses,
  fetchArenaSeason,
  joinArenaCompetitiveQueue,
  joinArenaRoom,
} from "@/lib/arena/api";
import type { ArenaProfile, ArenaPublicCourse, ArenaSeasonSummary } from "@/lib/apiTypes";

export function HomeArenaPanel() {
  const router = useRouter();
  const [courses, setCourses] = useState<ArenaPublicCourse[]>([]);
  const [season, setSeason] = useState<ArenaSeasonSummary | null>(null);
  const [profile, setProfile] = useState<ArenaProfile | null>(null);
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
        const [nextCourses, nextSeason, nextProfile] = await Promise.all([
          fetchArenaPublicCourses(),
          fetchArenaSeason(),
          fetchArenaProfile(),
        ]);
        if (cancelled) {
          return;
        }
        setCourses(nextCourses);
        setSeason(nextSeason);
        setProfile(nextProfile);
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
    <DeepGlassCard className="h-full px-5 py-5 md:px-6 md:py-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-brand-gray-500">
            Jump into official-topic competition straight from home.
          </p>
          <div className="rounded-2xl border border-white/70 bg-white/72 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal">
              {season?.name ?? "No season"}
            </p>
            <p className="mt-1 font-heading text-base font-bold text-brand-gray-700">
              {profile?.rankTier ?? "..."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-[#9ecbd4]/18 bg-white/52 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
            <h3 className="font-heading text-2xl font-bold text-brand-gray-700">Official Competition</h3>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-700">
                Official Topic
              </span>
              <select
                className="mt-2 w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none"
                value={selectedCourseId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedCourseId(value ? Number(value) : null);
                }}
                disabled={loading || busy || courses.length === 0}
              >
                {courses.length === 0 ? (
                  <option value="">{loading ? "Loading topics..." : "No topics available"}</option>
                ) : null}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedCourse ? (
              <p className="mt-2 line-clamp-2 text-xs text-brand-gray-500">
                {selectedCourse.description || selectedCourse.topic}
              </p>
            ) : null}

            <GameButton
              className="mt-3 w-full py-3 text-[1.05rem]"
              onClick={() => void handleJoinCompetition()}
              disabled={!selectedCourseId || busy}
            >
              Join Competition
            </GameButton>
          </section>

          <section className="rounded-2xl border border-[#9ecbd4]/18 bg-white/52 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
            <h3 className="font-heading text-2xl font-bold text-brand-gray-700">Room Management</h3>

            <GameButton
              variant="secondary"
              className="mt-3 w-full py-3 text-[1.05rem]"
              onClick={() => void handleCreateRoom()}
              disabled={!selectedCourseId || busy}
            >
              Create Room
            </GameButton>

            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-700">
                Join a Private Room
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm uppercase text-brand-gray-700 outline-none"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="Enter room code"
                />
                <GameButton
                  variant="secondary"
                  className="min-w-[112px] px-4 py-3 text-sm"
                  onClick={() => void handleJoinRoom()}
                  disabled={!roomCode.trim() || busy}
                >
                  Join
                </GameButton>
              </div>
            </label>
          </section>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </DeepGlassCard>
  );
}
