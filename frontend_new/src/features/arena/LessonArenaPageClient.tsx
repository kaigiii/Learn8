"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import TopProgressBar from "@/components/ui/TopProgressBar";
import GameButton from "@/components/ui/GameButton";
import { apiFetch } from "@/lib/apiClient";
import type { LessonStage, SubmissionResponse } from "@/lib/apiTypes";
import useArenaStore from "@/stores/useArenaStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProjectStore } from "@/stores/useProjectStore";
import useUserStore from "@/stores/useUserStore";
import { ArenaChatPanel } from "./ArenaChatPanel";
import { ArenaFeedbackOverlay } from "./ArenaFeedbackOverlay";
import { ArenaStageRenderer } from "./ArenaStageRenderer";
import { useLessonGenerationFlow } from "./useLessonGenerationFlow";
import { useMatchingPairsStage } from "./useMatchingPairsStage";

/* ═══════════════════ Page ═══════════════════ */

export default function LessonArenaPageClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const router = useRouter();
  const params = useParams();
  const nodeId = explicitNodeId ?? (params.nodeId as string);
  const routeCourseId = explicitCourseId ?? (params.courseId as string | undefined);
  const token = useAuthStore((s) => s.token);
  const currentProject = useProjectStore((s) => s.currentProject);

  // Arena store
  const arenaStore = useArenaStore();
  const { startSession, markCorrect: arenaMarkCorrect, markIncorrect: arenaMarkIncorrect, useHint: arenaUseHint, triggerConfetti: arenaTriggerConfetti, triggerShake: arenaTriggerShake } = arenaStore;

  // User store
  const spendGems = useUserStore((s) => s.spendGems);
  const setLastActiveNode = useUserStore((s) => s.setLastActiveNode);

  const [stageIdx, setStageIdx] = useState(0);
  const resetInteractiveStageState = useCallback(() => {
    setStageIdx(0);
  }, []);
  const {
    backendCourseId,
    isBackendLesson,
    backendCourse,
    backendNode,
    backendStages,
    backendLoading,
    backendError,
    backendJobProgress,
    backendJobMessage,
    cancelGeneration,
  } = useLessonGenerationFlow({
    routeCourseId,
    nodeId,
    token,
    currentProjectId: currentProject?.id ?? null,
    onStagesReady: resetInteractiveStageState,
  });

  const backendStage = backendStages[stageIdx] ?? null;
  const backendMatchStage = useMemo(() => {
    if (backendStage?.component !== "MatchingPairs") return null;
    const data = backendStage.config.data as { question?: string; pairs?: { left: string; right: string }[] };
    return {
      question: data.question || backendStage.topic,
      pairs: (data.pairs || []).map((pair) => ({ left: pair.left, right: pair.right })),
    };
  }, [backendStage]);
  const totalStages = Math.max(backendStages.length, 1);
  const progress = (stageIdx / totalStages) * 100;
  const nodeDescription = backendNode?.description ?? "";
  const matchPairs = backendMatchStage?.pairs ?? [];

  useEffect(() => {
    if (backendStages.length === 0) return;
    startSession({ nodeId, courseId: String(backendCourseId), totalStages });
    setLastActiveNode(nodeId);
  }, [backendCourseId, backendStages.length, nodeId, setLastActiveNode, startSession, totalStages]);

  const submitBackendStage = useCallback(
    async (stageToSubmit: LessonStage, userInput: unknown, isCorrect: boolean) => {
      const response = await apiFetch<SubmissionResponse>("/lessons/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          stageId: stageToSubmit.stageId,
          userInput,
          isCorrect,
          context_topic: backendCourse?.topic || backendCourse?.courseTitle || stageToSubmit.topic,
          component: stageToSubmit.component,
          failedStage: !isCorrect ? stageToSubmit : undefined,
        }),
      });

      if (response.nextAction === "proceed") {
        matchingStage.markCorrectFeedback();
        arenaMarkCorrect();
        arenaTriggerConfetti();
      } else {
        matchingStage.markIncorrectFeedback();
        arenaMarkIncorrect();
        arenaTriggerShake();
      }
    },
    [arenaMarkCorrect, arenaMarkIncorrect, arenaTriggerConfetti, arenaTriggerShake, backendCourse]
  );
  const matchingStage = useMatchingPairsStage({
    pairs: matchPairs,
    enabled: backendStage?.component === "MatchingPairs",
    onCorrectStageComplete: (pairsPayload) => {
      if (backendStage) {
        void submitBackendStage(backendStage, pairsPayload, true);
      }
    },
    onIncorrectSelection: () => {
      arenaMarkIncorrect();
      arenaTriggerShake();
    },
    onHintUse: () => {
      const canAfford = spendGems(10);
      if (canAfford) arenaUseHint();
      return canAfford;
    },
  });

  /* Continue to next stage or result */
  const handleContinue = useCallback(() => {
    if (stageIdx < totalStages - 1) {
      setStageIdx((i) => i + 1);
      matchingStage.clearFeedback();
    } else {
      router.push(`/courses/${backendCourseId}/nodes/${nodeId}/result`);
    }
  }, [backendCourseId, matchingStage, nodeId, router, stageIdx, totalStages]);

  if (!isBackendLesson) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
        <TopProgressBar progress={0} />
        <div className="mx-auto flex min-h-[calc(100vh-12px)] max-w-3xl items-center justify-center px-6">
          <div className="rounded-3xl border border-amber-200 bg-white/80 px-6 py-5 text-sm text-brand-gray-700 shadow-lg backdrop-blur">
            Invalid lesson route.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8] flex flex-col">
      {/* ─── Top Nav ─── */}
      <div className="flex items-center gap-3 px-8 pt-4 pb-1">
        <button
          onClick={() =>
            router.push(`/courses/${backendCourseId}`)
          }
          className="h-9 w-9 rounded-full bg-white/60 backdrop-blur flex items-center justify-center hover:bg-white/80 transition"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1">
          <TopProgressBar progress={progress} className="h-3" />
        </div>
      </div>

      {/* ─── Main content: two columns ─── */}
      <div className="flex-1 flex gap-8 px-8 pb-4 w-full min-h-0">
        {/* ── Left: Question + Match Grid ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {backendLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-lg rounded-3xl bg-white/70 px-8 py-6 text-center shadow-lg">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/20 border-t-brand-teal" />
                  <p className="font-heading text-lg font-bold text-brand-gray-700">
                    Forging lesson stages...
                  </p>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    {backendJobMessage}
                  </p>
                  <div className="mx-auto mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af] transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(backendJobProgress, 100))}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-teal/80">
                    {Math.round(Math.max(0, Math.min(backendJobProgress, 100)))}% complete
                  </p>
                  <div className="mt-5">
                    <GameButton
                      variant="secondary"
                      onClick={() => void cancelGeneration()}
                    >
                      Cancel Generation
                    </GameButton>
                  </div>
                </div>
              </div>
            ) : backendError ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-3xl bg-white/80 px-8 py-6 text-center shadow-lg">
                  <p className="font-heading text-lg font-bold text-rose-500">
                    {backendError}
                  </p>
                </div>
              </div>
            ) : backendStage ? (
              <ArenaStageRenderer
                stage={backendStage}
                stageIdx={stageIdx}
                totalStages={totalStages}
                nodeDescription={nodeDescription}
                matchPairs={matchPairs}
                matchQuestion={backendMatchStage?.question || backendStage.topic}
                matchingStage={matchingStage}
                onSubmitStage={(stage, input, isCorrect) =>
                  void submitBackendStage(stage, input, isCorrect)
                }
                onContinue={handleContinue}
                onHintUse={() => {
                  const canAfford = spendGems(10);
                  if (canAfford) arenaUseHint();
                  return canAfford;
                }}
              />
            ) : null}
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        <div className="w-[360px] flex-shrink-0 pt-2">
          <ArenaChatPanel />
        </div>
      </div>

      {/* ─── Feedback overlay ─── */}
      <AnimatePresence>
        {matchingStage.feedback && (
          <ArenaFeedbackOverlay
            type={matchingStage.feedback}
            onContinue={handleContinue}
            showConfetti={matchingStage.showConfetti}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
