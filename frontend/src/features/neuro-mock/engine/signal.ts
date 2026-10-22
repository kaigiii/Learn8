import { CHANNELS, type FrameProvider, type NeuroFrame, type NeuroState } from "../contract";
import { TARGETS } from "../fixtures/scenarios";
import { RingBuffer } from "./RingBuffer";

function random(seed: number) {
  let x = seed >>> 0;
  return () => { x += 0x6D2B79F5; let t = Math.imul(x ^ x >>> 15, 1 | x); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const round = (x: number) => Math.round(x * 1000) / 1000;
export class SignalEngine implements FrameProvider {
  private rng: () => number;
  private rings = CHANNELS.map(() => new RingBuffer<number>(100));
  private average = new RingBuffer<[number, number, number]>(10);
  private current = [65, 60, 20];
  private metricSecond = -1;
  private metric: NeuroFrame["metrics"] = { engagementIndex: null, frontalAlphaAsymmetry: null, blinkRatePerMinute: null, interestProbability: null };
  private normalized: NeuroFrame["normalized"] = { engagement: null, approach: null, fatigue: null };
  readonly metadata = { name: "Muse 2 · Synthetic", mock: true, source: "synthetic" as const, sampleRateHz: 256 as const, renderRateHz: 10 };
  constructor(private seed: number) { this.rng = random(seed); }
  reset(seed = this.seed) { this.seed = seed; this.rng = random(seed); this.rings = CHANNELS.map(() => new RingBuffer<number>(100)); this.average.clear(); this.current = [65, 60, 20]; this.metricSecond = -1; }
  frame(tick: number, state: NeuroState): NeuroFrame {
    const seconds = tick / 10;
    const good = state !== "poor_signal";
    if (Math.floor(seconds) !== this.metricSecond) {
      this.metricSecond = Math.floor(seconds);
      if (good) {
        this.current = this.current.map((v, i) => v + (TARGETS[state][i] - v) * .65 + (this.rng() - .5) * 2);
        this.average.push(this.current as [number, number, number]);
        const history = this.average.toArray();
        const [engagement, approach, fatigue] = [0, 1, 2].map(i => round(history.reduce((sum, v) => sum + v[i], 0) / history.length));
        this.normalized = { engagement, approach, fatigue };
        this.metric = { engagementIndex: round(engagement / 40), frontalAlphaAsymmetry: round((approach - 50) / 100), blinkRatePerMinute: round(8 + fatigue / 4), interestProbability: round(engagement / 100) };
      } else {
        this.average.clear();
      }
    }
    const channels = Object.fromEntries(CHANNELS.map((channel, i) => {
      // Downsampled illustrative waveform, not an acquisition stream at 256 Hz.
      const value = 12 * Math.sin(seconds * 5.2 + i) + 5 * Math.sin(seconds * 13 + i * .7) + (this.rng() - .5) * (good ? 3 : 36) + (seconds % 7 < .2 ? 13 : 0);
      this.rings[i].push(round(value));
      const waveform = this.rings[i].toArray();
      return [channel, { waveform, rms: round(Math.sqrt(waveform.reduce((sum, v) => sum + v * v, 0) / waveform.length)), peakToPeak: round(Math.max(...waveform) - Math.min(...waveform)), quality: good ? "good" : i === 0 ? "poor" : "fair" }];
    })) as NeuroFrame["signal"]["channels"];
    return {
      schemaVersion: "1.0", sessionId: `synthetic-${this.seed}`, sequence: tick, timestampMs: tick * 100,
      source: "synthetic", mock: true, connection: "connected",
      signal: { sampleRateHz: 256, overallQuality: good ? "good" : "poor", channels },
      metrics: this.metric, normalized: good ? this.normalized : { engagement: null, approach: null, fatigue: null },
      inferredState: state, confidence: good && state !== "calibrating" ? .72 : null, qualityGatePassed: good,
    };
  }
}
