"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reorder } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import TopProgressBar from "@/components/ui/TopProgressBar";
import GameButton from "@/components/ui/GameButton";
import { ApiError, apiFetch, buildSseUrl } from "@/lib/api";
import type { CoursePath, JobStreamEvent, LessonNode, LessonStage, SubmissionResponse } from "@/lib/types";
import useArenaStore from "@/stores/useArenaStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProjectStore } from "@/stores/useProjectStore";
import useUserStore from "@/stores/useUserStore";
import TaxonomyMatrix from "@/components/arena/TaxonomyMatrix";
import SpatialAnatomy from "@/components/arena/SpatialAnatomy";
import LogicChain from "@/components/arena/LogicChain";
import MultipleChoice from "@/components/arena/MultipleChoice";
import FeynmanPrompt from "@/components/arena/FeynmanPrompt";

/* ═══════════════════ (Taxonomy answer keys are now embedded in each stage's config.data.correctAssignments) ═══════════════════ */

/* ═══════════════════ Data ═══════════════════ */

interface MatchPair { left: string; right: string }

const STAGES: { question: string; pairs: MatchPair[] }[] = [
  {
    question: "Match the English word to its French translation",
    pairs: [
      { left: "Apple", right: "Pomme" },
      { left: "Book", right: "Livre" },
      { left: "House", right: "Maison" },
      { left: "Cat", right: "Chat" },
    ],
  },
  {
    question: "Match the animals",
    pairs: [
      { left: "Dog", right: "Chien" },
      { left: "Bird", right: "Oiseau" },
      { left: "Fish", right: "Poisson" },
      { left: "Horse", right: "Cheval" },
    ],
  },
  {
    question: "Match the colors",
    pairs: [
      { left: "Red", right: "Rouge" },
      { left: "Blue", right: "Bleu" },
      { left: "Green", right: "Vert" },
      { left: "White", right: "Blanc" },
    ],
  },
];

/* ═══════════════════ Helpers ═══════════════════ */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeChoiceOptions(stage: LessonStage) {
  const rawOptions = Array.isArray(stage.config.data?.options)
    ? stage.config.data.options
    : [];

  return rawOptions.map((option, index) => {
    if (typeof option === "string") {
      return { id: `option-${index}`, text: option };
    }
    if (option && typeof option === "object") {
      const item = option as { id?: string; text?: string; label?: string };
      return {
        id: item.id || `option-${index}`,
        text: item.text || item.label || `Option ${index + 1}`,
      };
    }
    return { id: `option-${index}`, text: `Option ${index + 1}` };
  });
}

function getCorrectOptionId(stage: LessonStage) {
  const data = stage.config.data as {
    correctId?: string;
    correctOptionId?: string;
  };
  const validation = stage.validation.condition as {
    correctId?: string;
    correctOptionId?: string;
  };
  return (
    data.correctId ||
    data.correctOptionId ||
    validation.correctId ||
    validation.correctOptionId ||
    ""
  );
}

/* ═══════════════════ Page ═══════════════════ */

