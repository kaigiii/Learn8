"use client";

import Link from "next/link";
import GameButton from "@/components/ui/GameButton";
import { getJobCancelLabel, getJobCtaLabel, getJobRetryLabel } from "@/lib/jobs/policy";
import { clampJobProgress, formatJobProgressLabel } from "@/lib/jobs/presentation";
import type { ActiveJobResumeState } from "@/lib/jobs/recovery";

interface HomeActiveJobBannerProps {
  activeJob: ActiveJobResumeState;
  onCancel: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
}

export function HomeActiveJobBanner({
  activeJob,
  onCancel,
  onRetry,
}: HomeActiveJobBannerProps) {
  const progress = clampJobProgress(activeJob.progress);

  return (
    <div className="rounded-[28px] border border-white/60 bg-white/70 px-5 py-4 shadow-[0_12px_30px_rgba(122,199,196,0.10)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
            Resume Generation
          </p>
          <h2 className="font-heading text-xl font-extrabold text-brand-gray-700">
            {activeJob.title}
          </h2>
          <p className="mt-1 text-sm text-brand-gray-500">{activeJob.description}</p>
          <div className="mt-4 max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-xs">
              <span className="truncate text-brand-gray-500">
                {activeJob.message || "Waiting for server updates..."}
              </span>
              <span className="shrink-0 font-semibold uppercase tracking-[0.18em] text-brand-teal/80">
                {formatJobProgressLabel(progress)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          {activeJob.retryable && onRetry && (
            <button
              type="button"
              onClick={() => void onRetry()}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              {getJobRetryLabel()}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onCancel()}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
          >
            {getJobCancelLabel()}
          </button>
          <Link href={activeJob.resumeHref}>
            <GameButton className="min-w-[220px]">
              {getJobCtaLabel(activeJob.status)}
            </GameButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
