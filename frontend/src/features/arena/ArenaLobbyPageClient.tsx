"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { fetchArenaPublicCourses, joinArenaRoom, kickArenaRoomPlayer, leaveArenaRoom, setArenaRoomReady, startArenaRoom, updateArenaRoomSettings, transferArenaRoomHost } from "@/lib/arena/api";
import { resolveErrorMessage } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { ArenaPublicCourse } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useArenaLobbyStore } from "@/stores/arena/useArenaLobbyStore";
import { useArenaRoomEvents } from "./hooks/useArenaRoomEvents";

const RANDOM_TOPIC_ID = -1;

export default function ArenaLobbyPageClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady } = useRequireAuthRedirect();
  const authUser = useAuthStore((state) => state.user);
  const reset = useArenaLobbyStore((state) => state.reset);
  const connectionStatus = useArenaLobbyStore((state) => state.connectionStatus);
  const isRecovering = useArenaLobbyStore((state) => state.isRecovering);
  const { room, refetch: refetchRoom } = useArenaRoomEvents(isReady ? roomCode : null);
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [courses, setCourses] = useState<ArenaPublicCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedTopicValue, setSelectedTopicValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);

  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    setCoursesLoading(true);
    void fetchArenaPublicCourses()
      .then((nextCourses) => {
        if (!cancelled) {
          setCourses(nextCourses);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !roomCode) return;
    let cancelled = false;
    setJoining(true);
    void (async () => {
      try {
        await joinArenaRoom(roomCode);
        if (!cancelled) await refetchRoom();
      } catch (err) {
        console.error("Auto room join failed:", err);
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isReady, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      return;
    }
    if (!joining && authUser && !room.players.some((p) => p.userId === authUser.id)) {
      router.replace("/home?kicked=1");
    }
  }, [room, router, joining, authUser]);

  const currentPlayer = useMemo(
    () => room?.players.find((player) => player.userId === authUser?.id) ?? null,
    [authUser?.id, room?.players]
  );
  const opponentPlayer = useMemo(
    () => room?.players.find((player) => player.userId !== authUser?.id) ?? null,
    [authUser?.id, room?.players]
  );

  const roomLabel = room?.roomCode ?? roomCode.toUpperCase();
  const currentAvatar = currentPlayer?.avatarUrl || authUser?.avatar_url || "/avatar/chicken.png";
  const currentName = currentPlayer?.displayName || authUser?.full_name || authUser?.email?.split("@")[0] || "You";
  const opponentName = opponentPlayer?.displayName || "Waiting for opponent";
  const opponentAvatar = opponentPlayer?.avatarUrl || "/avatar/chicken.png";
  const hasOpponent = Boolean(opponentPlayer);
  const topicOptions = useMemo(
    () => [
      { value: RANDOM_TOPIC_ID, label: "Random topic assignment" },
      ...courses.map((course) => ({
        value: course.poolId,
        label: `${course.courseTitle} - ${course.title}`,
      })),
    ],
    [courses]
  );

  useEffect(() => {
    if (selectedTopicValue !== null) {
      return;
    }

    const topicParam = searchParams.get("topic");
    if (topicParam === "random") {
      setSelectedTopicValue(RANDOM_TOPIC_ID);
      return;
    }

    const parsedPoolId = topicParam ? Number(topicParam) : NaN;
    if (!Number.isNaN(parsedPoolId) && parsedPoolId > 0) {
      setSelectedTopicValue(parsedPoolId);
      return;
    }

    if (room?.poolId) {
      setSelectedTopicValue(room.poolId);
    }
  }, [room?.poolId, searchParams, selectedTopicValue]);

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

  const handleTransferHost = async (newHostUserId: number) => {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      await transferArenaRoomHost(room.roomCode, newHostUserId);
      await refetchRoom();
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to transfer host right now."));
    } finally {
      setBusy(false);
    }
  };

  const handleKickPlayer = async (userId: number) => {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      await kickArenaRoomPlayer(room.roomCode, userId);
      await refetchRoom();
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to kick player right now."));
    } finally {
      setBusy(false);
    }
  };

  const handleTopicChange = async (nextPoolId: number) => {
    if (!room || currentPlayer?.isHost !== true) return;
    setSelectedTopicValue(nextPoolId);

    const resolvedPoolId =
      nextPoolId === RANDOM_TOPIC_ID
        ? courses[Math.floor(Math.random() * courses.length)]?.poolId ?? null
        : nextPoolId;
    if (!resolvedPoolId) return;

    setSettingsBusy(true);
    setError(null);
    try {
      await updateArenaRoomSettings(room.roomCode, { poolId: resolvedPoolId });
      await refetchRoom();
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to update room topic right now."));
    } finally {
      setSettingsBusy(false);
    }
  };

  useEffect(() => {
    if (!isReady || !room) return;
    setLoadingFriends(true);
    import("@/lib/apiClient").then(({ apiFetch }) => {
      apiFetch<any>("/social/friends")
        .then((data) => {
          setFriends(data.friends || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingFriends(false));
    });
  }, [isReady, room]);

  const [inviteStatus, setInviteStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomLabel);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleInviteFriend = async (friendId: number, friendName: string) => {
    try {
      const { apiFetch } = await import("@/lib/apiClient");
      await apiFetch<any>("/social/friends/arena-invite", {
        method: "POST",
        body: JSON.stringify({ friend_id: friendId, room_code: roomCode }),
      });
      setInviteStatus({ type: "success", msg: `Successfully sent in-app game invite to ${friendName}!` });
      setTimeout(() => setInviteStatus(null), 4000);
    } catch (err: any) {
      setInviteStatus({ type: "error", msg: err.detail || "Failed to send arena invitation." });
      setTimeout(() => setInviteStatus(null), 4000);
    }
  };


  if (joining) {
    return (
      <div className="min-h-screen bg-[url('/backgrounds/MainBg.png')] bg-cover bg-center bg-no-repeat">
        <TopStatsBar backHref="/home" pageTitle="Arena Lobby" />
        <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-[5px] border-brand-teal/20 border-t-brand-teal" />
          <p className="text-sm font-semibold text-brand-gray-500">Joining room...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/backgrounds/MainBg.png')] bg-cover bg-center bg-no-repeat">
      <TopStatsBar backHref="/home" pageTitle="Arena Lobby" />
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl flex-col items-center justify-center px-4 py-4 md:px-8">
        <div className="w-full text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 shadow-sm backdrop-blur">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-brand-teal" fill="currentColor">
              <path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
            </svg>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-teal">Room Code</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyRoomCode()}
            className="group mx-auto mt-2 flex items-center gap-3 rounded-2xl border border-white/70 bg-gradient-to-br from-white/85 to-white/55 px-5 py-2 shadow-[0_8px_22px_rgba(95,146,165,0.18)] backdrop-blur transition hover:scale-[1.02] hover:shadow-[0_10px_28px_rgba(95,146,165,0.25)]"
            title="Click to copy"
          >
            <span
              className="font-heading text-3xl font-black leading-none tracking-[0.18em] text-brand-teal md:text-5xl"
            >
              {roomLabel}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                copiedCode
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-brand-teal/10 text-brand-teal group-hover:bg-brand-teal/20"
              }`}
            >
              {copiedCode ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </span>
          </button>
          <div className="mx-auto mt-3 max-w-sm">
            <QuestionTypeDropdown
              value={selectedTopicValue ?? room?.poolId ?? null}
              options={topicOptions}
              placeholder={coursesLoading ? "Loading topics..." : "No competitions available"}
              disabled={!currentPlayer?.isHost || room?.status !== "lobby" || settingsBusy || coursesLoading || courses.length === 0}
              onChange={(nextValue) => void handleTopicChange(nextValue)}
            />
          </div>
        </div>

        {connectionStatus !== "connected" || isRecovering ? (
          <div className="mt-6 rounded-full border border-sky-200 bg-sky-50/90 px-5 py-3 text-sm text-sky-900 shadow-sm">
            {connectionStatus === "reconnecting" || isRecovering
              ? "Lobby connection interrupted. Re-syncing the latest room state..."
              : "Connecting to the live room event stream..."}
          </div>
        ) : null}

        <div className="mt-5 w-full max-w-5xl">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 shadow-sm backdrop-blur">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal">
                Players {room?.players.length ?? 0}/8
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => {
              const player = room?.players[index];
              const iAmHost = currentPlayer?.isHost === true;
              if (player) {
                const isSelf = player.userId === authUser?.id;
                return (
                  <LobbyPlayerCard
                    key={player.userId}
                    title={player.displayName || (isSelf ? (authUser?.full_name || authUser?.email?.split("@")[0] || "You") : "Player")}
                    avatarSrc={player.avatarUrl || "/avatar/chicken.png"}
                    role={player.isHost ? (isSelf ? "Host (You)" : "Host") : isSelf ? "You" : "Player"}
                    isReady={player.isReady}
                    isHost={player.isHost}
                    isSelf={isSelf}
                    onReadyToggle={isSelf ? () => void handleReadyToggle() : undefined}
                    readyDisabled={!isSelf || busy}
                    connectionState={player.connectionState}
                    actionLabel={isSelf ? (player.isReady ? "UNREADY" : "READY UP") : (player.isReady ? "READY" : "WAITING")}
                    onTransferHost={iAmHost && !isSelf ? () => void handleTransferHost(player.userId) : undefined}
                    onKick={iAmHost && !isSelf ? () => void handleKickPlayer(player.userId) : undefined}
                    hostActionsDisabled={busy}
                  />
                );
              }
              return (
                <LobbyPlayerCard
                  key={`empty-${index}`}
                  title="Waiting for opponent"
                  avatarSrc={undefined}
                  role="Player"
                  isReady={false}
                  isHost={false}
                  onReadyToggle={undefined}
                  readyDisabled
                  loading
                  actionLabel="WAITING"
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex w-full max-w-3xl flex-col items-center gap-2">
          <div className="flex flex-col gap-3 sm:flex-row">
            <GameButton
              variant="secondary"
              onClick={() => void handleLeave()}
              disabled={busy}
              className="min-w-[160px]"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Leave Room
              </span>
            </GameButton>
            {currentPlayer ? (
              <GameButton
                variant={currentPlayer.isReady ? "secondary" : "primary"}
                onClick={() => void handleReadyToggle()}
                disabled={busy}
                className="min-w-[160px]"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {currentPlayer.isReady ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {currentPlayer.isReady ? "Unready" : "Ready Up"}
                </span>
              </GameButton>
            ) : null}
            <GameButton
              onClick={() => void handleStart()}
              disabled={!room?.canStart || room?.hostUserId !== authUser?.id || busy}
              className="min-w-[160px]"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                Start Match
              </span>
            </GameButton>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          {inviteStatus && (
            <div className={`mt-3 p-3 rounded-xl border text-center text-xs font-bold ${
              inviteStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : "bg-rose-50 border-rose-200 text-rose-600"
            }`}>
              {inviteStatus.msg}
            </div>
          )}

          {/* Friends invitation widget for host */}
          {friends.length > 0 && (
            <div className="mt-6 w-full max-w-xl rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur-xl shadow-lg">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-teal text-center mb-3">
                Invite Friends to Room
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/60 bg-white/65 hover:bg-white/80 transition"
                  >
                    <div>
                      <p className="text-sm font-bold text-brand-gray-700 flex items-center gap-1.5 flex-wrap">
                        {friend.full_name || friend.email.split("@")[0]}
                        {friend.is_online ? (
                          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200/50 px-1.5 py-0.5 rounded-lg text-[10px] font-bold animate-pulse leading-none flex-none select-none">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-gray-50 text-gray-400 border border-gray-200/50 px-1.5 py-0.5 rounded-lg text-[10px] font-bold leading-none flex-none select-none">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            Offline
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-brand-gray-400 font-mono">UID: #{friend.id}</p>
                    </div>
                    <button
                      onClick={() => handleInviteFriend(friend.id, friend.full_name || friend.email.split("@")[0])}
                      className="px-3 py-1 bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white rounded-xl text-xs font-bold transition border border-brand-teal/20 shadow-sm whitespace-nowrap"
                    >
                      Invite (邀請)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function QuestionTypeDropdown({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: number | null;
  options: Array<{ value: number; label: string }>;
  placeholder: string;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`flex h-[48px] w-full items-center justify-between rounded-[16px] border border-[#b8cfdf] bg-[#eef3f7] px-4 text-left text-sm font-semibold text-brand-gray-700 transition ${
          disabled ? "cursor-not-allowed opacity-70" : "hover:border-[#9fc0d6]"
        } ${open ? "ring-2 ring-[#c9dcea]" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="truncate">{activeLabel}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-[#b5bfc8] transition ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.25 7.5 10 12.25 14.75 7.5" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-[16px] border border-[#c7dae7] bg-[#f4f8fb] p-2 shadow-[0_8px_18px_rgba(90,129,154,0.18)]"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                option.value === value
                  ? "bg-[#dfeaf2] text-brand-gray-800"
                  : "text-brand-gray-600 hover:bg-[#e8f0f6]"
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <span className="text-xs text-[#6ea7c4]">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LobbyPlayerCard({
  title,
  avatarSrc,
  role,
  isReady,
  isHost = false,
  isSelf = false,
  connectionState,
  loading = false,
  onTransferHost,
  onKick,
  hostActionsDisabled = false,
}: {
  title: string;
  avatarSrc?: string;
  role: string;
  isReady: boolean;
  isHost?: boolean;
  isSelf?: boolean;
  actionLabel?: string;
  onReadyToggle?: () => void;
  readyDisabled?: boolean;
  connectionState?: string | null;
  loading?: boolean;
  onTransferHost?: () => void;
  onKick?: () => void;
  hostActionsDisabled?: boolean;
}) {
  const isEmpty = loading;
  const hasHostActions = Boolean(onTransferHost || onKick);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const outerGlow = isEmpty
    ? "shadow-[0_18px_36px_rgba(95,146,165,0.10)]"
    : isHost
      ? "shadow-[0_20px_38px_rgba(212,169,106,0.22)]"
      : "shadow-[0_18px_36px_rgba(122,199,196,0.18)]";

  return (
    <div
      className={`relative w-full rounded-[24px] bg-white/70 p-2.5 backdrop-blur-xl transition-all duration-300 ${outerGlow} ${menuOpen ? "z-20" : ""}`}
    >
      {/* Corner glow accent (matches queue card) */}
      <div className="pointer-events-none absolute -top-px -left-px h-1/3 w-1/2 overflow-hidden rounded-tl-[22px] bg-gradient-to-br from-white/60 to-transparent" />

      <div
        className={`relative flex min-h-[130px] items-center justify-center rounded-[18px] p-3 ${
          isEmpty
            ? "bg-[linear-gradient(155deg,rgba(232,245,247,0.6),rgba(200,228,233,0.65))]"
            : isHost
              ? "bg-[linear-gradient(155deg,rgba(255,241,209,0.85),rgba(248,220,170,0.92))]"
              : "bg-[linear-gradient(155deg,rgba(232,245,247,0.85),rgba(200,228,233,0.92))]"
        }`}
      >
        {/* Inner radial pattern (matches queue card) */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px] opacity-30"
          style={{
            backgroundImage: isHost
              ? "radial-gradient(circle at 20% 30%, rgba(212,169,106,0.25) 0%, transparent 35%), radial-gradient(circle at 80% 70%, rgba(255,193,87,0.18) 0%, transparent 40%)"
              : "radial-gradient(circle at 20% 30%, rgba(122,199,196,0.18) 0%, transparent 35%), radial-gradient(circle at 80% 70%, rgba(212,169,106,0.12) 0%, transparent 40%)",
          }}
        />

        {loading ? (
          <OpenSlotIndicator />
        ) : hasHostActions ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={hostActionsDisabled}
              className="block rounded-full transition hover:scale-105 disabled:opacity-50"
              aria-label="Player actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <AvatarBubble src={avatarSrc} alt={title} isReady={isReady} isHost={isHost} />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute left-1/2 top-full z-30 mt-2 w-40 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1 shadow-[0_12px_28px_rgba(95,146,165,0.25)] backdrop-blur"
              >
                {onTransferHost ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onTransferHost();
                    }}
                    disabled={hostActionsDisabled}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                    role="menuitem"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M3 19h18l-2.5-11-3.75 5L12 7l-2.75 6L5.5 8 3 19z" />
                    </svg>
                    Make Host
                  </button>
                ) : null}
                {onKick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onKick();
                    }}
                    disabled={hostActionsDisabled}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    role="menuitem"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Kick Player
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <AvatarBubble src={avatarSrc} alt={title} isReady={isReady} isHost={isHost} />
        )}
      </div>

      <div className="mt-2 overflow-hidden rounded-[14px] border border-white/60 bg-white/85 px-3 py-2.5 text-center shadow-[0_8px_18px_rgba(95,146,165,0.08)]">
        <p className={`truncate font-heading text-sm font-extrabold leading-tight ${isEmpty ? "text-brand-gray-400" : "text-brand-gray-700"}`}>
          {title}
        </p>

        {connectionState === "disconnected" ? (
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-500">
            Disconnected
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OpenSlotIndicator() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative h-[88px] w-[88px]">
        {/* Outer pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#7AC7C4]/30"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeOut" }}
        />
        {/* Inner pulsing ring */}
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-[#7AC7C4]/40"
          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 0, 0.65] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeOut", delay: 0.4 }}
        />
        {/* Center bubble */}
        <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white/70 shadow-[inset_0_0_0_2px_rgba(122,199,196,0.25)] backdrop-blur">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#7AC7C4]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-1 font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-[#4a9e9b]/75">
        <span>Open Slot</span>
        <SlotDots />
      </div>
    </div>
  );
}

function SlotDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-[#5fb3af]/70"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

function AvatarBubble({ src, alt, isReady = false, isHost = false }: { src?: string; alt: string; isReady?: boolean; isHost?: boolean }) {
  const imageSrc = src || "/avatar/chicken.png";
  return (
    <div className="relative flex h-[88px] w-[88px] items-center justify-center">
      {/* Soft glow halo (matches queue card) */}
      <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.5),rgba(255,255,255,0)_60%)]" />
      {/* Avatar */}
      <div className="relative h-[78px] w-[78px] overflow-hidden rounded-full bg-white shadow-[0_10px_20px_rgba(95,146,165,0.18)]">
        <Image src={imageSrc} alt={alt} fill sizes="78px" className="object-cover" />
      </div>
      {isHost && (
        <div className="absolute -top-2 -right-2 z-10 rotate-[20deg]">
          <svg viewBox="0 0 32 26" className="h-7 w-7" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFF176" />
                <stop offset="55%" stopColor="#FFCA28" />
                <stop offset="100%" stopColor="#FF8F00" />
              </linearGradient>
              <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD54F" />
                <stop offset="100%" stopColor="#E65100" />
              </linearGradient>
              <filter id="cs" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#B45309" floodOpacity="0.55" />
              </filter>
            </defs>
            <path
              d="M2.5 19.5 C2.5 19.5 5 10 6.5 9 C8 8 10.5 13 12 14.5 C13 15.5 14.5 10 16 5.5 C17.5 10 19 15.5 20 14.5 C21.5 13 24 8 25.5 9 C27 10 29.5 19.5 29.5 19.5 Z"
              fill="url(#cg1)"
              filter="url(#cs)"
              strokeLinejoin="round"
            />
            <rect x="2.5" y="19.5" width="27" height="4.5" rx="2.25" fill="url(#cg2)" />
            <path
              d="M9 13 C10.5 10.5 13.5 8 16 5.5 C18.5 8 21.5 10.5 23 13 C21 11 18.5 9.5 16 8 C13.5 9.5 11 11 9 13 Z"
              fill="white"
              opacity="0.3"
            />
            <circle cx="16" cy="5" r="2.2" fill="#FF4D4D" />
            <circle cx="16" cy="4.2" r="0.7" fill="white" opacity="0.6" />
            <circle cx="6.5" cy="9" r="1.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.4" />
            <circle cx="25.5" cy="9" r="1.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.4" />
          </svg>
        </div>
      )}
      {isReady && (
        <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </div>
  );
}
