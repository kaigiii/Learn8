"use client";

export function clampJobProgress(progress?: number | null) {
  return Math.round(Math.max(0, Math.min(progress ?? 0, 100)));
}

export function formatJobProgressLabel(progress?: number | null) {
  return `${clampJobProgress(progress)}% complete`;
}
