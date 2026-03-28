"use client";

import ForgeStatus from "@/components/feedback/ForgeStatus";
import GameButton from "@/components/ui/GameButton";
import { getJobCancelLabel, getJobRetryLabel } from "@/lib/jobs/policy";
import { clampJobProgress } from "@/lib/jobs/presentation";

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
  const title = phaseTransitionError
    ? "Generation interrupted"
    : isWrapping
      ? "Finalising current lesson..."
      : "Forging lesson stages...";
  const message = phaseTransitionLoading
    ? phaseTransitionMessage
    : hasPendingNavigation
      ? "Wrapping up your results and moving you to the lesson summary..."
      : backendJobMessage;
  const progress = isWrapping ? 85 : clampedProgress;
  const actions = phaseTransitionError ? (
    <>
      <GameButton variant="secondary" onClick={onRetry}>
        {getJobRetryLabel()}
      </GameButton>
      <GameButton variant="primary" onClick={onExit}>
        Exit
      </GameButton>
    </>
  ) : !phaseTransitionLoading && !hasPendingNavigation ? (
    <GameButton variant="secondary" onClick={onCancelGeneration}>
      {getJobCancelLabel()}
    </GameButton>
  ) : null;

  return (
    <ForgeStatus
      error={phaseTransitionError || undefined}
      title={title}
      subtitle={
        isWrapping && activePhase === "remedial"
          ? "Closing out your remedial run and preparing the result summary."
          : undefined
      }
      statusMessage={message}
      progress={progress}
      actions={actions}
    />
  );
}
