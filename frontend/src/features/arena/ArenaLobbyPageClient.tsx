"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { fetchArenaPublicCourses, leaveArenaRoom, setArenaRoomReady, startArenaRoom, updateArenaRoomSettings } from "@/lib/arena/api";
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

  return (
    <div className="min-h-screen bg-[url('/backgrounds/MainBg.png')] bg-cover bg-center bg-no-repeat">
      <TopStatsBar backHref="/home" pageTitle="Arena Lobby" />
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-teal">Room Code</p>
          <h1 className="mt-3 font-heading text-[2.7rem] font-black leading-none tracking-tight text-brand-gray-700 md:text-6xl">
            {roomLabel}
          </h1>
          <div className="mx-auto mt-4 max-w-sm">
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

        <div className="mt-10 flex w-full flex-col items-center justify-center gap-5 lg:flex-row lg:gap-8 xl:gap-10">
          <LobbyPlayerCard
            title={currentName}
            avatarSrc={currentAvatar}
            role={currentPlayer?.isHost ? "Host" : "You"}
            isReady={currentPlayer?.isReady ?? false}
            readyLabel={currentPlayer?.isReady ? "READY" : "WAITING"}
            onReadyToggle={() => void handleReadyToggle()}
            readyDisabled={!currentPlayer || busy}
            connectionState={currentPlayer?.connectionState}
            actionLabel={currentPlayer?.isReady ? "UNREADY" : "READY UP"}
          />

          <div className="flex flex-col items-center justify-center px-1 md:px-2 lg:px-3">
            <span className="font-heading text-6xl font-black tracking-tight text-brand-gray-600 md:text-7xl lg:text-[6.25rem]">
              VS
            </span>
          </div>

          <LobbyPlayerCard
            title={hasOpponent ? opponentName : "Waiting for opponent"}
            avatarSrc={hasOpponent ? opponentAvatar : undefined}
            role={opponentPlayer?.isHost ? "Host" : "Player"}
            isReady={opponentPlayer?.isReady ?? false}
            readyLabel={opponentPlayer?.isReady ? "READY" : "WAITING"}
            onReadyToggle={undefined}
            readyDisabled
            connectionState={opponentPlayer?.connectionState}
            loading={!hasOpponent}
            actionLabel={opponentPlayer?.isReady ? "READY" : "WAITING"}
          />
        </div>

        <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-3">
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
  readyLabel,
  actionLabel,
  onReadyToggle,
  readyDisabled,
  connectionState,
  loading = false,
}: {
  title: string;
  avatarSrc?: string;
  role: string;
  isReady: boolean;
  readyLabel: string;
  actionLabel: string;
  onReadyToggle?: () => void;
  readyDisabled: boolean;
  connectionState?: string | null;
  loading?: boolean;
}) {
  const readyToneClassName = isReady
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

  return (
    <div className="relative w-full max-w-[360px] overflow-hidden rounded-[30px] border border-white/70 bg-white/62 p-4 backdrop-blur-xl shadow-[0_28px_50px_rgba(95,146,165,0.14)] lg:w-[min(44vw,360px)]">
      <div className="relative flex min-h-[290px] items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(222,241,247,0.9),rgba(210,233,242,0.94))] p-4">
        {loading ? (
          <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-brand-teal/15 border-t-brand-teal/60" />
        ) : (
          <AvatarBubble src={avatarSrc} alt={title} />
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-[18px] bg-white/80 px-5 py-4 text-center shadow-[0_10px_24px_rgba(95,146,165,0.08)]">
        <p className="truncate font-heading text-[1.55rem] font-extrabold leading-none text-brand-gray-700">
          {title}
        </p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-teal">
          {role}
        </p>

        <div className={`mx-auto mt-3 inline-flex min-w-[180px] items-center justify-center rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[0.16em] ${readyToneClassName}`}>
          {readyLabel}
        </div>

        {onReadyToggle ? (
          <GameButton
            onClick={onReadyToggle}
            disabled={readyDisabled}
            className="mt-3 h-11 w-full"
          >
            {actionLabel}
          </GameButton>
        ) : (
          <GameButton variant="secondary" disabled className="mt-3 h-11 w-full">
            {actionLabel}
          </GameButton>
        )}

        {connectionState === "disconnected" ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
            Disconnected
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AvatarBubble({ src, alt }: { src?: string; alt: string }) {
  const imageSrc = src || "/avatar/chicken.png";
  return (
    <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full bg-white/35 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.26)]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0)_58%)]" />
      <div className="relative h-[138px] w-[138px] overflow-hidden rounded-full bg-white shadow-[0_18px_30px_rgba(95,146,165,0.15)]">
        <Image src={imageSrc} alt={alt} fill sizes="138px" className="object-cover" />
      </div>
    </div>
  );
}
