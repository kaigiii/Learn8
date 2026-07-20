"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { SubmissionResponse } from "@/lib/apiTypes";
import type { LessonStage } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { 
  ShieldAlert, 
  CheckCircle, 
  Search, 
  HelpCircle, 
  AlertCircle, 
  FileText, 
  X, 
  ChevronRight 
} from "lucide-react";

export interface Anomaly {
  anomalyId: string;
  reason: string;
  points: number;
}

export interface DocumentAnomalyDebuggerProps extends QuestionStageMeta {
  stage: LessonStage;
  title: string;
  documentHtml: string;
  anomalies: Anomaly[];
  checklistOptions?: string[];
  instruction?: string;
  onSubmit: (input: { completed: boolean; foundCount: number; wrongClicks: number }) => Promise<SubmissionResponse | void>;
  onContinue: () => void;
  onSkip: () => void;
}

export default function DocumentAnomalyDebugger({
  stage,
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  title,
  documentHtml,
  anomalies,
  checklistOptions = [],
  instruction = "請在左側報告中點擊找出所有異常數據，並在右側勾選其對應的缺失原因。",
  onSubmit,
  onContinue,
  onSkip,
}: DocumentAnomalyDebuggerProps) {
  const { t } = useI18n();

  // Selected findings state: anomalyId -> matchedReason
  const [findings, setFindings] = useState<Record<string, string>>({});
  const [activeAnomalyId, setActiveAnomalyId] = useState<string | null>(null);
  const [wrongClicks, setWrongClicks] = useState(0);

  const [phase, setPhase] = useState<"editing" | "submitting" | "feedback">("editing");
  const [result, setResult] = useState<SubmissionResponse["result"] | null>(null);
  const [message, setMessage] = useState("");
  const [foundCount, setFoundCount] = useState(0);

  // Click handler on the document container
  const handleDocumentClick = (e: React.MouseEvent) => {
    if (phase !== "editing") return;

    const target = e.target as HTMLElement;
    const cell = target.closest("[data-anomaly-id]");

    if (cell) {
      const anomalyId = cell.getAttribute("data-anomaly-id");
      if (anomalyId) {
        // Verify if it is actually in the anomalies list
        const isActualAnomaly = anomalies.some((a) => a.anomalyId === anomalyId);
        if (isActualAnomaly) {
          setActiveAnomalyId(anomalyId);
        } else {
          // Increment wrong clicks if they clicked something that is not an anomaly
          setWrongClicks((prev) => prev + 1);
        }
      }
    }
  };

  const handleMatchReason = (reason: string) => {
    if (phase !== "editing" || !activeAnomalyId) return;

    setFindings((prev) => ({
      ...prev,
      [activeAnomalyId]: reason,
    }));
    setActiveAnomalyId(null);
  };

  const handleRemoveFinding = (anomalyId: string) => {
    if (phase !== "editing") return;
    setFindings((prev) => {
      const next = { ...prev };
      delete next[anomalyId];
      return next;
    });
    if (activeAnomalyId === anomalyId) {
      setActiveAnomalyId(null);
    }
  };

  const handleCheck = async () => {
    if (phase !== "editing") return;
    setPhase("submitting");

    let correctCount = 0;
    anomalies.forEach((a) => {
      if (findings[a.anomalyId] === a.reason) {
        correctCount++;
      }
    });

    const isAllFound = correctCount === anomalies.length;
    const response = await onSubmit({
      completed: true,
      foundCount: correctCount,
      wrongClicks,
    });

    setResult(isAllFound ? "correct" : "incorrect");
    setFoundCount(correctCount);
    setMessage(
      isAllFound
        ? `審核通過！你成功找出了全部 ${anomalies.length} 處異常並給出合理解釋。`
        : `審核未通過！你找出了 ${correctCount}/${anomalies.length} 處正確異常，部分成因解釋有誤或漏掉。`
    );
    setPhase("feedback");
  };
  // Generate dynamic styles for highlighted cells
  const dynamicStyles = `
    /* Interactive Anomaly Targets (Default State) */
    [data-anomaly-id] {
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
      border-radius: 6px;
      border-bottom: 2px dashed #38bdf8 !important; /* sky-400 */
      background-color: #f0f9ff !important; /* sky-50 */
      color: #0369a1 !important; /* sky-700 */
      font-weight: 600;
      padding: 2px 4px;
    }
    [data-anomaly-id]:hover {
      background-color: #e0f2fe !important; /* sky-100 */
      border-bottom-color: #0284c7 !important; /* sky-600 */
    }
    
    /* Table Layout Styling */
    .prose table, table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 1.25rem;
      margin-bottom: 1.25rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
    }
    
    .prose th, th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      padding: 14px 18px;
      border-bottom: 1.5px solid #e2e8f0;
      text-align: left;
    }
    
    .prose td, td {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 500;
      vertical-align: middle;
      transition: background-color 0.15s ease;
    }
    
    .prose tr:last-child td, tr:last-child td {
      border-bottom: none;
    }
    
    .prose tr:hover td, tr:hover td {
      background-color: #f8fafc;
    }
    
    .prose h3 {
      font-size: 0.95rem;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 0.75rem;
      border-left: 3.5px solid #0d9488;
      padding-left: 8px;
    }
    
    ${Object.keys(findings)
      .map(
        (id) => `
      [data-anomaly-id="${id}"] {
        outline: 2px solid ${
          phase === "feedback"
            ? findings[id] === anomalies.find((a) => a.anomalyId === id)?.reason
              ? "#10b981"
              : "#ef4444"
            : "#3b82f6"
        } !important;
        background-color: ${
          phase === "feedback"
            ? findings[id] === anomalies.find((a) => a.anomalyId === id)?.reason
              ? "rgba(16, 185, 129, 0.08)"
              : "rgba(239, 68, 68, 0.08)"
            : "rgba(59, 130, 246, 0.08)"
        } !important;
        border-bottom-color: transparent !important;
        color: ${
          phase === "feedback"
            ? findings[id] === anomalies.find((a) => a.anomalyId === id)?.reason
              ? "#10b981"
              : "#ef4444"
            : "#3b82f6"
        } !important;
        outline-offset: -2px;
      }
    `
      )
      .join("")}
    ${
      activeAnomalyId
        ? `
      [data-anomaly-id="${activeAnomalyId}"] {
        outline: 2px solid #0d9488 !important;
        background-color: rgba(13, 148, 136, 0.1) !important;
        border-bottom-color: transparent !important;
        outline-offset: -2px;
      }
    `
        : ""
    }
  `;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <style>{dynamicStyles}</style>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 lesson-session-scroll pb-6">
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

        {/* Audit Instructions Banner */}
        <div className="mb-5 bg-gradient-to-r from-slate-50 to-slate-100/50 px-5 py-4 rounded-2xl border border-slate-200/80 flex items-start gap-3 shadow-sm">
          <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
            <Search className="w-5 h-5 text-brand-teal" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{instruction}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          {/* Left panel: HTML document report */}
          <div
            className="lg:col-span-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-md shadow-slate-100/70 border-t-[6px] border-t-brand-teal/80 select-none flex flex-col"
            onClick={handleDocumentClick}
          >
            {/* Paper Header Letterhead */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-teal" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Official Document Audit
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-300">REF-2026-PDCA</span>
            </div>

            <div
              className="prose prose-slate max-w-none text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: documentHtml }}
            />
          </div>

          {/* Right panel: Inspection & matching */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Inspector box */}
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50/60 backdrop-blur-sm p-6 shadow-sm flex-1 flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                      稽核診斷面板
                    </span>
                  </div>
                  {phase === "editing" && Object.keys(findings).length > 0 && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-teal opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-teal"></span>
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {activeAnomalyId ? (
                    <motion.div
                      key="reason-select"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-brand-teal" />
                        <p className="text-xs font-bold text-brand-teal">
                          [偵測到異常: {activeAnomalyId}] 請選擇異常原因:
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 lesson-session-scroll">
                        {checklistOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleMatchReason(opt)}
                            className="w-full text-left text-xs bg-white border border-slate-200 hover:border-brand-teal hover:bg-brand-teal/5 hover:text-brand-teal font-semibold p-3 rounded-xl transition-all shadow-sm flex items-center justify-between group"
                          >
                            <span className="truncate pr-2">{opt}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-teal group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="finding-list" className="space-y-3">
                      {Object.keys(findings).length === 0 ? (
                        <div className="py-8 px-4 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white/40">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <Search className="w-5 h-5 text-slate-400 animate-pulse" />
                          </div>
                          <p className="text-xs font-bold text-slate-600">偵測雷達已啟動</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                            請點擊左側文件中可疑的數據或規劃點以進行稽核分析。
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-slate-500">
                            已登錄 {Object.keys(findings).length} 個異常項目:
                          </p>
                          <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1 lesson-session-scroll">
                            {Object.entries(findings).map(([id, reason]) => {
                              const correctReason = anomalies.find((a) => a.anomalyId === id)?.reason;
                              const isCorrect = reason === correctReason;
                              
                              let cardClass = "border-slate-200 bg-white";
                              let icon = <Search className="w-3.5 h-3.5 text-slate-400 mt-0.5" />;
                              
                              if (phase === "feedback") {
                                if (isCorrect) {
                                  cardClass = "border-green-200 bg-green-50/50";
                                  icon = <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5" />;
                                } else {
                                  cardClass = "border-red-200 bg-red-50/50";
                                  icon = <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />;
                                }
                              } else {
                                cardClass = "border-blue-100 bg-blue-50/20 hover:border-blue-200";
                                icon = <Search className="w-3.5 h-3.5 text-blue-500 mt-0.5" />;
                              }

                              return (
                                <motion.div
                                  layout
                                  key={id}
                                  className={`border p-3 rounded-xl flex items-start justify-between gap-3 shadow-sm transition-all ${cardClass}`}
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="p-1 rounded-lg bg-white/80 border border-slate-100 flex-shrink-0 shadow-sm mt-0.5">
                                      {icon}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-slate-400 font-mono tracking-wider uppercase">
                                        標記: {id}
                                      </p>
                                      <p className="text-xs font-bold text-slate-700 mt-0.5 leading-snug">
                                        {reason}
                                      </p>
                                      {phase === "feedback" && !isCorrect && (
                                        <p className="text-[10px] text-red-400 mt-1 font-medium">
                                          正確成因: {correctReason}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {phase === "editing" && (
                                    <button
                                      onClick={() => handleRemoveFinding(id)}
                                      className="text-slate-400 hover:text-red-500 p-1 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 mt-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {wrongClicks > 0 && phase === "editing" && (
                <div className="mt-4 flex items-center gap-1 text-[10px] text-slate-400 italic">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>誤觸非異常區域次數: {wrongClicks} 次</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        <AnimatePresence>
          {phase === "feedback" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className={`rounded-[2rem] p-6 flex items-start gap-4 border shadow-sm ${
                result === "correct"
                  ? "bg-green-50/50 border-green-200 text-green-700"
                  : "bg-red-50/50 border-red-200 text-red-700"
              }`}
            >
              <div className={`p-2 rounded-xl border flex-shrink-0 ${
                result === "correct" ? "bg-white border-green-100" : "bg-white border-red-100"
              }`}>
                {result === "correct" ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-extrabold leading-snug">
                  {result === "correct" ? "審核判定：成功！" : "審核判定：未通過"}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <QuestionActionBar
        onSkip={onSkip}
        onContinue={
          phase === "feedback"
            ? onContinue
            : phase === "editing" && Object.keys(findings).length > 0
            ? handleCheck
            : undefined
        }
        continueLabel={
          phase === "feedback"
            ? t("lesson.action.continue")
            : "提交稽核"
        }
        isContinueDisabled={
          phase === "submitting" || (phase === "editing" && Object.keys(findings).length === 0)
        }
      />
    </div>
  );
}

