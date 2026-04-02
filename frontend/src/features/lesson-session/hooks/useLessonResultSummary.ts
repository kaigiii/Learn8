"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { LessonSessionSummary } from "@/lib/apiTypes";

const SESSION_SUMMARY_CACHE_PREFIX = "learn8_lesson_summary:";

function readCachedSummary(sessionId: number) {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(
    `${SESSION_SUMMARY_CACHE_PREFIX}${sessionId}`
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LessonSessionSummary;
  } catch {
    window.sessionStorage.removeItem(`${SESSION_SUMMARY_CACHE_PREFIX}${sessionId}`);
    return null;
  }
}

export function cacheLessonSessionSummary(summary: LessonSessionSummary) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    `${SESSION_SUMMARY_CACHE_PREFIX}${summary.sessionId}`,
    JSON.stringify(summary)
  );
}

interface UseLessonResultSummaryParams {
  isReady: boolean;
  hasLessonSession: boolean;
  sessionId: number | null;
}

export function useLessonResultSummary({
  isReady,
  hasLessonSession,
  sessionId,
}: UseLessonResultSummaryParams) {
  const [backendSummary, setBackendSummary] =
    useState<LessonSessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResolved, setSummaryResolved] = useState(false);

  useEffect(() => {
    if (!isReady || hasLessonSession || !sessionId) {
      return;
    }

    const cachedSummary = readCachedSummary(sessionId);
    if (cachedSummary) {
      setBackendSummary(cachedSummary);
      setSummaryLoading(false);
      setSummaryResolved(true);
      return;
    }

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryResolved(false);

    const loadSummary = async () => {
      try {
        const summary = await apiFetch<LessonSessionSummary>(
          `/lessons/sessions/${sessionId}/summary`
        );
        if (!cancelled) {
          cacheLessonSessionSummary(summary);
          setBackendSummary(summary);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendSummary(null);
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
          setSummaryResolved(true);
        }
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [hasLessonSession, isReady, sessionId]);

  return {
    backendSummary,
    summaryLoading,
    summaryResolved,
  };
}
