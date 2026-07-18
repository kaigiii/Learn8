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
import { ShieldAlert, CheckCircle, Search, HelpCircle, AlertCircle } from "lucide-react";

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

  const handleReset = () => {
    setFindings({});
    setActiveAnomalyId(null);
    setWrongClicks(0);
    setPhase("editing");
    setResult(null);
    setMessage("");
    setFoundCount(0);
  };

  // Generate dynamic styles for highlighted cells
  const dynamicStyles = `
    [data-anomaly-id] {
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    [data-anomaly-id]:hover {
      background-color: rgba(234, 179, 8, 0.1) !important;
      outline: 2px dashed rgba(234, 179, 8, 0.5) !important;
      outline-offset: -2px;
    }
    ${Object.keys(findings)
      .map(
        (id) => `
      [data-anomaly-id="${id}"] {
        outline: 2px solid ${
          phase === "feedback" && findings[id] === anomalies.find((a) => a.anomalyId === id)?.reason
            ? "#58CC02"
            : "#ef4444"
        } !important;
        background-color: ${
          phase === "feedback" && findings[id] === anomalies.find((a) => a.anomalyId === id)?.reason
            ? "rgba(88, 204, 2, 0.1)"
            : "rgba(239, 68, 68, 0.1)"
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
        outline: 2px solid #7AC7C4 !important;
        background-color: rgba(122, 199, 196, 0.15) !important;
        outline-offset: -2px;
      }
    `
        : ""
    }
  `;

  const activeAnomaly = anomalies.find((a) => a.anomalyId === activeAnomalyId);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <style>{dynamicStyles}</style>
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

        {/* Audit Instructions */}
        <div className="mb-4 bg-slate-900/5 px-4 py-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
          <Search className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{instruction}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          {/* Left panel: HTML document report */}
          <div
            className="lg:col-span-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto select-none"
            onClick={handleDocumentClick}
          >
            <div
              className="prose prose-slate max-w-none text-xs"
              dangerouslySetInnerHTML={{ __html: documentHtml }}
            />
          </div>

          {/* Right panel: Inspection & matching */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Inspector box */}
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-sm flex-1 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    稽核診斷面板
                  </span>
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
                      <p className="text-xs font-bold text-brand-teal">
                        [偵測到異常: {activeAnomalyId}] 請選擇異常原因:
                      </p>
                      <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 lesson-session-scroll">
                        {checklistOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleMatchReason(opt)}
                            className="w-full text-left text-xs bg-white border border-slate-200 hover:border-brand-teal hover:bg-brand-teal/5 font-semibold p-2.5 rounded-xl transition-all shadow-sm"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="finding-list" className="space-y-3">
                      <p className="text-xs text-slate-400">
                        {Object.keys(findings).length === 0
                          ? "請在左側報表中，點擊可能有邏輯或數值異常的儲存格/資料行。"
                          : `已登錄 ${Object.keys(findings).length} 個異常項目:`}
                      </p>
                      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1 lesson-session-scroll">
                        {Object.entries(findings).map(([id, reason]) => (
                          <div
                            key={id}
                            className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-start justify-between gap-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-400 font-mono">
                                標記: {id}
                              </p>
                              <p className="text-xs font-bold text-slate-700 truncate mt-0.5">
                                {reason}
                              </p>
                            </div>
                            {phase === "editing" && (
                              <button
                                onClick={() => handleRemoveFinding(id)}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 px-1.5"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {wrongClicks > 0 && phase === "editing" && (
                <div className="mt-3 text-[10px] text-slate-400 italic">
                  * 誤觸非異常區域次數: {wrongClicks} 次
                </div>
              )}
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
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-bold">{message}</p>
              {result === "incorrect" && (
                <div className="mt-4 flex gap-3">
                  <GameButton variant="primary" onClick={handleReset} className="h-10 text-xs px-4">
                    重新挑戰
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
            : phase === "editing" && Object.keys(findings).length > 0
            ? handleCheck
            : undefined
        }
        continueLabel={
          phase === "feedback" && result === "correct"
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
