import type { Baseline, Decision, FrameProvider, LabSnapshot, Mode, NeuroLabSource, NeuroLearningEvent, NeuroState, Outcome, Proposal, SandboxAction, Scenario, Scene, StreamState } from "../contract";
import { scenarioState } from "../fixtures/scenarios";
import { SignalEngine } from "../engine/signal";
import { RingBuffer } from "../engine/RingBuffer";
import { Sandbox } from "../engine/Sandbox";
import { OutcomeTracker } from "../engine/OutcomeTracker";
import { InterventionRules } from "../rules/InterventionRules";
import { coachInsight } from "../rules/coach";

export type Scheduler = { every(callback: () => void, ms: number): unknown; clear(handle: unknown): void };
const scheduler: Scheduler = { every: (callback, ms) => setInterval(callback, ms), clear: handle => clearInterval(handle as ReturnType<typeof setInterval>) };
const emptyBaseline = (): Baseline => ({ engagement: 70, approach: 65, samples: 0, calibratedAtMs: null });
const emptySandbox = () => new Sandbox().state;
const emptyInsight = () => ({ severity: "info" as const, title: "準備開始", summary: "完成模擬校準後，系統會以趨勢提供可選建議。", evidence: ["尚未建立基準"], generatedBy: "mock-rule-engine" as const });

/** A single deterministic transport. It is isolated from Learn8 domain state. */
export class SyntheticScenarioSource implements NeuroLabSource {
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private connected = false;
  private provider: FrameProvider;
  private rules = new InterventionRules();
  private sandbox = new Sandbox();
  private outcomes = new OutcomeTracker();
  private trend = new RingBuffer<number>(30);
  private baselineSamples = new RingBuffer<[number, number]>(15);
  private learningEvents = new RingBuffer<NeuroLearningEvent>(80);
  private tick = 0;
  private sceneStart = 0;
  private pendingState: NeuroState = "calibrating";
  private pendingSince = 0;
  private stableState: NeuroState = "calibrating";
  private baseline = emptyBaseline();
  private stream: StreamState = "connected";
  private outcomeDemo: Outcome = "helped";
  private manualProposal: Proposal | null = null;
  private snapshot: LabSnapshot;

  constructor(seed = 8, scenario: Scenario = "journey", private clock: Scheduler = scheduler, provider?: FrameProvider) {
    this.provider = provider ?? new SignalEngine(seed);
    this.snapshot = this.initial(seed, scenario);
  }

  private initial(seed: number, scenario: Scenario): LabSnapshot {
    const frame = this.provider.frame(0, "calibrating");
    return { frame, playing: false, speed: 1, scenario, seed, resetRevision: 0, scene: "search", sceneElapsedMs: 0, sceneReplay: 0, baselineFailed: false, injected: null, mode: "assist", proposal: null, cooldownUntilMs: 0, evidenceSeconds: 0, events: [], trend: [], baseline: emptyBaseline(), sandbox: emptySandbox(), interventions: [], insight: emptyInsight(), stream: "connected", outcomeDemo: "helped", learningEvents: [] };
  }

  getSnapshot = () => this.snapshot;
  getMetadata = () => this.provider.metadata;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  connect = () => { this.connected = true; };
  disconnect = () => { this.pause(); this.connected = false; this.listeners.clear(); };

  private currentProposal() { return this.manualProposal ?? this.rules.proposal; }
  private publish() {
    const proposal = this.currentProposal();
    const insight = coachInsight(this.snapshot.frame, this.baseline, this.learningEvents.toArray());
    this.snapshot = { ...this.snapshot, mode: this.rules.mode, proposal, cooldownUntilMs: this.rules.cooldownUntilMs, evidenceSeconds: this.rules.evidenceSeconds, events: this.rules.events.toArray(), trend: this.trend.toArray(), baseline: this.baseline, sandbox: this.sandbox.state, interventions: this.outcomes.snapshot(), insight, stream: this.stream, outcomeDemo: this.outcomeDemo, learningEvents: this.learningEvents.toArray() };
    this.listeners.forEach(listener => listener());
  }

