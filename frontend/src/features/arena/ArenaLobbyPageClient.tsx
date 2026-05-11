"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { fetchArenaPublicCourses, joinArenaRoom, leaveArenaRoom, setArenaRoomReady, startArenaRoom, updateArenaRoomSettings, transferArenaRoomHost } from "@/lib/arena/api";
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
    }
  }, [room, router]);

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
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gray-400">Room Code</p>
          <h1 className="mt-1.5 font-heading text-3xl font-black leading-none tracking-tight text-brand-gray-700 md:text-5xl">
            {roomLabel}
          </h1>
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
                    onReadyToggle={isSelf ? () => void handleReadyToggle() : undefined}
                    readyDisabled={!isSelf || busy}
                    connectionState={player.connectionState}
                    actionLabel={isSelf ? (player.isReady ? "UNREADY" : "READY UP") : (player.isReady ? "READY" : "WAITING")}
                    onTransferHost={iAmHost && !isSelf ? () => void handleTransferHost(player.userId) : undefined}
                    transferHostDisabled={busy}
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
              className="min-w-[180px]"
            >
              Leave Room
            </GameButton>
            <GameButton
              onClick={() => void handleStart()}
              disabled={!room?.canStart || room?.hostUserId !== authUser?.id || busy}
              className="min-w-[180px]"
            >
              Start Match
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
  actionLabel,
  onReadyToggle,
  readyDisabled,
  connectionState,
  loading = false,
  onTransferHost,
  transferHostDisabled = false,
}: {
  title: string;
  avatarSrc?: string;
  role: string;
  isReady: boolean;
  isHost?: boolean;
  actionLabel: string;
  onReadyToggle?: () => void;
  readyDisabled: boolean;
  connectionState?: string | null;
  loading?: boolean;
  onTransferHost?: () => void;
  transferHostDisabled?: boolean;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-[18px] border border-white/70 bg-white/62 p-2 backdrop-blur-xl shadow-[0_8px_20px_rgba(95,146,165,0.13)] transition-all duration-300">
      <div className="relative flex min-h-[110px] items-center justify-center rounded-[12px] bg-[linear-gradient(180deg,rgba(222,241,247,0.9),rgba(210,233,242,0.94))] p-2">
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-teal/15 border-t-brand-teal/60" />
        ) : (
          <AvatarBubble src={avatarSrc} alt={title} isReady={isReady} isHost={isHost} />
        )}
      </div>

      <div className="mt-1.5 overflow-hidden rounded-[10px] bg-white/80 px-2.5 py-2 text-center shadow-[0_4px_10px_rgba(95,146,165,0.07)]">
        <p className="truncate font-heading text-xs font-extrabold leading-none text-brand-gray-700">
          {title}
        </p>
        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-teal">
          {role}
        </p>

        {onReadyToggle ? (
          <GameButton
            onClick={onReadyToggle}
            disabled={readyDisabled}
            className="mt-1.5 h-7 w-full text-[11px]"
          >
            {actionLabel}
          </GameButton>
        ) : (
          <GameButton variant="secondary" disabled className="mt-1.5 h-7 w-full text-[11px]">
            {actionLabel}
          </GameButton>
        )}

        {onTransferHost ? (
          <button
            type="button"
            onClick={onTransferHost}
            disabled={transferHostDisabled}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-600 transition hover:bg-amber-100 disabled:opacity-50"
          >
            Make Host
          </button>
        ) : null}

        {connectionState === "disconnected" ? (
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-500">
            Disconnected
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AvatarBubble({ src, alt, isReady = false, isHost = false }: { src?: string; alt: string; isReady?: boolean; isHost?: boolean }) {
  const imageSrc = src || "/avatar/chicken.png";
  return (
    <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/35 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.26)]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0)_58%)]" />
      <div className="relative h-[54px] w-[54px] overflow-hidden rounded-full bg-white shadow-[0_5px_12px_rgba(95,146,165,0.15)]">
        <Image src={imageSrc} alt={alt} fill sizes="54px" className="object-cover" />
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
            {/* main crown shape — smooth curves */}
            <path
              d="M2.5 19.5 C2.5 19.5 5 10 6.5 9 C8 8 10.5 13 12 14.5 C13 15.5 14.5 10 16 5.5 C17.5 10 19 15.5 20 14.5 C21.5 13 24 8 25.5 9 C27 10 29.5 19.5 29.5 19.5 Z"
              fill="url(#cg1)"
              filter="url(#cs)"
              strokeLinejoin="round"
            />
            {/* base band */}
            <rect x="2.5" y="19.5" width="27" height="4.5" rx="2.25" fill="url(#cg2)" />
            {/* highlight sheen on body */}
            <path
              d="M9 13 C10.5 10.5 13.5 8 16 5.5 C18.5 8 21.5 10.5 23 13 C21 11 18.5 9.5 16 8 C13.5 9.5 11 11 9 13 Z"
              fill="white"
              opacity="0.3"
            />
            {/* top gem */}
            <circle cx="16" cy="5" r="2.2" fill="#FF4D4D" />
            <circle cx="16" cy="4.2" r="0.7" fill="white" opacity="0.6" />
            {/* side dots */}
            <circle cx="6.5" cy="9" r="1.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.4" />
            <circle cx="25.5" cy="9" r="1.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.4" />
          </svg>
        </div>
      )}
      {isReady && (
        <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </div>
  );
}
