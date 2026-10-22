import type { InterventionRecord, NeuroFrame, Proposal, Decision } from "../contract";
import { RingBuffer } from "./RingBuffer";
type Sample = { time: number; engagement: number; approach: number };
const mean = (samples: Sample[]) => samples.length ? { engagement: samples.reduce((a, s) => a + s.engagement, 0) / samples.length, approach: samples.reduce((a, s) => a + s.approach, 0) / samples.length, samples: samples.length } : null;
export class OutcomeTracker {
  private samples = new RingBuffer<Sample>(120);
  private records = new RingBuffer<InterventionRecord>(40);
  snapshot() { return this.records.toArray().map(r => ({ ...r })); }
  record(proposal: Proposal, decision: InterventionRecord["decision"], time: number) {
    const before = mean(this.samples.toArray().filter(s => s.time >= time - 30000));
    this.records.push({ proposal, decision, timestampMs: time, before, after: null, outcome: decision === "accepted" || decision === "auto-applied" ? "observing" : "not_applied" });
  }
  sample(frame: NeuroFrame): boolean {
    const now = frame.timestampMs;
    if (frame.qualityGatePassed && frame.normalized.engagement !== null && frame.normalized.approach !== null) this.samples.push({ time: now, engagement: frame.normalized.engagement, approach: frame.normalized.approach });
    let worsened = false;
    for (const record of this.records.toArray()) {
      if (record.outcome !== "observing" || now - record.timestampMs < 60000) continue;
      record.after = mean(this.samples.toArray().filter(s => s.time > record.timestampMs + 30000 && s.time <= record.timestampMs + 60000));
      if (!record.before || record.before.samples < 10 || !record.after || record.after.samples < 10) record.outcome = "insufficient_data";
      else {
        const delta = (record.after.engagement - record.before.engagement + record.after.approach - record.before.approach) / 2;
        record.outcome = delta >= 8 ? "helped" : delta <= -8 ? "made_worse" : "no_change";
        worsened ||= record.outcome === "made_worse";
      }
    }
    return worsened;
  }
}
