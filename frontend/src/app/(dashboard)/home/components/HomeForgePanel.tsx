"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { JOB_STATUS } from "@/lib/domain/statuses";
import { getJobCancelLabel, getJobCtaLabel, getJobRetryLabel } from "@/lib/jobs/policy";
import { clampJobProgress, formatJobProgressLabel } from "@/lib/jobs/presentation";
import type { ActiveJobResumeState } from "@/lib/jobs/recovery";

interface HomeForgePanelProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isDragging: boolean;
  isForging: boolean;
  isSubmittingTopic: boolean;
  removingFile: string | null;
  fileActionMessage: string;
  courseFiles: string[];
  topic: string;
  setIsDragging: (value: boolean) => void;
  setTopic: (value: string) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
  onTopicSubmit: () => void | Promise<void>;
  onRemoveCourseFile: (filename: string) => void | Promise<void>;
  activeJob?: ActiveJobResumeState | null;
  onCancelActiveJob?: () => void | Promise<void>;
  onRetryActiveJob?: () => void | Promise<void>;
}

export function HomeForgePanel({
  fileInputRef,
  isDragging,
  isForging,
  isSubmittingTopic,
  removingFile,
  fileActionMessage,
  courseFiles,
  topic,
  setIsDragging,
  setTopic,
  onFileChange,
  onDrop,
  onTopicSubmit,
  onRemoveCourseFile,
  activeJob,
  onCancelActiveJob,
  onRetryActiveJob,
}: HomeForgePanelProps) {
  const progress = clampJobProgress(activeJob?.progress);
  const showResumeCta = activeJob?.status !== JOB_STATUS.STALE;
  const [allowGenerationCard, setAllowGenerationCard] = useState(false);
  const [hideUploadedFiles, setHideUploadedFiles] = useState(false);

  useEffect(() => {
    if (!activeJob) {
      setAllowGenerationCard(false);
    }
  }, [activeJob]);

  useEffect(() => {
    if (courseFiles.length > 0 && !isSubmittingTopic) {
      setHideUploadedFiles(false);
    }
  }, [courseFiles, isSubmittingTopic]);

  const handleTopicSubmit = () => {
    if (!topic.trim() || isSubmittingTopic || isForging) {
      return;
    }
    setAllowGenerationCard(true);
    setHideUploadedFiles(true);
    setTopic("");
    void Promise.resolve(onTopicSubmit()).finally(() => {
      // Keep input empty after submit; file list stays hidden until a new file is uploaded.
    });
  };

  const visibleCourseFiles = hideUploadedFiles ? [] : courseFiles;

  return (
    <DeepGlassCard className="relative h-full min-h-[400px] px-7 py-7 md:px-8 md:py-8">
      <div className="flex h-full flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={onFileChange}
        />

        {activeJob && allowGenerationCard ? (
          <div className="flex min-h-[340px] flex-1 flex-col rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-5 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                Resume Generation
              </p>
              <h3 className="font-heading text-[40px] font-extrabold leading-tight text-brand-gray-700 md:text-[44px]">
                {activeJob.title}
              </h3>
              <p className="mt-3 text-sm text-brand-gray-500">{activeJob.description}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void onCancelActiveJob?.()}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-base font-semibold text-rose-600 transition hover:bg-rose-100"
              >
                {getJobCancelLabel()}
              </button>
              {showResumeCta ? (
                <Link href={activeJob.resumeHref}>
                  <GameButton className="w-full min-w-0 py-4 text-lg">
                    {getJobCtaLabel(activeJob.status)}
                  </GameButton>
                </Link>
              ) : activeJob.retryable && onRetryActiveJob ? (
                <button
                  type="button"
                  onClick={() => void onRetryActiveJob()}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-base font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  {getJobRetryLabel()}
                </button>
              ) : (
                <div />
              )}
            </div>

            <div className="mt-auto pt-6">
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
        ) : (
          <>
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              className={`relative flex min-h-[225px] flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed backdrop-blur-sm transition-all duration-200 ${
                isDragging
                  ? "border-brand-teal/80 bg-white/60 shadow-lg shadow-brand-teal/10"
                  : "border-brand-teal/40 bg-white/40 hover:border-brand-teal/70 hover:bg-white/50"
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isForging ? "uploading" : "idle"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  {isForging ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      >
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <circle cx="20" cy="20" r="18" stroke="#7AC7C4" strokeWidth="3" strokeDasharray="80 30" />
                        </svg>
                      </motion.div>
                      <p className="text-sm font-semibold text-brand-teal">Uploading your PDF…</p>
                    </>
                  ) : (
                    <>
                      <motion.div animate={isDragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}>
                        <PortalIcon />
                      </motion.div>
                      {visibleCourseFiles.length > 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4">
                          {visibleCourseFiles.map((file) => (
                            <div
                              key={file}
                              className="flex max-w-xs items-center justify-center gap-2"
                            >
                              <p className="text-center text-sm text-brand-gray-500 md:text-base">
                                {removingFile === file ? "Removing..." : file}
                              </p>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onRemoveCourseFile(file);
                                }}
                                disabled={removingFile === file}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-gray-200 bg-white/70 text-sm font-bold text-brand-gray-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove ${file}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="max-w-sm px-4 text-center text-base text-brand-gray-500">
                          {isDragging
                            ? "Release to upload your PDF"
                            : "Drop a PDF here or click this card to start a new course, then define your topic below."}
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <div className="mt-5 space-y-3 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-5 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleTopicSubmit();
                      }
                    }}
                    placeholder="Enter the topic you want to learn"
                    className="w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3.5 text-base text-brand-gray-700 outline-none focus:border-brand-teal"
                  />
                </div>
                <div className="md:w-auto md:shrink-0">
                  <GameButton
                    variant="secondary"
                    onClick={handleTopicSubmit}
                    disabled={!topic.trim() || isSubmittingTopic || isForging}
                    className="w-full min-w-[170px] text-lg md:min-w-[200px]"
                  >
                    {isSubmittingTopic ? "Generating..." : "Generate"}
                  </GameButton>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DeepGlassCard>
  );
}

function PortalIcon() {
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" fill="none">
      <circle cx="60" cy="60" r="50" fill="#7AC7C4" opacity="0.08" />
      <circle cx="60" cy="60" r="42" fill="#7AC7C4" opacity="0.12" />
      <circle cx="60" cy="60" r="35" fill="none" stroke="#7AC7C4" strokeWidth="3" opacity="0.4" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="#D4BC8B" strokeWidth="2" opacity="0.5" />
      <circle cx="60" cy="60" r="24" fill="#E8F5F4" />
      <circle cx="60" cy="60" r="18" fill="#7AC7C4" opacity="0.15" />
      <text x="60" y="30" textAnchor="middle" fontSize="8" fill="#C4A87A" opacity="0.6">
        ᚠᚢᚦ
      </text>
      <text x="60" y="95" textAnchor="middle" fontSize="8" fill="#C4A87A" opacity="0.6">
        ᛉᛊᛏ
      </text>
      <circle cx="60" cy="60" r="10" fill="#7AC7C4" opacity="0.3" />
      <path d="M55 55h10v10H55z" fill="none" stroke="#5BB5B0" strokeWidth="1.5" rx="2" />
      <circle cx="60" cy="60" r="3" fill="#5BB5B0" opacity="0.6" />
      <circle cx="40" cy="45" r="2" fill="#D4A96A" opacity="0.4" />
      <circle cx="80" cy="75" r="1.5" fill="#D4A96A" opacity="0.5" />
      <circle cx="78" cy="42" r="1" fill="#7AC7C4" opacity="0.5" />
    </svg>
  );
}
