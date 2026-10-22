export const CHANNELS = ["TP9", "AF7", "AF8", "TP10"] as const;
export type Channel = typeof CHANNELS[number];
export type NeuroState = "calibrating" | "focused" | "distracted" | "frustrated" | "recovered" | "fatigued" | "poor_signal";
export type Scenario = "journey" | "focus" | "support" | "rest" | "helped" | "no_change" | "made_worse";
export type Scene = "search" | "wear" | "contacts" | "baseline" | "linked";
export type Mode = "observe" | "assist" | "adaptive";
export type Quality = "good" | "fair" | "poor" | "unknown";
export type NeuroChannelFrame = { waveform: number[]; rms: number; peakToPeak: number; quality: Quality };
export type NeuroFrame = {
  schemaVersion: "1.0"; sessionId: string; sequence: number; timestampMs: number;
  source: "synthetic" | "csv-replay" | "live"; mock: boolean; connection: "connected" | "disconnected" | "stalled" | "connecting";
  signal: { sampleRateHz: 256; overallQuality: Quality; channels: Record<Channel, NeuroChannelFrame> };
  metrics: { engagementIndex: number | null; frontalAlphaAsymmetry: number | null; blinkRatePerMinute: number | null; interestProbability: number | null };
  normalized: { engagement: number | null; approach: number | null; fatigue: number | null };
  inferredState: NeuroState; confidence: number | null; qualityGatePassed: boolean;
};
export type Proposal = {
  id: string; timestampMs: number; level: 1 | 2 | 3;
  action: "soft_nudge" | "offer_hint" | "simplify_explanation" | "change_question" | "suggest_break";
  reasonCode?: string; evidenceWindowSeconds?: number; mode?: "silent" | "ask-first" | "automatic";
  structuredEvidence?: Array<{ metric: string; value: number | string; baseline?: number; threshold?: number }>;
  reason: string; evidence: string[]; expiresAtMs: number;
};
export type Decision = "accepted" | "declined" | "dismissed" | "deferred";
export type LabEvent = { timestampMs: number; kind: string; detail: string };
export type LabSnapshot = {
  frame: NeuroFrame; playing: boolean; speed: number; scenario: Scenario; seed: number; resetRevision: number;
  scene: Scene; sceneElapsedMs: number; sceneReplay: number; baselineFailed: boolean;
  injected: NeuroState | null; mode: Mode; proposal: Proposal | null;
  cooldownUntilMs: number; evidenceSeconds: number; events: LabEvent[];
  trend: number[]; baseline: Baseline; sandbox: SandboxState; interventions: InterventionRecord[];
  insight: NeuroCoachInsight; stream: StreamState; outcomeDemo: Outcome; learningEvents: NeuroLearningEvent[];
};
export type NeuroSourceMetadata = { name: string; mock: boolean; source: NeuroFrame["source"]; sampleRateHz: 256; renderRateHz: number };
export interface NeuroDataSource {
  connect(): void; subscribe(listener: () => void): () => void;
  getSnapshot(): LabSnapshot; pause(): void; resume(): void;
  reset(options?: { seed?: number; scenario?: Scenario }): void;
  disconnect(): void; getMetadata(): NeuroSourceMetadata;
}
export interface NeuroLabSource extends NeuroDataSource {
  setSpeed(speed: number): void; inject(state: NeuroState | "answer-incorrect" | null): void;
  setScene(scene: Scene): void; setMode(mode: Mode): void;
  decide(decision: Decision): void;
  act(action: SandboxAction): void; answer(correct: boolean): void;
  receiveEvent(event: NeuroLearningEvent): void; setOutcome(outcome: Outcome): void;
  setStream(state: StreamState): void; seek(seconds: number): void;
  preview(level: 1 | 2 | 3, action?: Proposal["action"]): void;
}

export type LearningEventType = "stage_viewed" | "answer_submitted" | "answer_correct" | "answer_incorrect" | "hint_requested" | "stage_changed" | "lesson_paused";
export type NeuroLearningEvent = { timestampMs: number; type: LearningEventType; stageId?: string; metadata?: Record<string, string | number | boolean> };
export type Outcome = "helped" | "no_change" | "made_worse";
export type SandboxAction = "hint" | "simplify" | "swap" | "return-original" | "break" | "return" | "after-question" | "mute-breaks" | "finish" | "continue";
export type SandboxState = {
  phase: "learning" | "break" | "recalibrating" | "ended";
  variant: "original" | "visual" | "simple";
  objective: string; hintVisible: boolean; answerCorrect: boolean | null;
  breakRemainingMs: number; calibrationRemainingMs: number;
  breakAfterQuestion: boolean; breaksMuted: boolean; message: string;
};
export interface InterventionPort { act(action: SandboxAction, timestampMs: number): void; answer(correct: boolean, timestampMs: number): void; }
export type Baseline = { engagement: number; approach: number; samples: number; calibratedAtMs: number | null };
export type InterventionRecord = {
  proposal: Proposal; decision: Decision | "expired" | "auto-applied"; timestampMs: number;
  before: { engagement: number; approach: number; samples: number } | null;
  after: { engagement: number; approach: number; samples: number } | null;
  outcome: Outcome | "observing" | "insufficient_data" | "not_applied";
};
export type NeuroCoachInsight = { severity: "info" | "positive" | "attention"; title: string; summary: string; evidence: string[]; suggestion?: string; generatedBy: "mock-rule-engine" };
export type StreamState = "connected" | "stalled" | "offline" | "reconnecting" | "restored";
export interface FrameProvider {
  frame(tick: number, state: NeuroState): NeuroFrame;
  reset(seed?: number): void;
  metadata: NeuroSourceMetadata;
  durationMs?: number;
}
