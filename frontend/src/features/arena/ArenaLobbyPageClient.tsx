"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { leaveArenaRoom, setArenaRoomReady, startArenaRoom } from "@/lib/arena/api";
import { resolveErrorMessage } from "@/lib/apiClient";
import { getArenaEventLabel } from "@/lib/arena/eventTypes";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useArenaLobbyStore } from "@/stores/arena/useArenaLobbyStore";
import { useArenaRoomEvents } from "./hooks/useArenaRoomEvents";

export default function ArenaLobbyPageClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const authUser = useAuthStore((state) => state.user);
  const reset = useArenaLobbyStore((state) => state.reset);
  const events = useArenaLobbyStore((state) => state.events);
  const connectionStatus = useArenaLobbyStore((state) => state.connectionStatus);
  const isRecovering = useArenaLobbyStore((state) => state.isRecovering);
  const room = useArenaRoomEvents(isReady ? roomCode : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!room) {
      return;
    }
    if (room.status === "in_match" && room.latestMatchId) {
      router.replace(`/arena/match/${room.latestMatchId}`);
      return;
    }
    if (room.status === "closed") {
      router.replace("/home");
    }
  }, [room, router]);

  const currentPlayer = useMemo(
    () => room?.players.find((player) => player.userId === authUser?.id) ?? null,
    [authUser?.id, room?.players]
  );

  const handleReadyToggle = async () => {
    if (!room || !currentPlayer) return;
    setBusy(true);
    setError(null);
    try {
      await setArenaRoomReady(room.roomCode, !currentPlayer.isReady);
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to update ready state right now."));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!room) return;
    setBusy(true);
    try {
      await leaveArenaRoom(room.roomCode);
      router.push("/home");
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to leave room right now."));
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startArenaRoom(room.roomCode);
      router.push(`/arena/match/${result.matchId}`);
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to start room right now."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar backHref="/home" pageTitle="Arena Lobby" />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-8 xl:grid-cols-[1.15fr_0.85fr]">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-teal">
                Room Code
              </p>
              <h1 className="mt-2 font-heading text-4xl font-extrabold text-brand-gray-700">
                {room?.roomCode ?? roomCode.toUpperCase()}
              </h1>
              <p className="mt-3 text-sm text-brand-gray-500">
                {room?.poolTitle || room?.publicCourseTitle || "Loading room topic..."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-3 text-sm text-brand-gray-600">
              <div>{room?.playerCount ?? 0} / {room?.maxPlayers ?? 0} players</div>
              <div className="mt-1 uppercase tracking-[0.18em] text-brand-teal">{room?.status ?? "lobby"}</div>
            </div>
          </div>

          {connectionStatus !== "connected" || isRecovering ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
              {connectionStatus === "reconnecting" || isRecovering
                ? "Lobby connection interrupted. Re-syncing the latest room state..."
                : "Connecting to the live room event stream..."}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {room?.players.map((player) => (
              <div key={player.userId} className="rounded-[28px] border border-white/70 bg-white/68 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-xl font-bold text-brand-gray-700">
                      {player.displayName}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                      {player.isHost ? "Host" : "Player"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      player.isReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {player.isReady ? "Ready" : "Waiting"}
                  </span>
                </div>
                {player.connectionState === "disconnected" ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                    Disconnected
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <GameButton onClick={() => void handleReadyToggle()} disabled={!currentPlayer || busy}>
              {currentPlayer?.isReady ? "Unready" : "Ready Up"}
            </GameButton>
            <GameButton
              variant="secondary"
              onClick={() => void handleStart()}
              disabled={!room?.canStart || room?.hostUserId !== authUser?.id || busy}
            >
              Start Match
            </GameButton>
            <GameButton variant="secondary" onClick={() => void handleLeave()} disabled={busy}>
              Leave Room
            </GameButton>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </DeepGlassCard>

        <DeepGlassCard className="px-6 py-6">
          <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Event Feed</h2>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4 text-sm text-brand-gray-500">
                Waiting for room activity...
              </div>
            ) : (
              events
                .slice()
                .reverse()
                .map((event) => (
                  <div key={event.eventId} className="rounded-2xl border border-white/70 bg-white/68 px-4 py-3">
                    <p className="font-semibold text-brand-gray-700">{getArenaEventLabel(event)}</p>
                    <p className="mt-1 text-xs text-brand-gray-500">{new Date(event.createdAt).toLocaleTimeString()}</p>
                  </div>
                ))
            )}
          </div>
        </DeepGlassCard>
      </main>
    </div>
  );
}