export default function ArenaClient({
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
  const [backendCourseId, setBackendCourseId] = useState<number | null>(null);
  const isBackendLesson = backendCourseId !== null;
  const token = useAuthStore((s) => s.token);
  const currentProject = useProjectStore((s) => s.currentProject);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchCourseId = new URLSearchParams(window.location.search).get("courseId");
    const resolvedCourseId =
      routeCourseId && /^\d+$/.test(routeCourseId)
        ? routeCourseId
        : searchCourseId;
    setBackendCourseId(
      resolvedCourseId && /^\d+$/.test(resolvedCourseId)
        ? Number(resolvedCourseId)
        : null
    );
  }, [routeCourseId]);

  // Arena store
  const arenaStore = useArenaStore();
  const { startSession, markCorrect: arenaMarkCorrect, markIncorrect: arenaMarkIncorrect, useHint: arenaUseHint, triggerConfetti: arenaTriggerConfetti, triggerShake: arenaTriggerShake } = arenaStore;

  // User store
  const spendGems = useUserStore((s) => s.spendGems);
  const setLastActiveNode = useUserStore((s) => s.setLastActiveNode);

  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendStages, setBackendStages] = useState<LessonStage[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [backendJobProgress, setBackendJobProgress] = useState(0);
  const [backendJobMessage, setBackendJobMessage] = useState("Preparing lesson generation...");
  const [backendJobId, setBackendJobId] = useState<string | null>(null);

  const backendNode = useMemo(() => {
    if (!backendCourse) return null;
    for (const unit of backendCourse.units) {
      const found = unit.nodes.find((node) => node.id === nodeId);
      if (found) return found;
    }
    return null;
  }, [backendCourse, nodeId]);

  const [stageIdx, setStageIdx] = useState(0);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPair, setHintPair] = useState<string | null>(null);

  const backendStage = backendStages[stageIdx] ?? null;
  const backendMatchStage = useMemo(() => {
    if (backendStage?.component !== "MatchingPairs") return null;
    const data = backendStage.config.data as { question?: string; pairs?: { left: string; right: string }[] };
    return {
      question: data.question || backendStage.topic,
      pairs: (data.pairs || []).map((pair) => ({ left: pair.left, right: pair.right })),
    };
  }, [backendStage]);
  const stage = backendMatchStage || STAGES[stageIdx % STAGES.length];
  const totalStages = Math.max(backendStages.length, 1);
  const progress = (stageIdx / totalStages) * 100;
  const nodeDescription = backendNode?.description ?? "";

  useEffect(() => {
    if (backendStages.length === 0) return;
    startSession({ nodeId, courseId: String(backendCourseId), totalStages });
    setLastActiveNode(nodeId);
  }, [backendCourseId, backendStages.length, nodeId, setLastActiveNode, startSession, totalStages]);

  useEffect(() => {
    if (!isBackendLesson) return;
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    const loadCourse = async () => {
      try {
        const data = await apiFetch<CoursePath>(`/courses/${backendCourseId}`);
        setBackendCourse(data);
      } catch (err) {
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to load lesson context."
        );
      }
    };

    void loadCourse();
  }, [backendCourseId, isBackendLesson, router, token]);

  useEffect(() => {
    if (!isBackendLesson || !backendCourse || !backendNode) return;

    let eventSource: EventSource | null = null;
    const storageKey = "learn8_pending_lesson";

    const clearPendingLesson = () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey);
      }
    };

    const applyStages = (stages: LessonStage[]) => {
      setBackendStages(stages);
      setStageIdx(0);
      setMatched([]);
      setMatchedPairs({});
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);
      setFeedback(null);
      setShowConfetti(false);
      setHintUsed(false);
      setHintPair(null);
      setBackendLoading(false);
      setBackendJobProgress(100);
      setBackendJobMessage("Lesson ready.");
      clearPendingLesson();
    };

    const connectLessonJob = (jobId: string) => {
      setBackendJobId(jobId);
      eventSource = new EventSource(buildSseUrl(jobId));
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as JobStreamEvent;
        setBackendJobProgress(data.progress ?? 0);
        setBackendJobMessage(data.message || "Forging lesson stages...");
        if (data.status === "COMPLETED") {
          setBackendJobId(null);
          eventSource?.close();
          const result = (data.result_data || {}) as { stages?: LessonStage[] };
          applyStages(result.stages || []);
        }
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setBackendJobId(null);
          eventSource?.close();
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError(data.message || "Lesson generation failed.");
        }
      };
      eventSource.onerror = () => {
        setBackendJobId(null);
        eventSource?.close();
        clearPendingLesson();
        setBackendLoading(false);
        setBackendError("Lost connection while generating the lesson.");
      };
    };

    const generateLesson = async () => {
      setBackendLoading(true);
      setBackendError("");
      setBackendJobProgress(0);
      setBackendJobMessage("Preparing lesson generation...");
      try {
        if (typeof window !== "undefined") {
          const rawPending = window.sessionStorage.getItem(storageKey);
          if (rawPending) {
            try {
              const pending = JSON.parse(rawPending) as {
                nodeId?: string;
                courseId?: number;
              };
              if (
                pending.nodeId === nodeId &&
                pending.courseId === backendCourseId
              ) {
                const activeJob = await apiFetch<{
                  job_id: string | null;
                  job_type?: string;
                }>("/jobs/active");
                if (
                  activeJob.job_id &&
                  activeJob.job_type === "LESSON_GEN"
                ) {
                  connectLessonJob(activeJob.job_id);
                  return;
                }
              }
            } catch {
              window.sessionStorage.removeItem(storageKey);
            }
          }
        }

        const projectQuery = currentProject ? `&project_id=${currentProject.id}` : "";
        const response = await apiFetch<{
          status: "PENDING" | "COMPLETED";
          job_id?: string;
          result_data?: { stages?: LessonStage[] };
        }>(
          `/lessons/generate-lesson-from-node?topic=${encodeURIComponent(
            backendCourse.topic || backendCourse.courseTitle
          )}${projectQuery}`,
          {
            method: "POST",
            body: JSON.stringify(backendNode),
          }
        );

        if (response.status === "COMPLETED") {
          setBackendJobId(null);
          applyStages(response.result_data?.stages || []);
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              nodeId,
              courseId: backendCourseId,
            })
          );
        }
        connectLessonJob(String(response.job_id));
      } catch (err) {
        setBackendJobId(null);
        clearPendingLesson();
        setBackendLoading(false);
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to generate lesson."
        );
      }
    };

    void generateLesson();
    return () => {
      eventSource?.close();
    };
  }, [backendCourse, backendCourseId, backendNode, currentProject, isBackendLesson, nodeId]);

  const handleCancelGeneration = async () => {
    if (!backendJobId) {
      router.push(`/courses/${backendCourseId}`);
      return;
    }

    try {
      await apiFetch(`/jobs/${backendJobId}/cancel`, {
        method: "POST",
      });
    } catch {
      // Ignore cancel failure and still unwind local UI state.
    } finally {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("learn8_pending_lesson");
      }
      setBackendJobId(null);
      setBackendLoading(false);
      setBackendError("");
      router.push(`/courses/${backendCourseId}`);
    }
  };

  // Shuffle only on client to avoid hydration mismatch
  const [shuffledRight, setShuffledRight] = useState<string[]>(
    () => stage.pairs.map((p) => p.right) // initial: original order (matches SSR)
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (backendStage?.component === "MatchingPairs") {
      setShuffledRight(shuffle(stage.pairs.map((p) => p.right)));
    }
  }, [backendStage?.component, stage.pairs, stageIdx]);

  const allMatched = matched.length === stage.pairs.length;

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
        setFeedback("correct");
        setShowConfetti(true);
        arenaMarkCorrect();
        arenaTriggerConfetti();
      } else {
        setFeedback("incorrect");
        arenaMarkIncorrect();
        arenaTriggerShake();
      }
    },
    [arenaMarkCorrect, arenaMarkIncorrect, arenaTriggerConfetti, arenaTriggerShake, backendCourse]
  );

  /* Select a left word */
  const pickLeft = useCallback(
    (word: string) => {
      if (matched.includes(word) || feedback) return;
      setSelectedLeft(word);
      setWrongPair(null);
    },
    [matched, feedback]
  );

  /* Select a right word */
  const pickRight = useCallback(
    (word: string) => {
      if (feedback) return;
      if (!selectedLeft) return;
      // check if this right word is already matched
      const alreadyMatched = stage.pairs.find(
        (p) => p.right === word && matched.includes(p.left)
      );
      if (alreadyMatched) return;
      setSelectedRight(word);
    },
    [selectedLeft, matched, feedback, stage.pairs]
  );

  /* Check answer (called when CHECK button tapped) */
  const handleCheck = useCallback(() => {
    if (backendStage?.component === "MatchingPairs") {
      if (allMatched) {
        void submitBackendStage(backendStage, matchedPairs, true);
      }
      return;
    }

    if (!selectedLeft || !selectedRight) return;

    const pair = stage.pairs.find((p) => p.left === selectedLeft);
    if (pair && pair.right === selectedRight) {
      // Correct match
      setMatched((prev) => [...prev, selectedLeft]);
      setMatchedPairs((prev) => ({ ...prev, [selectedLeft]: selectedRight }));
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);
    } else {
      // Wrong match – show correct pair, auto‑match, mark incorrect, then advance
      const correctRight = pair?.right ?? "";
      setWrongPair([selectedLeft, selectedRight]);
      arenaMarkIncorrect();
      arenaTriggerShake();
      setTimeout(() => {
        // Auto-match the correct pair for the selected left
        setMatched((prev) => [...prev, selectedLeft!]);
        setMatchedPairs((prev) => ({ ...prev, [selectedLeft!]: correctRight }));
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  }, [allMatched, arenaMarkIncorrect, arenaTriggerShake, backendStage, matchedPairs, selectedLeft, selectedRight, stage.pairs, submitBackendStage]);

  /* Stage complete → feedback (only for match stages) */
  React.useEffect(() => {
    if (allMatched && !feedback) {
      const timer = setTimeout(() => {
        setFeedback("correct");
        setShowConfetti(true);
        arenaMarkCorrect();
        arenaTriggerConfetti();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [allMatched, feedback, arenaMarkCorrect, arenaTriggerConfetti]);

  /* Continue to next stage or result */
  const handleContinue = useCallback(() => {
    if (stageIdx < totalStages - 1) {
      setStageIdx((i) => i + 1);
      setMatched([]);
      setMatchedPairs({});
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);
      setFeedback(null);
      setShowConfetti(false);
      setHintUsed(false);
      setHintPair(null);
    } else {
      router.push(`/courses/${backendCourseId}/nodes/${nodeId}/result`);
    }
  }, [backendCourseId, nodeId, router, stageIdx, totalStages]);

  /* Hint */
  const handleHint = useCallback(() => {
    if (hintUsed || allMatched) return;
    // Spend gems (10 per hint)
    const canAfford = spendGems(10);
    if (!canAfford) return;
    arenaUseHint();
    const unmatched = stage.pairs.filter((p) => !matched.includes(p.left));
    if (unmatched.length > 0) {
      const pair = unmatched[0];
      setHintPair(pair.left);
      setSelectedLeft(pair.left);
      setSelectedRight(pair.right);
      setHintUsed(true);
      // auto-match after a short delay
      setTimeout(() => {
        setMatched((prev) => [...prev, pair.left]);
        setSelectedLeft(null);
        setSelectedRight(null);
        setHintPair(null);
      }, 1200);
    }
  }, [hintUsed, allMatched, stage.pairs, matched, spendGems, arenaUseHint]);

  /* ── AI Chat Assistant state ── */
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ id: number; role: "user" | "assistant"; text: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeInput = (el?: HTMLTextAreaElement | null) => {
    const ta = el ?? inputRef.current;
    if (!ta) return;
    ta.style.height = "40px";
    const max = 240;
    const newH = Math.min(Math.max(ta.scrollHeight, 40), max);
    ta.style.height = `${newH}px`;
    ta.style.overflow = newH >= max ? 'auto' : 'hidden';
  };

  useEffect(() => { resizeInput(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleChatSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const userMsg = { id: Date.now(), role: "user" as const, text: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    const aiOutput = `保護性構造(Protectivestructure)：Pericardium(心包膜)、Pericardialfluid(心包液)、Fibrouspericardium(纖維性心包膜)
 
肌肉構造(Muscularstructure)： Myocardium(心肌層)、Cardiacmusclefibers(心肌纖維)、Intercalateddiscs(閏盤)
 
選項詳細解釋
 
1.保護性構造(Protectivestructure)
 
這類構造的主要功能是固定心臟位置、減少摩擦並防止過度擴張。
 
Pericardium(心包膜)：包圍心臟的雙層囊狀結構。它像一個保護套，將心臟與周圍器官隔開。
Pericardialfluid(心包液)：存在於兩層心包膜之間的潤滑液。心臟跳動時，它能減少摩擦，保護心臟表面不被磨損。
Fibrouspericardium(纖維性心包膜)：這是心包膜最外層，由堅韌的結締組織組成。它的作用是防止心臟過度充血膨脹，並將心臟固定在胸腔中。
 
2.肌肉構造(Muscularstructure)
 
這類構造直接參與心臟的收縮與訊號傳導，是心臟跳動（幫浦功能）的核心。
 
Myocardium(心肌層)：這是心臟壁中最厚的一層，由心肌細胞組成。它是心臟收縮與舒張的主體。
Cardiacmusclefibers(心肌纖維)：指的就是組成心肌的細胞。它們具有自動律動性，能協同收縮。
Intercalateddiscs(閏盤)：這是心肌細胞特有的連接結構。它含有縫隙連接（Gapjunctions），能讓電訊號快速在細胞間傳導，確保心臟肌肉能同步收縮。`;

    (async () => {
      const assistantId = Date.now() + 2;
      const assistantMsg = { id: assistantId, role: "assistant" as const, text: "" };
      setChatMessages((prev) => [...prev, assistantMsg]);
      for (const ch of aiOutput) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 20));
        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + ch } : m)));
      }
    })();
  }, [chatInput]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }, [handleChatSend]);

  const handleMicDown = useCallback(() => {
    if (isRecording) return;
    setIsRecording(true);
    setChatInput("");
  }, [isRecording]);

  const handleMicUp = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    const micText = "麥克風測試";
    const userMsg = { id: Date.now(), role: "user" as const, text: micText };
    setChatMessages((prev) => [...prev, userMsg]);

    const aiOutput = `保護性構造(Protectivestructure)：Pericardium(心包膜)、Pericardialfluid(心包液)、Fibrouspericardium(纖維性心包膜)
 
肌肉構造(Muscularstructure)： Myocardium(心肌層)、Cardiacmusclefibers(心肌纖維)、Intercalateddiscs(閏盤)
 
選項詳細解釋
 
1.保護性構造(Protectivestructure)
 
這類構造的主要功能是固定心臟位置、減少摩擦並防止過度擴張。
 
Pericardium(心包膜)：包圍心臟的雙層囊狀結構。它像一個保護套，將心臟與周圍器官隔開。
Pericardialfluid(心包液)：存在於兩層心包膜之間的潤滑液。心臟跳動時，它能減少摩擦，保護心臟表面不被磨損。
Fibrouspericardium(纖維性心包膜)：這是心包膜最外層，由堅韌的結締組織組成。它的作用是防止心臟過度充血膨脹，並將心臟固定在胸腔中。
 
2.肌肉構造(Muscularstructure)
 
這類構造直接參與心臟的收縮與訊號傳導，是心臟跳動（幫浦功能）的核心。
 
Myocardium(心肌層)：這是心臟壁中最厚的一層，由心肌細胞組成。它是心臟收縮與舒張的主體。
Cardiacmusclefibers(心肌纖維)：指的就是組成心肌的細胞。它們具有自動律動性，能協同收縮。
Intercalateddiscs(閏盤)：這是心肌細胞特有的連接結構。它含有縫隙連接（Gapjunctions），能讓電訊號快速在細胞間傳導，確保心臟肌肉能同步收縮。`;

    (async () => {
      const assistantId = Date.now() + 2;
      const assistantMsg = { id: assistantId, role: "assistant" as const, text: "" };
      setChatMessages((prev) => [...prev, assistantMsg]);
      for (const ch of aiOutput) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 40));
        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + ch } : m)));
      }
    })();
  }, [isRecording]);

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
                      onClick={() => void handleCancelGeneration()}
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
              backendStage.component === "MultipleChoice" ? (
                <MultipleChoice
                  key={`backend-mcq-${stageIdx}`}
                  stageIndex={stageIdx}
                  totalStages={totalStages}
                  topic={backendStage.topic}
                  description={nodeDescription}
                  question={String((backendStage.config.data as { question?: string }).question || backendStage.topic)}
                  options={normalizeChoiceOptions(backendStage)}
                  correctId={getCorrectOptionId(backendStage)}
                  feedbackMsg={{
                    success: backendStage.feedback.success,
                    error: backendStage.feedback.error,
                    hint: "Eliminate the least likely options first.",
                  }}
                  onComplete={() =>
                    void submitBackendStage(
                      backendStage,
                      getCorrectOptionId(backendStage),
                      true
                    )
                  }
                  onError={() =>
                    void submitBackendStage(
                      backendStage,
                      "incorrect",
                      false
                    )
                  }
                  onWrongAdvance={() => handleContinue()}
                  onHintUse={() => {
                    const canAfford = spendGems(10);
                    if (canAfford) arenaUseHint();
                    return canAfford;
                  }}
                />
              ) : backendStage.component === "Ordering" ? (
                <BackendOrderingStage
                  key={`backend-order-${stageIdx}`}
                  stage={backendStage}
                  stageIndex={stageIdx}
                  totalStages={totalStages}
                  onSubmit={(input, isCorrect) =>
                    void submitBackendStage(backendStage, input, isCorrect)
                  }
                />
              ) : backendStage.component === "FeynmanMirror" ? (
                <BackendFeynmanStage
                  key={`backend-feynman-${stageIdx}`}
                  stage={backendStage}
                  stageIndex={stageIdx}
                  totalStages={totalStages}
                  onSubmit={(input) =>
                    void submitBackendStage(backendStage, input, false)
                  }
                  onHintUse={() => {
                    const canAfford = spendGems(10);
                    if (canAfford) arenaUseHint();
                    return canAfford;
                  }}
                />
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1 arena-scroll">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 mb-6 flex items-center gap-4"
                    >
                      <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] flex items-center justify-center shadow-md shadow-teal-300/30">
                        <span className="font-heading font-extrabold text-white text-base">
                          {stageIdx + 1}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-brand-teal uppercase tracking-wider mb-0.5">
                          Stage {stageIdx + 1} of {totalStages}
                        </p>
                        <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
                          {stage.question}
                        </h2>
                      </div>
                    </motion.div>

                    <div className="flex">
                      <MatchGrid
                        pairs={stage.pairs}
                        shuffledRight={shuffledRight}
                        matched={matched}
                        selectedLeft={selectedLeft}
                        selectedRight={selectedRight}
                        wrongPair={wrongPair}
                        hintPair={hintPair}
                        onPickLeft={pickLeft}
                        onPickRight={pickRight}
                      />
                    </div>
                  </div>

                  <div className="relative pt-4 pb-6 flex items-end justify-between flex-shrink-0">
                    <div className="flex items-end gap-2">
                      <OwlMascot />
                      <button
                        onClick={handleHint}
                        disabled={hintUsed || allMatched}
                        className={`mb-1 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                          hintUsed
                            ? "bg-brand-gray-100 text-brand-gray-400 border-brand-gray-200 cursor-not-allowed"
                            : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        💡 Hint
                        <span className="text-[10px] opacity-60">(10 💎)</span>
                      </button>
                    </div>

                    <GameButton
                      variant="primary"
                      onClick={handleCheck}
                      disabled={
                        (!selectedLeft || !selectedRight) && !allMatched
                      }
                      className="min-w-[140px]"
                    >
                      {allMatched ? "SUBMIT" : "CHECK"}
                    </GameButton>
                  </div>
                </>
              )
            ) : null}
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        <div className="w-[360px] flex-shrink-0 pt-2">
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, type: "spring", damping: 18 }}
            className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-teal-200/20 overflow-hidden flex flex-col w-full"
            style={{ height: "calc(100vh - 80px)" }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center gap-3">
              <div className="relative w-14 h-14 flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md">
                  <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
                    <ellipse cx="20" cy="24" rx="12" ry="10" fill="#C47F17" />
                    <circle cx="15" cy="20" r="5" fill="white" />
                    <circle cx="25" cy="20" r="5" fill="white" />
                    <circle cx="15" cy="20" r="2.5" fill="#2D2D2D" />
                    <circle cx="25" cy="20" r="2.5" fill="#2D2D2D" />
                    <circle cx="16" cy="19" r="1" fill="white" />
                    <circle cx="26" cy="19" r="1" fill="white" />
                    <polygon points="20,22 18,25 22,25" fill="#FF9500" />
                    <polygon points="10,16 8,8 15,14" fill="#C47F17" />
                    <polygon points="30,16 32,8 25,14" fill="#C47F17" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-heading font-bold text-[15px] text-brand-gray-700">AI Chat Assistant</h3>
                <p className="text-xs text-brand-gray-400 mt-0.5">Ask me anything about this stage!</p>
              </div>
            </div>

            {/* Chat messages area */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-teal/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-brand-gray-400 leading-relaxed max-w-[200px]">
                    Type a message to get help from your AI study companion!
                  </p>
                </div>
              )}

              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white rounded-br-md"
                        : "bg-white/70 border border-white/60 text-brand-gray-600 rounded-bl-md shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />

            {/* Input area */}
            <div className="px-5 py-3 flex items-center gap-2">
              <div className="flex-1 relative">
                {isRecording ? (
                  <div className="rounded-xl bg-white/70 border border-brand-teal/40 px-4 py-3 flex items-center justify-center gap-[6px] h-[40px] ring-2 ring-brand-teal/30">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-[3px] rounded-full bg-brand-teal"
                        animate={{
                          height: [4, 16 + Math.random() * 8, 6, 20, 4],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.08,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => { setChatInput(e.target.value); resizeInput(e.target); }}
                    onInput={(e) => resizeInput(e.currentTarget)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type your message..."
                    rows={1}
                    className="w-full resize-none rounded-xl bg-white/70 border border-white/60 px-4 py-[10px] text-[13px] leading-[18px] text-brand-gray-700 placeholder-brand-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal/40 h-10"
                    style={{ maxHeight: 240, overflow: 'hidden' }}
                  />
                )}
              </div>
              <motion.button
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onMouseLeave={handleMicUp}
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center select-none border border-white/60 shadow-md ${
                  isRecording ? "bg-red-500 text-white" : "bg-white/70 text-brand-teal hover:bg-brand-teal/10"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="12" rx="3" />
                  <path d="M19 10v1a7 7 0 01-14 0v-1" />
                  <line x1="12" y1="18" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </motion.button>
              <motion.button
                onClick={handleChatSend}
                whileTap={{ scale: 0.9 }}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white flex items-center justify-center shadow-md shadow-teal-300/30 hover:shadow-lg hover:shadow-teal-300/40 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Feedback overlay ─── */}
      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay
            type={feedback}
            onContinue={handleContinue}
            showConfetti={showConfetti}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Match Grid (with ref-based lines) ═══════════════════ */

function BackendOrderingStage({
  stage,
  stageIndex,
  totalStages,
  onSubmit,
}: {
  stage: LessonStage;
  stageIndex: number;
  totalStages: number;
  onSubmit: (input: string[], isCorrect: boolean) => void;
}) {
  const getLabel = (step: unknown) => {
    if (typeof step === "string") return step;
    if (step && typeof step === "object") {
      const item = step as { text?: string; label?: string; content?: string; id?: string };
      return item.text || item.label || item.content || item.id || "Step";
    }
    return String(step);
  };

  const initialItems = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    const seeded = Array.isArray(stage.config.initialState?.order)
      ? stage.config.initialState.order
      : [...rawSteps].sort(() => Math.random() - 0.5);

    return seeded.map((step, index) => ({
      id: `step-${index}`,
      content: getLabel(step),
    }));
  }, [stage]);

  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const correctOrder = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    return rawSteps.map(getLabel);
  }, [stage]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 arena-scroll">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 mb-6 flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] flex items-center justify-center shadow-md shadow-teal-300/30">
            <span className="font-heading font-extrabold text-white text-base">{stageIndex + 1}</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-brand-teal uppercase tracking-wider mb-0.5">
              Stage {stageIndex + 1} of {totalStages}
            </p>
            <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
              {stage.topic}
            </h2>
          </div>
        </motion.div>

        <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex flex-col gap-3">
          {items.map((item) => (
            <Reorder.Item key={item.id} value={item}>
              <div className="rounded-2xl border-2 border-b-4 border-brand-gray-200 bg-white px-5 py-4 font-heading font-bold text-brand-gray-700 shadow-sm">
                {item.content}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      <div className="relative pt-4 pb-6 flex items-end justify-end flex-shrink-0">
        <GameButton
          variant="primary"
          onClick={() => {
            const currentOrder = items.map((item) => item.content);
            onSubmit(
              currentOrder,
              JSON.stringify(currentOrder) === JSON.stringify(correctOrder)
            );
          }}
          className="min-w-[160px]"
        >
          CHECK ORDER
        </GameButton>
      </div>
    </div>
  );
}

function BackendFeynmanStage({
  stage,
  stageIndex,
  totalStages,
  onSubmit,
  onHintUse,
}: {
  stage: LessonStage;
  stageIndex: number;
  totalStages: number;
  onSubmit: (input: string) => void;
  onHintUse: () => boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [hintUsed, setHintUsed] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 arena-scroll">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 mb-6 flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-300/30">
            <span className="font-heading font-extrabold text-white text-base">{stageIndex + 1}</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-0.5">
              Stage {stageIndex + 1} of {totalStages}
            </p>
            <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
              {stage.topic}
            </h2>
          </div>
        </motion.div>

        <div className="rounded-2xl bg-white/80 border border-white/60 p-5 shadow-sm">
          <p className="text-sm font-semibold text-brand-gray-700 leading-relaxed">
            {String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
          </p>
          {hintUsed && (
            <p className="mt-3 text-sm text-amber-600">
              Hint: {stage.feedback.error}
            </p>
          )}
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Explain it in your own words..."
            rows={7}
            className="mt-4 w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
          />
        </div>
      </div>

      <div className="relative pt-4 pb-6 flex items-end justify-between flex-shrink-0">
        <button
          onClick={() => {
            if (hintUsed) return;
            const canAfford = onHintUse();
            if (canAfford) setHintUsed(true);
          }}
          disabled={hintUsed}
          className={`mb-1 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
            hintUsed
              ? "bg-brand-gray-100 text-brand-gray-400 border-brand-gray-200 cursor-not-allowed"
              : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
          }`}
        >
          💡 Hint <span className="text-[10px] opacity-60">(10 💎)</span>
        </button>
        <GameButton
          variant="primary"
          onClick={() => onSubmit(answer)}
          disabled={answer.trim().length < 5}
          className="min-w-[160px]"
        >
          SUBMIT
        </GameButton>
      </div>
    </div>
  );
}

function MatchGrid({
  pairs,
  shuffledRight,
  matched,
  selectedLeft,
  selectedRight,
  wrongPair,
  hintPair,
  onPickLeft,
  onPickRight,
}: {
  pairs: MatchPair[];
  shuffledRight: string[];
  matched: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  onPickLeft: (w: string) => void;
  onPickRight: (w: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rightRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean }[]
  >([]);

  /* Recalculate lines whenever selection / matches change */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const newLines: typeof lines = [];

    // Matched lines (green solid)
    for (const pair of pairs) {
      if (!matched.includes(pair.left)) continue;
      const lEl = leftRefs.current.get(pair.left);
      const rEl = rightRefs.current.get(pair.right);
      if (!lEl || !rEl) continue;
      const lb = lEl.getBoundingClientRect();
      const rb = rEl.getBoundingClientRect();
      newLines.push({
        x1: lb.right - box.left,
        y1: lb.top + lb.height / 2 - box.top,
        x2: rb.left - box.left,
        y2: rb.top + rb.height / 2 - box.top,
        color: "#58CC02",
      });
    }

    // Active selection line (teal dashed)
    if (selectedLeft && selectedRight) {
      const lEl = leftRefs.current.get(selectedLeft);
      const rEl = rightRefs.current.get(selectedRight);
      if (lEl && rEl) {
        const lb = lEl.getBoundingClientRect();
        const rb = rEl.getBoundingClientRect();
        newLines.push({
          x1: lb.right - box.left,
          y1: lb.top + lb.height / 2 - box.top,
          x2: rb.left - box.left,
          y2: rb.top + rb.height / 2 - box.top,
          color: "#7AC7C4",
          dash: true,
        });
      }
    }

    setLines(newLines);
  }, [matched, selectedLeft, selectedRight, pairs]);

  return (
    <div ref={containerRef} className="relative flex gap-12 w-full mx-auto">
      {/* SVG overlay for lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={l.dash ? "6 4" : "none"}
          />
        ))}
      </svg>

      {/* Left column */}
      <div className="flex-1 flex flex-col gap-5">
        {pairs.map((p) => {
          const isMatched = matched.includes(p.left);
          const isSelected = selectedLeft === p.left;
          const isWrong = wrongPair?.[0] === p.left;
          const isHint = hintPair === p.left;
          return (
            <motion.button
              key={p.left}
              ref={(el) => { if (el) leftRefs.current.set(p.left, el); }}
              onClick={() => onPickLeft(p.left)}
              className={`relative rounded-2xl px-8 py-6 text-center font-heading font-bold text-xl 
                border-2 border-b-4 transition-all ${
                isMatched
                  ? "bg-brand-green/10 border-brand-green text-brand-green"
                  : isWrong
                  ? "bg-red-50 border-red-400 text-red-500 animate-shake"
                  : isHint
                  ? "bg-amber-50 border-amber-400 text-amber-600"
                  : isSelected
                  ? "bg-brand-teal/10 border-brand-teal text-brand-teal shadow-md"
                  : "bg-white border-brand-gray-200 text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched ? {} : { scale: 0.95 }}
            >
              {p.left}
              {isMatched && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-brand-green rounded-full flex items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Right column */}
      <div className="flex-1 flex flex-col gap-5">
        {shuffledRight.map((word) => {
          const pairForWord = pairs.find((p) => p.right === word);
          const isMatched = pairForWord ? matched.includes(pairForWord.left) : false;
          const isSelected = selectedRight === word;
          const isWrong = wrongPair?.[1] === word;
          return (
            <motion.button
              key={word}
              ref={(el) => { if (el) rightRefs.current.set(word, el); }}
              onClick={() => onPickRight(word)}
              className={`relative rounded-2xl px-8 py-6 text-center font-heading font-bold text-xl 
                border-2 border-b-4 transition-all ${
                isMatched
                  ? "bg-brand-green/10 border-brand-green text-brand-green"
                  : isWrong
                  ? "bg-red-50 border-red-400 text-red-500 animate-shake"
                  : isSelected
                  ? "bg-brand-teal/10 border-brand-teal text-brand-teal shadow-md"
                  : "bg-white border-brand-gray-200 text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched ? {} : { scale: 0.95 }}
            >
              {word}
              {isMatched && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-brand-green rounded-full flex items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════ Feedback Overlay ═══════════════════ */

function FeedbackOverlay({
  type,
  onContinue,
  showConfetti,
}: {
  type: "correct" | "incorrect";
  onContinue: () => void;
  showConfetti: boolean;
}) {
  const isCorrect = type === "correct";

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50"
    >
      {/* Confetti layer */}
      {showConfetti && <ConfettiParticles />}

      {/* Panel */}
      <div
        className={`relative rounded-t-3xl px-6 pt-6 pb-8 shadow-2xl ${
          isCorrect
            ? "bg-gradient-to-br from-[#e8fce8] to-[#c9f5c9]"
            : "bg-gradient-to-br from-[#fde8e8] to-[#f5c9c9]"
        }`}
      >
        <div className="flex items-center gap-4 mb-5">
          {/* Icon */}
          <div
            className={`h-14 w-14 rounded-full flex items-center justify-center ${
              isCorrect ? "bg-brand-green" : "bg-brand-coral"
            }`}
          >
            {isCorrect ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </div>

          <div>
            <h3
              className={`font-heading font-extrabold text-2xl ${
                isCorrect ? "text-green-700" : "text-red-600"
              }`}
            >
              {isCorrect ? "Excellent!" : "Not quite right"}
            </h3>
            <p className={`text-sm ${isCorrect ? "text-green-600" : "text-red-500"}`}>
              {isCorrect
                ? "You matched all pairs correctly!"
                : "Review the pairs and try again."}
            </p>
          </div>
        </div>

        <GameButton
          variant={isCorrect ? "primary" : "secondary"}
          onClick={onContinue}
          className="w-full"
        >
          {isCorrect ? "CONTINUE" : "GOT IT"}
        </GameButton>
      </div>
    </motion.div>
  );
}

/* ═══════════════════ Confetti ═══════════════════ */

function ConfettiParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        color: ["#58CC02", "#FFD700", "#E8734A", "#7AC7C4", "#FF6BA8", "#4FC3F7"][
          i % 6
        ],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{
            y: "100vh",
            rotate: p.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
          className="absolute top-0"
          style={{
            width: p.size,
            height: p.size,
            borderRadius: p.size > 7 ? "2px" : "50%",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════ Owl Mascot ═══════════════════ */

function OwlMascot() {
  return (
    <svg viewBox="0 0 80 80" className="h-14 w-14 flex-shrink-0" fill="none">
      {/* Body */}
      <ellipse cx="40" cy="52" rx="22" ry="20" fill="#E8A855" />
      <ellipse cx="40" cy="54" rx="16" ry="14" fill="#F5DEB3" />
      {/* Eyes */}
      <circle cx="32" cy="40" r="9" fill="white" />
      <circle cx="48" cy="40" r="9" fill="white" />
      <circle cx="33" cy="40" r="5" fill="#2D2D2D" />
      <circle cx="47" cy="40" r="5" fill="#2D2D2D" />
      <circle cx="34.5" cy="38.5" r="1.8" fill="white" />
      <circle cx="48.5" cy="38.5" r="1.8" fill="white" />
      {/* Beak */}
      <polygon points="40,44 37,48 43,48" fill="#E8734A" />
      {/* Ear tufts */}
      <polygon points="22,30 26,38 18,36" fill="#D4943D" />
      <polygon points="58,30 54,38 62,36" fill="#D4943D" />
      {/* Feet */}
      <ellipse cx="33" cy="72" rx="5" ry="3" fill="#E8734A" />
      <ellipse cx="47" cy="72" rx="5" ry="3" fill="#E8734A" />
    </svg>
  );
}

/* ═══════════════════ Remedy Popup ═══════════════════ */

function RemedyPopup({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="bg-white rounded-3xl p-8 max-w-sm mx-4 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Remedy icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-5">
          <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none">
            {/* Book / study icon */}
            <rect x="8" y="10" width="32" height="28" rx="3" fill="#F59E0B" />
            <rect x="10" y="12" width="28" height="24" rx="2" fill="#FEF3C7" />
            <line x1="24" y1="12" x2="24" y2="36" stroke="#F59E0B" strokeWidth="1.5" />
            <line x1="15" y1="18" x2="22" y2="18" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="22" x2="21" y2="22" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="26" x2="20" y2="26" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="18" x2="33" y2="18" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="22" x2="32" y2="22" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="26" x2="31" y2="26" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
            {/* Star badge */}
            <circle cx="38" cy="10" r="8" fill="#EF4444" />
            <text x="38" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">!</text>
          </svg>
        </div>

        <h3 className="font-heading font-extrabold text-xl text-brand-gray-700 mb-2">
          Extra Practice Recommended!
        </h3>
        <p className="text-sm text-brand-gray-500 mb-1">
          Your accuracy for this unit is below 60%
        </p>
        <p className="text-sm text-brand-gray-400 mb-6">
          We've added a <span className="text-amber-600 font-bold">remedial level</span> on the map—complete it to reinforce the basics!
        </p>

        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-heading font-bold text-base shadow-md shadow-amber-300/30 hover:shadow-lg transition-all active:scale-95"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}
