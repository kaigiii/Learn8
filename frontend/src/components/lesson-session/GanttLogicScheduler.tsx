"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { SubmissionResponse } from "@/lib/apiTypes";
import type { LessonStage } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { Calendar, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";

export interface GanttTask {
  id: string;
  label: string;
  defaultDuration: number;
}

export interface GanttLogicSchedulerProps extends QuestionStageMeta {
  stage: LessonStage;
  title: string;
  tasks: GanttTask[];
  timeLimit: number;
  dependencies?: string[];
  instruction?: string;
  onSubmit: (input: { completed: boolean; logicErrors: string[]; durationUsed: number }) => Promise<SubmissionResponse | void>;
  onContinue: () => void;
  onSkip: () => void;
}

export default function GanttLogicScheduler({
  stage,
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  title,
  tasks,
  timeLimit,
  dependencies = [],
  instruction = "請排定各項任務的起迄時間，以符合先後順序與工期限制。",
  onSubmit,
  onContinue,
  onSkip,
}: GanttLogicSchedulerProps) {
  const { t } = useI18n();

  // Task schedules state: taskId -> startDay (1-indexed, e.g., starts at Day 1)
  const [schedules, setSchedules] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    tasks.forEach((t) => {
      initial[t.id] = 1; // Default to start on Day 1
    });
    return initial;
  });

  const [phase, setPhase] = useState<"editing" | "submitting" | "feedback">("editing");
  const [result, setResult] = useState<SubmissionResponse["result"] | null>(null);
  const [message, setMessage] = useState("");
  const [logicErrors, setLogicErrors] = useState<string[]>([]);
  const [durationUsed, setDurationUsed] = useState(0);

  // Shift task start day left/right
  const handleShiftTask = (taskId: string, direction: "left" | "right") => {
    if (phase !== "editing") return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setSchedules((prev) => {
      const currentStart = prev[taskId];
      let nextStart = currentStart;

      if (direction === "left" && currentStart > 1) {
        nextStart = currentStart - 1;
      } else if (direction === "right" && currentStart + task.defaultDuration - 1 < timeLimit) {
        nextStart = currentStart + 1;
      }

      return {
        ...prev,
        [taskId]: nextStart,
      };
    });
  };

  const getTaskEnd = (taskId: string, start: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return start;
    return start + task.defaultDuration - 1;
  };

  const validateSchedule = (): { errors: string[]; maxEndDay: number } => {
    const errors: string[] = [];
    let maxEndDay = 0;

    // Check bounds
    tasks.forEach((task) => {
      const start = schedules[task.id];
      const end = getTaskEnd(task.id, start);
      if (end > maxEndDay) {
        maxEndDay = end;
      }
      if (end > timeLimit) {
        errors.push(`任務 「${task.label}」 的結束時間排在第 ${end} 天，超出了總工期 ${timeLimit} 天的限制！`);
      }
    });

    // Check dependencies (format e.g. "taskA -> taskB")
    dependencies.forEach((dep) => {
      const parts = dep.split("->").map((p) => p.trim());
      if (parts.length === 2) {
        const [preId, postId] = parts;
        const preTask = tasks.find((t) => t.id === preId);
        const postTask = tasks.find((t) => t.id === postId);

        if (preTask && postTask) {
          const preStart = schedules[preId];
          const preEnd = getTaskEnd(preId, preStart);
          const postStart = schedules[postId];

          if (preEnd >= postStart) {
            errors.push(`排程邏輯錯誤：任務「${postTask.label}」必須在「${preTask.label}」完成（第 ${preEnd} 天）後才能開始！`);
          }
        }
      }
    });

    return { errors, maxEndDay };
  };

  const handleCheck = async () => {
    if (phase !== "editing") return;
    setPhase("submitting");

    const { errors, maxEndDay } = validateSchedule();
    const isCorrect = errors.length === 0;

    const response = await onSubmit({
      completed: true,
      logicErrors: errors,
      durationUsed: maxEndDay,
    });

    setResult(isCorrect ? "correct" : "incorrect");
    setLogicErrors(errors);
    setDurationUsed(maxEndDay);
    setMessage(
      isCorrect
        ? `排程正確！總工期為 ${maxEndDay} 天，完全符合依賴順序與工期限制。`
        : "排程檢核失敗，請調整衝突的任務時間。"
    );
    setPhase("feedback");
  };

  const handleReset = () => {
    const initial: Record<string, number> = {};
    tasks.forEach((t) => {
      initial[t.id] = 1;
    });
    setSchedules(initial);
    setPhase("editing");
    setResult(null);
    setMessage("");
    setLogicErrors([]);
    setDurationUsed(0);
  };

  const timelineDays = Array.from({ length: timeLimit }, (_, i) => i + 1);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={topic}
          difficulty={difficulty}
          recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
          rightSlot={<QuestionVoiceReader text={topic} />}
        />

        {/* Task Scenario Instruction Card */}
        <div className="mb-4 bg-slate-900/5 px-4 py-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
          <Info className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{instruction}</p>
            {dependencies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mr-1">相依關係限制:</span>
                {dependencies.map((dep, idx) => {
                  const parts = dep.split("->").map((p) => p.trim());
                  const preTask = tasks.find((t) => t.id === parts[0]);
                  const postTask = tasks.find((t) => t.id === parts[1]);
                  return (
                    <span key={idx} className="text-[9px] font-bold bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300 text-slate-600">
                      {preTask?.label} ➔ {postTask?.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Gantt Interactive Table */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm mb-6 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Timeline Header Row */}
            <div className="grid grid-cols-12 gap-2 pb-3 border-b border-slate-100 text-center font-mono">
              <div className="col-span-4 text-left font-sans text-xs font-black text-slate-400 uppercase tracking-widest pl-2">
                任務名稱與控制
              </div>
              <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${timeLimit}, 1fr)` }}>
                {timelineDays.map((day) => (
                  <div key={day} className="text-[10px] font-bold text-slate-400">
                    D{day}
                  </div>
                ))}
              </div>
            </div>

            {/* Task rows */}
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const start = schedules[task.id];
                const end = getTaskEnd(task.id, start);
                const isEditing = phase === "editing";

                return (
                  <div key={task.id} className="grid grid-cols-12 gap-2 py-4 items-center">
                    {/* Left Column: Label & Shift buttons */}
                    <div className="col-span-4 flex items-center justify-between pr-4">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-700 truncate">{task.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">工期: {task.defaultDuration} 天</span>
                      </div>
                      {isEditing && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleShiftTask(task.id, "left")}
                            disabled={start === 1}
                            className="p-1 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleShiftTask(task.id, "right")}
                            disabled={end === timeLimit}
                            className="p-1 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Dynamic Scheduler Bar */}
                    <div
                      className="col-span-8 grid h-8 bg-slate-50 rounded-lg relative overflow-hidden"
                      style={{ gridTemplateColumns: `repeat(${timeLimit}, 1fr)` }}
                    >
                      <motion.div
                        layout
                        style={{
                          gridColumnStart: start,
                          gridColumnEnd: end + 1,
                        }}
                        className="h-full bg-brand-teal/20 border border-brand-teal/40 rounded-lg flex items-center justify-center text-[10px] font-bold text-brand-teal shadow-inner"
                      >
                        D{start} - D{end}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {phase === "feedback" && (
          <div
            className={`rounded-[2rem] p-5 flex items-start gap-3 border ${
              result === "correct"
                ? "bg-brand-green/5 border-brand-green/20 text-brand-green"
                : "bg-red-50 border-red-200 text-red-500"
            }`}
          >
            {result === "correct" ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-green" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{message}</p>
              {result === "incorrect" && (
                <div className="mt-3">
                  <ul className="text-xs space-y-1 list-disc list-inside mb-4 font-semibold">
                    {logicErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <GameButton variant="primary" onClick={handleReset} className="h-10 text-xs px-4">
                    重新排程
                  </GameButton>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <QuestionActionBar
        onSkip={onSkip}
        onContinue={
          phase === "feedback" && result === "correct"
            ? onContinue
            : phase === "editing"
            ? handleCheck
            : undefined
        }
        continueLabel={
          phase === "feedback" && result === "correct"
            ? t("lesson.action.continue")
            : "檢查排程"
        }
        isContinueDisabled={phase === "submitting"}
      />
    </div>
  );
}
