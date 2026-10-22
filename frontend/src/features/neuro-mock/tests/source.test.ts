import { test } from "node:test";
import assert from "node:assert/strict";
import { SyntheticScenarioSource, type Scheduler } from "../sources/SyntheticScenarioSource";
import { RingBuffer } from "../engine/RingBuffer";

class FakeClock implements Scheduler {
  callbacks = new Set<() => void>();
  every(cb: () => void) { this.callbacks.add(cb); return cb; }
  clear(handle: unknown) { this.callbacks.delete(handle as () => void); }
  advance(seconds: number) { for (let i = 0; i < seconds * 10; i++) Array.from(this.callbacks).forEach(cb => cb()); }
}
function fixture(seed = 8) {
  const clock = new FakeClock(); const source = new SyntheticScenarioSource(seed, "journey", clock);
  source.connect(); return { clock, source };
}
test("construction and subscription start no timer; play/pause/resume share monotonic clock", () => {
  const { clock, source } = fixture(); let renders = 0;
  source.subscribe(() => renders++); assert.equal(clock.callbacks.size, 0);
  source.resume(); source.resume(); assert.equal(clock.callbacks.size, 1);
  clock.advance(2); assert.equal(source.getSnapshot().frame.timestampMs, 2000);
  source.pause(); clock.advance(10); assert.equal(source.getSnapshot().frame.timestampMs, 2000);
  source.resume(); clock.advance(1); assert.equal(source.getSnapshot().frame.sequence, 30);
  assert.ok(renders > 0);
});
test("scenario + seed + input timeline are deterministic, including reset", () => {
  const a = fixture(77), b = fixture(77);
  for (const { source, clock } of [a, b]) { source.setScene("linked"); source.resume(); clock.advance(20); source.inject("frustrated"); source.inject("answer-incorrect"); clock.advance(24); }
  assert.deepEqual(a.source.getSnapshot(), b.source.getSnapshot());
  const different = fixture(78); different.source.resume(); different.clock.advance(44);
  assert.notDeepEqual(a.source.getSnapshot().frame.signal, different.source.getSnapshot().frame.signal);
  a.source.reset(); b.source.reset(); assert.deepEqual(a.source.getSnapshot(), b.source.getSnapshot());
  assert.deepEqual(a.source.getSnapshot().frame, fixture(77).source.getSnapshot().frame);
  assert.equal(a.source.getSnapshot().resetRevision, 1, "Reset remounts transient UI including failed search and open popovers");
});
test("speed changes do not skip simulation ticks; metrics change at 1 scenario Hz", () => {
  const a = fixture(), b = fixture(); a.source.resume(); b.source.resume();
  a.source.setSpeed(4); a.clock.advance(5); b.clock.advance(20);
  assert.deepEqual(a.source.getSnapshot().frame, b.source.getSnapshot().frame);
  a.source.setSpeed(1); const before = a.source.getSnapshot().frame.metrics;
  a.clock.advance(.5); assert.deepEqual(a.source.getSnapshot().frame.metrics, before);
  a.clock.advance(.5); assert.notDeepEqual(a.source.getSnapshot().frame.metrics, before);
  a.source.setSpeed(0); assert.equal(a.source.getSnapshot().speed, 1);
});
test("12 second baseline, pause, replay and quality failure use source clock", () => {
  const { source, clock } = fixture(); source.setScene("baseline"); source.resume(); clock.advance(5); source.pause(); clock.advance(20);
  assert.equal(source.getSnapshot().sceneElapsedMs, 5000);
  source.resume(); clock.advance(7); assert.equal(source.getSnapshot().scene, "linked");
  source.setScene("baseline"); clock.advance(2); source.inject("poor_signal"); clock.advance(20);
  assert.equal(source.getSnapshot().scene, "baseline"); assert.equal(source.getSnapshot().baselineFailed, true);
  source.inject(null); source.setScene("baseline"); clock.advance(12); assert.equal(source.getSnapshot().scene, "linked");
});
test("fixed ring, waveforms, trends and event log are bounded", () => {
  const ring = new RingBuffer<number>(3); [1, 2, 3, 4].forEach(v => ring.push(v)); assert.deepEqual(ring.toArray(), [2, 3, 4]);
  const { source, clock } = fixture(); source.resume(); clock.advance(300);
  assert.equal(source.getSnapshot().frame.signal.channels.AF7.waveform.length, 100);
  assert.equal(source.getSnapshot().trend.length, 30);
  for (let i = 0; i < 120; i++) source.inject("answer-incorrect");
  assert.equal(source.getSnapshot().events.length, 80);
});
test("disconnect clears all timers/subscribers; reconnect is safe for StrictMode", () => {
  const { source, clock } = fixture(); let calls = 0;
  const unsubscribe = source.subscribe(() => calls++); source.resume(); clock.advance(2); unsubscribe();
  const before = calls; clock.advance(1); assert.equal(calls, before);
  source.disconnect(); assert.equal(clock.callbacks.size, 0);
  const stopped = source.getSnapshot().frame.sequence; clock.advance(5); assert.equal(source.getSnapshot().frame.sequence, stopped);
  source.resume(); assert.equal(clock.callbacks.size, 0);
  source.connect(); source.resume(); clock.advance(1); assert.equal(source.getSnapshot().frame.sequence, stopped + 10);
  source.disconnect(); assert.equal(clock.callbacks.size, 0);
});
test("poor signal clears cognitive scores and proposals; paused time never accumulates evidence", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.inject("fatigued"); source.resume(); clock.advance(65);
  assert.equal(source.getSnapshot().proposal?.level, 3);
  source.inject("poor_signal"); clock.advance(.1);
  assert.equal(source.getSnapshot().proposal, null); assert.equal(source.getSnapshot().frame.normalized.engagement, null);
  assert.equal(source.getSnapshot().frame.confidence, null); assert.equal(source.getSnapshot().evidenceSeconds, 0);
  source.pause(); const frozen = source.getSnapshot(); clock.advance(100); assert.deepEqual(source.getSnapshot(), frozen);
});
test("L2 requires an answer event plus sustained trend and observes answer feedback delay", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.inject("frustrated"); source.resume(); clock.advance(22);
  assert.notEqual(source.getSnapshot().proposal?.level, 2);
  source.inject("answer-incorrect"); clock.advance(4); assert.equal(source.getSnapshot().proposal, null);
  clock.advance(12); assert.equal(source.getSnapshot().proposal?.level, 2);
  assert.ok(source.getSnapshot().proposal!.evidence.length >= 2);
});
test("refusing L3 enforces three minute cooldown and Observe never proposes", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.inject("fatigued"); source.resume(); clock.advance(65);
  source.decide("declined"); assert.equal(source.getSnapshot().cooldownUntilMs, 245000);
  clock.advance(100); assert.equal(source.getSnapshot().proposal, null);
  clock.advance(80); assert.equal(source.getSnapshot().proposal?.level, 3);
  source.decide("declined"); assert.equal(source.getSnapshot().mode, "observe");
  clock.advance(700); assert.equal(source.getSnapshot().proposal, null);
});
test("poor signal masks stale conclusions immediately even while paused", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.inject("focused"); source.resume(); clock.advance(10); source.pause();
  const sequence = source.getSnapshot().frame.sequence;
  source.inject("poor_signal");
  assert.equal(source.getSnapshot().frame.inferredState, "poor_signal");
  assert.equal(source.getSnapshot().frame.normalized.engagement, null);
  assert.equal(source.getSnapshot().frame.signal.channels.TP9.quality, "poor");
  assert.equal(source.getSnapshot().frame.sequence, sequence);
});
test("state changes dwell for 3 seconds and the 180-second journey includes recovery and signal loss", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.resume();
  const seen = new Set<string>();
  for (let i = 0; i < 180; i++) { clock.advance(1); seen.add(source.getSnapshot().frame.inferredState); }
  for (const state of ["calibrating", "focused", "distracted", "frustrated", "recovered", "poor_signal"]) assert.ok(seen.has(state), state);
  source.inject("focused"); clock.advance(2); assert.equal(source.getSnapshot().frame.inferredState, "poor_signal");
  clock.advance(2); assert.equal(source.getSnapshot().frame.inferredState, "focused");
});
test("sandbox keeps the learning objective while accepting alternate-question and break proposals", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.resume(); clock.advance(15);
  source.preview(3, "change_question"); source.decide("accepted");
  assert.equal(source.getSnapshot().sandbox.variant, "visual");
  assert.match(source.getSnapshot().sandbox.objective, /等值分數/);
  source.answer(true); source.act("return-original"); assert.equal(source.getSnapshot().sandbox.variant, "original");
  source.preview(3, "suggest_break"); source.decide("accepted"); assert.equal(source.getSnapshot().sandbox.phase, "break");
  source.act("return"); assert.equal(source.getSnapshot().sandbox.phase, "recalibrating");
  clock.advance(12); assert.equal(source.getSnapshot().sandbox.phase, "learning");
});
test("stream interruption immediately gates inference and a recovery resumes the isolated sandbox", () => {
  const { source, clock } = fixture(); source.setScene("linked"); source.resume(); clock.advance(12);
  source.setStream("stalled"); clock.advance(1);
  assert.equal(source.getSnapshot().frame.qualityGatePassed, false); assert.equal(source.getSnapshot().proposal, null);
  source.answer(true); assert.equal(source.getSnapshot().sandbox.answerCorrect, true);
  source.setStream("restored"); clock.advance(1); assert.equal(source.getSnapshot().frame.qualityGatePassed, true);
});
