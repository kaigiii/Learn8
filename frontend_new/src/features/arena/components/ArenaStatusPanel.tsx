"use client";

import GameButton from "@/components/ui/GameButton";
import { getJobCancelLabel, getJobRetryLabel } from "@/lib/jobs/policy";
import { clampJobProgress, formatJobProgressLabel } from "@/lib/jobs/presentation";

interface ArenaStatusPanelProps {
  phaseTransitionError: string;
  phaseTransitionLoading: boolean;
  phaseTransitionMessage: string;
  hasPendingNavigation: boolean;
  backendJobMessage: string;
  backendJobProgress: number;
  activePhase: string;
  onRetry: () => void;
  onExit: () => void;
  onCancelGeneration: () => void;
}

export function ArenaStatusPanel({
  phaseTransitionError,
  phaseTransitionLoading,
  phaseTransitionMessage,
  hasPendingNavigation,
  backendJobMessage,
  backendJobProgress,
  activePhase,
  onRetry,
  onExit,
  onCancelGeneration,
}: ArenaStatusPanelProps) {
  const clampedProgress = clampJobProgress(backendJobProgress);
  const isWrapping = phaseTransitionLoading || hasPendingNavigation;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white/70 px-8 py-6 text-center shadow-lg">
        {phaseTransitionError ? (
          <>
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 8v5" />
                <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="font-heading text-lg font-bold text-brand-gray-700">
              Remedial generation interrupted
            </p>
            <p className="mt-2 text-sm text-brand-gray-500">
              {phaseTransitionError}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <GameButton variant="secondary" onClick={onRetry}>
                {getJobRetryLabel()}
              </GameButton>
              <GameButton variant="primary" onClick={onExit}>
                Exit
              </GameButton>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/20 border-t-brand-teal" />
            <p className="font-heading text-lg font-bold text-brand-gray-700">
              {isWrapping ? "Finalising current lesson..." : "Forging lesson stages..."}
            </p>
            <p className="mt-2 text-sm text-brand-gray-500">
              {phaseTransitionLoading
                ? phaseTransitionMessage
                : hasPendingNavigation
                  ? "Wrapping up your results and moving you to the lesson summary..."
                  : backendJobMessage}
            </p>
            <div className="mx-auto mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af] transition-all duration-500"
                style={{ width: `${isWrapping ? 85 : clampedProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-teal/80">
              {isWrapping
                ? activePhase === "primary"
                  ? "Primary complete"
                  : "Remedial complete"
                : formatJobProgressLabel(clampedProgress)}
            </p>
          </>
        )}
        {!phaseTransitionLoading && !phaseTransitionError && !hasPendingNavigation && (
          <div className="mt-5">
            <GameButton variant="secondary" onClick={onCancelGeneration}>
              {getJobCancelLabel()}
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}
