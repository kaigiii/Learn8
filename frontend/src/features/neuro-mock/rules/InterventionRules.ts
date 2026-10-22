import type { Decision, LabEvent, Mode, NeuroFrame, Proposal } from "../contract";
import { RingBuffer } from "../engine/RingBuffer";

export const THRESHOLDS = { baselineEngagement: 70, baselineApproach: 65, distractedDelta: 20, distractedSeconds: 25, frustratedDelta: 20, frustratedSeconds: 15, fatigue: 70, lowEngagement: 35, fatigueSeconds: 45 } as const;
export class InterventionRules {
  proposal: Proposal | null = null;
  cooldownUntilMs = 0;
  evidenceSeconds = 0;
  mode: Mode = "assist";
  readonly events = new RingBuffer<LabEvent>(80);
  private lastIncorrect = -Infinity;
  private lastAnswer = -Infinity;
  private refusals = 0;
  private issuedAt = new RingBuffer<number>(2);
  private lastCandidate = "";
  private lastSecond = -1;
  private serial = 0;
  private supportAppliedAt = -Infinity;
  private errorAfterSupport = false;
  log(time: number, kind: string, detail: string) { this.events.push({ timestampMs: time, kind, detail }); }
  incorrect(time: number) { this.lastIncorrect = time; this.lastAnswer = time; if (time > this.supportAppliedAt) this.errorAfterSupport = true; this.log(time, "answer_incorrect", "模擬答錯・不影響正式課程"); }
  setMode(mode: Mode, time: number) { this.mode = mode; this.cancel(time, "提醒模式已變更"); this.log(time, "mode", mode); }
  cancel(time: number, reason: string) {
    if (this.proposal) this.log(time, "dismissed", `${this.proposal.id}・${reason}`);
    this.proposal = null; this.evidenceSeconds = 0; this.lastCandidate = "";
  }
  decide(decision: Decision, time: number) {
    if (!this.proposal) return;
    const level = this.proposal.level;
    this.log(time, decision, `${this.proposal.id}・${this.proposal.action}・僅預覽，未操作課程`);
    this.cooldownUntilMs = time + (decision === "declined" && level === 3 ? 180000 : level === 1 ? 45000 : 30000);
    if (decision === "accepted" && level === 2) this.supportAppliedAt = time;
    if (decision === "declined" && ++this.refusals >= 2) {
      this.mode = "observe"; this.log(time, "mode", "連續拒絕兩次，已切換 Observe");
    } else if (decision === "accepted") this.refusals = 0;
    this.proposal = null; this.evidenceSeconds = 0; this.lastCandidate = "";
  }
  update(frame: NeuroFrame, enabled: boolean) {
    const now = frame.timestampMs;
    if (!enabled || !frame.qualityGatePassed || frame.inferredState === "calibrating") {
      this.cancel(now, "校準或品質不足，停止介入"); return;
    }
    if (this.proposal && now >= this.proposal.expiresAtMs) {
      this.log(now, "expired", this.proposal.id); this.proposal = null;
    }
    const second = Math.floor(now / 1000);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    const { engagement, approach, fatigue } = frame.normalized;
    const hasError = now - this.lastIncorrect <= 90000;
    const tired = fatigue !== null && fatigue > THRESHOLDS.fatigue && engagement !== null && engagement < THRESHOLDS.lowEngagement;
    const stuck = approach !== null && approach < THRESHOLDS.baselineApproach - THRESHOLDS.frustratedDelta && hasError;
    const distracted = engagement !== null && engagement < THRESHOLDS.baselineEngagement - THRESHOLDS.distractedDelta;
    const needsAlternate = stuck && this.supportAppliedAt > -Infinity && this.errorAfterSupport;
    const candidate = tired ? "tired" : needsAlternate ? "alternate" : stuck ? "stuck" : distracted ? "distracted" : "";
    this.evidenceSeconds = candidate ? (candidate === this.lastCandidate ? this.evidenceSeconds + 1 : 1) : 0;
    this.lastCandidate = candidate;
    if (this.proposal || this.mode === "observe" || now < this.cooldownUntilMs || now < 10000 || now - this.lastAnswer < 5000) return;
    if (this.issuedAt.toArray().filter(t => now - t < 600000).length >= 2) return;
    const required = tired ? THRESHOLDS.fatigueSeconds : needsAlternate ? 30 : stuck ? THRESHOLDS.frustratedSeconds : THRESHOLDS.distractedSeconds;
    if (!candidate || this.evidenceSeconds < required) return;
    const level = tired || needsAlternate ? 3 : stuck ? 2 : 1;
    this.proposal = {
      id: `proposal-${++this.serial}`, timestampMs: now, level,
      action: tired ? "suggest_break" : needsAlternate ? "change_question" : stuck ? "offer_hint" : "soft_nudge",
      reasonCode: tired ? "fatigue-sustained" : needsAlternate ? "support-did-not-recover" : stuck ? "frustration-with-error" : "distracted-sustained",
      evidenceWindowSeconds: required, mode: this.mode === "adaptive" && level < 3 ? "automatic" : "ask-first",
      reason: tired ? "模擬疲勞趨勢與低投入持續，可以選擇換個節奏。" : needsAlternate ? "先前的支援後仍有一次模擬答錯；可以換同一概念的呈現方式。" : stuck ? "這個步驟停留了一段時間，且剛剛有一次模擬答錯。" : "最近的模擬投入趨勢低於基準，可以選擇拆小步驟。",
      evidence: tired ? [`fatigue ${fatigue?.toFixed(1)} > 70`, `engagement ${engagement?.toFixed(1)} < 35`, `持續 ${this.evidenceSeconds} 秒 ≥ 45 秒`] : needsAlternate ? ["Level 2 支援已展示", "支援後再次 answer_incorrect", `持續 ${this.evidenceSeconds} 秒 ≥ 30 秒`] : stuck ? [`approach ${approach?.toFixed(1)} < 45（baseline 65 − 20）`, "90 秒內有 answer_incorrect", `持續 ${this.evidenceSeconds} 秒 ≥ 15 秒`] : [`engagement ${engagement?.toFixed(1)} < 50（baseline 70 − 20）`, `持續 ${this.evidenceSeconds} 秒 ≥ 25 秒`],
      expiresAtMs: now + (level === 1 ? 2000 : 30000),
    };
    this.cooldownUntilMs = now + (level === 1 ? 45000 : 30000);
    this.issuedAt.push(now);
    this.log(now, "proposed", `Level ${level}・${this.proposal.reason}`);
    if (this.mode === "adaptive" && level < 3) this.log(now, "auto-applied", "自動展示支援預覽；未改變任何課程內容");
  }
}
