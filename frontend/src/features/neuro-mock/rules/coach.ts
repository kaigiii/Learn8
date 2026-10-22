import type { Baseline, NeuroCoachInsight, NeuroFrame, NeuroLearningEvent } from "../contract";
import { STATE_LABELS } from "../fixtures/scenarios";
export function coachInsight(frame: NeuroFrame, baseline: Baseline, events: NeuroLearningEvent[]): NeuroCoachInsight {
  if (!frame.qualityGatePassed || frame.connection !== "connected") return { severity: "info", title: "暫停狀態判讀", summary: "目前模擬訊號品質不足，請先調整接點；學習可以繼續。", evidence: ["quality gate 未通過"], generatedBy: "mock-rule-engine" };
  const recentErrors = events.filter(e => e.type === "answer_incorrect" && frame.timestampMs - e.timestampMs <= 90000).length;
  const delta = Math.round((frame.normalized.engagement ?? baseline.engagement) - baseline.engagement);
  return { severity: delta < -15 ? "attention" : "info", title: STATE_LABELS[frame.inferredState], summary: `最近的模擬投入與基準相差 ${delta} 點。${recentErrors ? `90 秒內有 ${recentErrors} 次模擬答錯，可以選擇提示或較小的步驟。` : "目前沒有近期答錯證據，可以照自己的節奏繼續。"}`, evidence: [`engagement ${frame.normalized.engagement?.toFixed(1) ?? "unknown"}`, `baseline ${baseline.engagement.toFixed(1)}`, `answer_incorrect ${recentErrors}`], generatedBy: "mock-rule-engine" };
}
