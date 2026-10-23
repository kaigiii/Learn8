import type { Decision, FrameProvider, NeuroFrame, NeuroLabSource, NeuroLearningEvent, NeuroSourceMetadata, NeuroState, Outcome, Proposal, SandboxAction, Scenario, Scene, StreamState } from "../contract";
import { SyntheticScenarioSource } from "./SyntheticScenarioSource";
import { InterventionRules } from "../rules/InterventionRules";

type GatewayMessage =
  | { type: "connected"; device: { name: string; address: string }; sampleRateHz: number; renderRateHz: number }
  | { type: "frame"; frame: NeuroFrame }
  | { type: "error"; code: string; message: string };

function museWebSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_MUSE_WS_URL;
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1/neuro/live`;
}

function isGatewayMessage(value: unknown): value is GatewayMessage {
  return !!value && typeof value === "object" && "type" in value;
}

/**
 * Browser counterpart to the optional local Muse gateway. It deliberately
 * accepts only derived live frames: raw EEG samples stay on the paired
 * computer, and course events only inform the local intervention rules.
 */
export class MuseLiveSource implements NeuroLabSource {
  private socket: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private connected = false;
  private rules = new InterventionRules();
  private snapshot = new SyntheticScenarioSource().getSnapshot();
  private metadata: NeuroSourceMetadata = { name: "Muse 2 · awaiting gateway", mock: false, source: "muse-live", sampleRateHz: 256, renderRateHz: 8 };

  getSnapshot = () => this.snapshot;
  getMetadata = () => this.metadata;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish() { this.listeners.forEach(listener => listener()); }
  private applyRules(frame: NeuroFrame) {
    this.rules.update(frame, true);
    this.snapshot = { ...this.snapshot, frame, playing: this.connected, proposal: this.rules.proposal, cooldownUntilMs: this.rules.cooldownUntilMs, evidenceSeconds: this.rules.evidenceSeconds, events: this.rules.events.toArray() };
  }

  connect = () => {
    if (this.socket || typeof window === "undefined") return;
    const url = museWebSocketUrl();
    if (!url) return;
    const socket = new WebSocket(url);
    this.socket = socket;
    this.snapshot = { ...this.snapshot, frame: { ...this.snapshot.frame, source: "muse-live", mock: false, connection: "connecting" } };
    socket.onopen = () => socket.send(JSON.stringify({ action: "connect" }));
    socket.onmessage = event => {
      let message: unknown;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!isGatewayMessage(message)) return;
      if (message.type === "connected") {
        this.connected = true;
        this.metadata = { name: message.device.name, mock: false, source: "muse-live", sampleRateHz: message.sampleRateHz as 256, renderRateHz: message.renderRateHz };
      }
      if (message.type === "frame" && message.frame?.source === "muse-live") this.applyRules(message.frame);
      if (message.type === "error") {
        this.connected = false;
        this.snapshot = { ...this.snapshot, frame: { ...this.snapshot.frame, source: "muse-live", mock: false, connection: "disconnected", qualityGatePassed: false } };
      }
      this.publish();
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null; this.connected = false;
      this.snapshot = { ...this.snapshot, playing: false, frame: { ...this.snapshot.frame, source: "muse-live", mock: false, connection: "disconnected", qualityGatePassed: false } };
      this.publish();
    };
  };
  disconnect = () => { const socket = this.socket; this.socket = null; this.connected = false; socket?.close(); this.listeners.clear(); };
  resume = () => this.connect();
  pause = () => this.disconnect();
  reset = () => { this.rules = new InterventionRules(); this.snapshot = new SyntheticScenarioSource().getSnapshot(); this.publish(); };
  setSpeed = (_speed: number) => undefined;
  setScene = (_scene: Scene) => undefined;
  setMode = (mode: "observe" | "assist" | "adaptive") => { this.rules.setMode(mode, this.snapshot.frame.timestampMs); this.applyRules(this.snapshot.frame); this.publish(); };
  setOutcome = (_outcome: Outcome) => undefined;
  setStream = (_state: StreamState) => undefined;
  seek = (_seconds: number) => undefined;
  act = (_action: SandboxAction) => undefined;
  answer = (correct: boolean) => this.receiveEvent({ timestampMs: this.snapshot.frame.timestampMs, type: correct ? "answer_correct" : "answer_incorrect" });
  inject = (state: NeuroState | "answer-incorrect" | null) => { if (state === "answer-incorrect") this.answer(false); };
  preview = (_level: 1 | 2 | 3, _action?: Proposal["action"]) => undefined;
  receiveEvent = (event: NeuroLearningEvent) => {
    if (event.type === "answer_incorrect") this.rules.incorrect(this.snapshot.frame.timestampMs);
    this.snapshot = { ...this.snapshot, learningEvents: [...this.snapshot.learningEvents.slice(-79), event] };
    this.applyRules(this.snapshot.frame);
    this.publish();
  };
  decide = (decision: Decision) => { this.rules.decide(decision, this.snapshot.frame.timestampMs); this.applyRules(this.snapshot.frame); this.publish(); };
}