  resume = () => {
    if (!this.connected || this.timer !== null) return;
    this.snapshot = { ...this.snapshot, playing: true };
    this.timer = this.clock.every(() => { for (let i = 0; i < this.snapshot.speed; i += 1) this.step(); this.publish(); }, 100);
    this.publish();
  };
  pause = () => { if (this.timer !== null) this.clock.clear(this.timer); this.timer = null; this.snapshot = { ...this.snapshot, playing: false }; this.publish(); };
  setSpeed = (speed: number) => { if ([1, 2, 4].includes(speed)) { this.snapshot = { ...this.snapshot, speed }; this.publish(); } };
  seek = (seconds: number) => {
    const wasPlaying = this.snapshot.playing;
    this.reset(); this.setScene("linked");
    const steps = Math.max(0, Math.floor(seconds * 10));
    for (let i = 0; i < steps; i += 1) this.step();
    if (wasPlaying) this.resume(); else this.publish();
  };
  reset = (options: { seed?: number; scenario?: Scenario } = {}) => {
    this.pause();
    const seed = options.seed ?? this.snapshot.seed;
    const scenario = options.scenario ?? this.snapshot.scenario;
    const resetRevision = this.snapshot.resetRevision + 1;
    this.tick = 0; this.sceneStart = 0; this.pendingState = "calibrating"; this.stableState = "calibrating"; this.pendingSince = 0;
    this.provider.reset(seed); this.rules = new InterventionRules(); this.sandbox = new Sandbox(); this.outcomes = new OutcomeTracker(); this.trend.clear(); this.baselineSamples.clear(); this.learningEvents.clear(); this.baseline = emptyBaseline(); this.stream = "connected"; this.outcomeDemo = this.scenarioOutcome(scenario); this.manualProposal = null;
    this.snapshot = { ...this.initial(seed, scenario), resetRevision, outcomeDemo: this.outcomeDemo };
    this.publish();
  };
  private scenarioOutcome(scenario: Scenario): Outcome { return scenario === "no_change" ? "no_change" : scenario === "made_worse" ? "made_worse" : "helped"; }
  setScene = (scene: Scene) => {
    this.sceneStart = this.tick * 100;
    this.rules.cancel(this.sceneStart, "切換展示場景"); this.manualProposal = null;
    this.snapshot = { ...this.snapshot, scene, sceneElapsedMs: 0, sceneReplay: this.snapshot.sceneReplay + 1, baselineFailed: false };
    this.rules.log(this.sceneStart, "scene", scene === "linked" ? "進入隔離 lesson sandbox" : scene);
    this.publish();
  };
  setMode = (mode: Mode) => { this.rules.setMode(mode, this.tick * 100); this.publish(); };
  setOutcome = (outcome: Outcome) => { this.outcomeDemo = outcome; this.rules.log(this.tick * 100, "outcome-demo", outcome); this.publish(); };
  setStream = (stream: StreamState) => { this.stream = stream; this.rules.log(this.tick * 100, "stream", stream); this.publish(); };
  receiveEvent = (event: NeuroLearningEvent) => {
    this.learningEvents.push(event); this.rules.log(event.timestampMs, event.type, "由公開 adapter 傳入；不會回寫課程狀態");
    if (event.type === "answer_incorrect") this.rules.incorrect(event.timestampMs);
    if (event.type === "lesson_paused") this.pause();
    this.publish();
  };
  answer = (correct: boolean) => {
    const time = this.tick * 100;
    this.sandbox.answer(correct);
    this.receiveEvent({ timestampMs: time, type: "answer_submitted", metadata: { sandbox: true } });
    this.receiveEvent({ timestampMs: time, type: correct ? "answer_correct" : "answer_incorrect", metadata: { sandbox: true } });
  };
  act = (action: SandboxAction) => { this.sandbox.act(action, this.tick * 100); this.rules.log(this.tick * 100, "sandbox", action); this.publish(); };
  preview = (level: 1 | 2 | 3, action: Proposal["action"] = level === 1 ? "soft_nudge" : level === 2 ? "offer_hint" : "change_question") => {
    const now = this.tick * 100;
    this.manualProposal = { id: `manual-${now}-${level}`, timestampMs: now, level, action, reasonCode: "manual-preview", evidenceWindowSeconds: 0, mode: "ask-first", reason: "這是手動展示的介入流程，不代表即時推論。", evidence: ["觸發來源：介入展示", "不會變更 Learn8 課程、分數或進度"], structuredEvidence: [{ metric: "trigger", value: "manual-preview" }], expiresAtMs: now + 30000 };
    this.publish();
  };
  inject = (state: NeuroState | "answer-incorrect" | null) => {
    const now = this.tick * 100;
    if (state === "answer-incorrect") { this.receiveEvent({ timestampMs: now, type: "answer_incorrect", metadata: { simulated: true } }); return; }
    this.snapshot = { ...this.snapshot, injected: state };
    this.rules.log(now, "injection", state ?? "恢復自動劇本");
    if (state === "poor_signal") {
      this.rules.cancel(now, "訊號不足"); this.manualProposal = null; this.stableState = "poor_signal";
      const frame = this.snapshot.frame;
      this.snapshot = { ...this.snapshot, baselineFailed: this.snapshot.scene === "baseline", frame: { ...frame, inferredState: "poor_signal", connection: "stalled", qualityGatePassed: false, confidence: null, normalized: { engagement: null, approach: null, fatigue: null }, signal: { ...frame.signal, overallQuality: "poor", channels: { TP9: { ...frame.signal.channels.TP9, quality: "poor" }, AF7: { ...frame.signal.channels.AF7, quality: "fair" }, AF8: { ...frame.signal.channels.AF8, quality: "fair" }, TP10: { ...frame.signal.channels.TP10, quality: "fair" } } } } };
    }
    this.publish();
  };
  decide = (decision: Decision) => {
    const now = this.tick * 100;
    const proposal = this.currentProposal();
    if (!proposal) return;
    const manual = !!this.manualProposal;
    if (manual) { this.manualProposal = null; this.rules.log(now, decision, `${proposal.id}・手動展示`); } else this.rules.decide(decision, now);
    this.outcomes.record(proposal, decision, now);
    if (decision === "accepted") this.applyProposal(proposal);
    if (decision === "deferred" && proposal.action === "suggest_break") this.act("after-question");
    this.publish();
  };
  private applyProposal(proposal: Proposal) {
    if (proposal.action === "soft_nudge") this.act("hint");
    if (proposal.action === "offer_hint" || proposal.action === "simplify_explanation") this.act("simplify");
    if (proposal.action === "change_question") this.act("swap");
    if (proposal.action === "suggest_break") this.act("break");
    if (this.outcomeDemo === "helped") this.snapshot = { ...this.snapshot, injected: "recovered" };
    if (this.outcomeDemo === "made_worse") this.snapshot = { ...this.snapshot, injected: "fatigued" };
  }
  private step() {
    this.tick += 1;
    const now = this.tick * 100;
    let scene = this.snapshot.scene;
    const elapsed = now - this.sceneStart;
    if (scene === "baseline" && elapsed >= 12000 && !this.snapshot.baselineFailed && this.snapshot.injected !== "poor_signal") {
      scene = "linked"; this.sceneStart = now; this.baseline = this.makeBaseline(now); this.rules.log(now, "baseline", "12 秒模擬基準完成・圓環收合為 Neuro Orb"); this.receiveEvent({ timestampMs: now, type: "stage_viewed", stageId: "sandbox-original", metadata: { simulated: true } });
    }
    const target = this.snapshot.injected ?? (scene === "linked" ? scenarioState(this.snapshot.scenario, now / 1000) : "calibrating");
    if (target !== this.pendingState) { this.pendingState = target; this.pendingSince = now; }
    if (target === "poor_signal" || scene !== "linked" || now - this.pendingSince >= 3000) this.stableState = target;
    let frame = this.provider.frame(this.tick, this.stableState);
    if (this.stream !== "connected" && this.stream !== "restored") frame = { ...frame, connection: this.stream === "stalled" ? "stalled" : "disconnected", inferredState: "poor_signal", qualityGatePassed: false, confidence: null, normalized: { engagement: null, approach: null, fatigue: null } };
    const previousState = this.snapshot.frame.inferredState;
    if (previousState !== frame.inferredState) this.rules.log(now, "state", `${previousState} → ${frame.inferredState}`);
    if (this.tick % 10 === 0 && frame.qualityGatePassed) {
      if (frame.normalized.engagement !== null) this.trend.push(frame.normalized.engagement);
      if (scene === "baseline" && frame.normalized.engagement !== null && frame.normalized.approach !== null) this.baselineSamples.push([frame.normalized.engagement, frame.normalized.approach]);
      if (scene === "linked" && this.snapshot.injected === null && ((this.snapshot.scenario === "journey" && (now / 1000) % 180 === 80) || (this.snapshot.scenario === "support" && (now / 1000) % 60 === 40))) this.receiveEvent({ timestampMs: now, type: "answer_incorrect", metadata: { scripted: true } });
    }
    this.sandbox.tick(frame.qualityGatePassed);
    if (this.sandbox.state.phase === "recalibrating" && this.sandbox.state.calibrationRemainingMs === 0) this.baseline = this.makeBaseline(now);
    this.rules.update(frame, scene === "linked" && now - this.sceneStart >= 10000 && this.sandbox.state.phase === "learning" && !this.sandbox.state.breaksMuted);
    if (this.outcomes.sample(frame)) { this.rules.setMode("observe", now); this.rules.log(now, "safety", "介入後趨勢變差，停止同類提醒並交還控制權"); }
    this.snapshot = { ...this.snapshot, frame, scene, sceneElapsedMs: now - this.sceneStart };
  }
  private makeBaseline(now: number): Baseline {
    const values = this.baselineSamples.toArray();
    return values.length ? { engagement: values.reduce((total, value) => total + value[0], 0) / values.length, approach: values.reduce((total, value) => total + value[1], 0) / values.length, samples: values.length, calibratedAtMs: now } : emptyBaseline();
  }
}
