"use client";

import type React from "react";
import { AnimatePresence, motion } from "framer-motion";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";

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
}: HomeForgePanelProps) {
  return (
    <DeepGlassCard className="relative h-full min-h-[360px] px-6 py-6 md:px-7 md:py-7">
      <div className="flex h-full flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={onFileChange}
        />

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
          className={`relative flex min-h-[200px] flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed backdrop-blur-sm transition-all duration-200 ${
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
                  <p className="max-w-xs px-4 text-center text-sm text-brand-gray-500 md:text-base">
                    {isDragging
                      ? "Release to upload your PDF"
                      : "Drop a PDF here or click this card to start a new course, then define your topic below."}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="mt-4 space-y-3 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
          <div className="rounded-2xl border border-[#9ecbd4]/18 bg-white/62 px-4 py-3">
            <p className="mb-3 text-sm font-semibold text-brand-gray-700">
              Course Materials
            </p>

            {fileActionMessage && (
              <p className="mb-3 text-xs font-semibold text-brand-teal">{fileActionMessage}</p>
            )}

            {courseFiles.length > 0 ? (
              <div className="space-y-2">
                {courseFiles.map((file) => (
                  <div
                    key={file}
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-gray-200 bg-white/80 px-3 py-2 text-sm text-brand-gray-600"
                  >
                    <span className="truncate">{file}</span>
                    <button
                      type="button"
                      onClick={() => void onRemoveCourseFile(file)}
                      disabled={removingFile === file}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-gray-500 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                      aria-label={`Remove ${file}`}
                    >
                      {removingFile === file ? "…" : "×"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-gray-400">No materials added yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void onTopicSubmit();
                  }
                }}
                placeholder="Enter the topic you want to learn"
                className="w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
              />
            </div>
            <div className="md:w-auto md:shrink-0">
              <GameButton
                onClick={() => void onTopicSubmit()}
                disabled={!topic.trim() || isSubmittingTopic || isForging}
                className="w-full min-w-[160px] md:min-w-[180px]"
              >
                {isSubmittingTopic ? "Generating..." : "Generate"}
              </GameButton>
            </div>
          </div>
        </div>
      </div>
    </DeepGlassCard>
  );
}

function PortalIcon() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
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
