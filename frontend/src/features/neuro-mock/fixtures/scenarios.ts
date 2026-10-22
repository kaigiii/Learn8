import type { NeuroState, Scenario } from "../contract";
// Hand-authored synthetic targets only. No research/participant data is bundled.
export const SCENARIOS: Record<Scenario, string> = { journey: "180 秒・Neuro journey", focus: "穩定投入", support: "支援介入", rest: "休息建議", helped: "閉環・helped", no_change: "閉環・no_change", made_worse: "閉環・made_worse" };
export const STATE_LABELS: Record<NeuroState, string> = {
  calibrating: "建立模擬基準", focused: "投入趨勢穩定", distracted: "投入趨勢下降",
  frustrated: "這個步驟花了些時間", recovered: "趨勢已恢復", fatigued: "可能需要換個節奏", poor_signal: "訊號不足・暫停判讀",
};
export const TARGETS: Record<NeuroState, [number, number, number]> = {
  calibrating: [65, 60, 20], focused: [78, 68, 20], distracted: [36, 55, 35],
  frustrated: [32, 25, 48], recovered: [72, 66, 25], fatigued: [23, 34, 86], poor_signal: [0, 0, 0],
};
export function scenarioState(scenario: Scenario, second: number): NeuroState {
  if (["helped", "no_change", "made_worse"].includes(scenario)) return second < 40 ? "distracted" : "frustrated";
  if (scenario === "focus") return "focused";
  if (scenario === "support") return second < 40 ? "distracted" : "frustrated";
  if (scenario === "rest") return "fatigued";
  const t = second % 180;
  return t < 15 ? "calibrating" : t < 55 ? "focused" : t < 80 ? "distracted" : t < 105 ? "frustrated" : t < 135 ? "recovered" : t < 165 ? "focused" : "poor_signal";
}
