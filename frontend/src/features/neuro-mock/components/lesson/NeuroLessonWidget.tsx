"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, BrainCircuit, WandSparkles } from "lucide-react";
import type { NeuroLabSource, NeuroLearningEvent } from "../../contract";
import { SyntheticScenarioSource } from "../../sources/SyntheticScenarioSource";
import { MuseLiveSource } from "../../sources/MuseLiveSource";
import { CompetitionExperienceOverlay, type CompetitionExperiencePlan } from "./CompetitionExperienceOverlay";

/** Feature-owned display. It receives learning events but never changes lesson state. */
export default function NeuroLessonWidget({ events, plan }: { events: NeuroLearningEvent[]; plan: CompetitionExperiencePlan }) {
  const [source] = useState<NeuroLabSource>(() => process.env.NEXT_PUBLIC_ENABLE_MUSE_LIVE === "true" ? new MuseLiveSource() : new SyntheticScenarioSource());
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const deliveredEvent = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => { source.connect(); source.setScene("linked"); source.resume(); return () => source.disconnect(); }, [source]);
  // Recording presets only run against the deterministic showcase source.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MUSE_LIVE === "true") return;
    const preset = new URLSearchParams(window.location.search).get("neuro-demo");
    if (!preset) return;
    const timer = window.setTimeout(() => {
      source.setSpeed(4);
      if (preset === "rest") source.inject("fatigued");
      if (preset === "stuck") { source.inject("frustrated"); source.inject("answer-incorrect"); }
      if (preset === "focus") source.inject("focused");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [source]);
  useEffect(() => {
    const event = events.at(-1);
    if (!event) return;
    const key = `${event.timestampMs}-${event.type}-${event.stageId ?? ""}`;
    if (deliveredEvent.current === key) return;
    deliveredEvent.current = key;
    source.receiveEvent({ ...event, timestampMs: snapshot.frame.timestampMs });
  }, [events, snapshot.frame.timestampMs, source]);

  const frame = snapshot.frame;
  const waveform = frame.signal.channels.AF7.waveform;
  const waveformMin = waveform.length ? Math.min(...waveform) : 0;
  const waveformRange = waveform.length ? Math.max(Math.max(...waveform) - waveformMin, 0.001) : 1;
  const waveformPoints = waveform.length
    ? waveform.map((value, index) => `${(index / Math.max(waveform.length - 1, 1)) * 180},${75 - ((value - waveformMin) / waveformRange) * 55}`).join(" ")
    : "0,50 180,50";
  const contacts = Object.entries(frame.signal.channels);
  const connectedContacts = contacts.filter(([, channel]) => channel.quality === "good").length;
  const liveReadout = !frame.qualityGatePassed
    ? "正在重新校準四個接點"
    : frame.inferredState === "focused"
      ? "專注趨勢穩定"
      : frame.inferredState === "frustrated"
        ? "正在偵測理解阻力"
        : frame.inferredState === "fatigued"
          ? "正在偵測能量變化"
          : "正在分析學習節奏";
  const stateLabel = !frame.qualityGatePassed
    ? "CALIBRATING"
    : frame.inferredState === "focused" ? "FOCUSED"
      : frame.inferredState === "frustrated" ? "ATTENTION"
        : frame.inferredState === "fatigued" ? "LOW ENERGY"
          : frame.inferredState === "distracted" ? "REBALANCING"
            : "ANALYZING";
  const metrics = [
    ["EI", frame.normalized.engagement, frame.metrics.engagementIndex],
    ["FAA", frame.normalized.approach, frame.metrics.frontalAlphaAsymmetry],
    ["BPM", frame.metrics.blinkRatePerMinute === null ? null : Math.min(100, frame.metrics.blinkRatePerMinute * 4), frame.metrics.blinkRatePerMinute],
    ["INT", frame.metrics.interestProbability === null ? null : frame.metrics.interestProbability * 100, frame.metrics.interestProbability],
  ] as const;
  const signalEnergy = Math.round(Math.max(24, Math.min(96, frame.normalized.engagement ?? 24)));
  return <div className="neuro-lesson-widget h-full min-h-0" aria-label="Neuro Link 即時訊號與學習劇本">
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-brand-teal/30 bg-gradient-to-br from-brand-teal-bg via-white to-brand-green/10 shadow-sm">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(176px,.8fr)_minmax(0,1.2fr)] gap-2 px-3 pb-3 pt-3">
        <div className="relative min-h-0 overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_76%_38%,#2f7476_0%,#174b53_42%,#103e46_100%)] px-4 py-3 text-white">
          <motion.div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-teal/25 blur-2xl" animate={reducedMotion ? {} : { x: [0, -20, 6, 0], y: [0, 18, -5, 0], scale: [1, 1.12, .92, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div aria-hidden="true" className="absolute -bottom-14 left-[28%] h-36 w-36 rounded-full bg-brand-green/15 blur-2xl" animate={reducedMotion ? {} : { x: [0, 22, 0], y: [0, -16, 0] }} transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }} />
          <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(221,255,251,.7)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative grid h-full grid-cols-[.78fr_1.22fr] items-center gap-1"><div className="flex min-w-0 flex-col justify-center"><p className="text-[9px] font-black tracking-[.2em] text-brand-teal-light">LIVE ANALYSIS</p><output aria-label={`目前投入強度 ${signalEnergy}%`} className="mt-1 font-heading text-[clamp(42px,5.6vh,64px)] font-black leading-none tracking-[-.07em] text-white">{signalEnergy}<small className="ml-1 text-xl tracking-normal text-brand-teal-light">%</small></output><p className="mt-1 text-[9px] font-black tracking-[.14em] text-white/60">ENGAGEMENT</p><div className="mt-3 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-[#0c363d]/35 px-2.5 py-1.5 text-[9px] font-bold text-brand-teal-light backdrop-blur"><WandSparkles size={12} className="shrink-0" /><span className="truncate">{liveReadout}</span></div></div><div className="relative grid h-full place-items-center overflow-hidden"><motion.span aria-hidden="true" className="absolute h-32 w-32 rounded-full border border-brand-teal/55" animate={reducedMotion ? {} : { rotate: 360, scale: [.96, 1.08, .96] }} transition={{ rotate: { duration: 16, repeat: Infinity, ease: "linear" }, scale: { duration: 2.8, repeat: Infinity, ease: "easeInOut" } }} /><motion.span aria-hidden="true" className="absolute h-24 w-24 rounded-full border border-dashed border-brand-green/80" animate={reducedMotion ? {} : { rotate: -360 }} transition={{ duration: 9, repeat: Infinity, ease: "linear" }} /><motion.span aria-hidden="true" className="absolute h-16 w-16 rounded-full bg-brand-teal/20 shadow-[0_0_42px_15px_rgba(122,199,196,.38)]" animate={reducedMotion ? {} : { scale: [.8, 1.22, .8], opacity: [.45, 1, .45] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} /><svg aria-hidden="true" viewBox="0 0 120 120" className="absolute h-32 w-32"><motion.path d="M15 61 C28 61 27 40 40 40 S52 82 65 61 S77 40 90 60 S103 80 112 55" fill="none" stroke="#d8fffa" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: [.3, 1, .3] }} transition={{ duration: reducedMotion ? 0 : 1.8, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }} /></svg><BrainCircuit className="relative text-brand-teal-light drop-shadow-[0_0_16px_rgba(122,199,196,.75)]" size={46} /><span className="absolute bottom-1 text-[8px] font-black tracking-[.18em] text-brand-teal-light">{stateLabel}</span></div></div>
          <div className="absolute inset-x-4 bottom-1.5 flex gap-1" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <motion.i key={index} className="h-0.5 flex-1 rounded-full bg-brand-teal-light" animate={reducedMotion ? { opacity: .55 } : { opacity: [.18, 1, .18], scaleX: [.6, 1, .6] }} transition={{ duration: 1.5, delay: index * .08, repeat: Infinity, ease: "easeInOut" }} />)}</div>
        </div>

        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-brand-teal/15 bg-white/80 p-3 shadow-[0_12px_32px_rgba(47,151,149,.08)]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.08em] text-brand-gray-600"><Activity size={14} className="text-brand-teal" />AF7 SIGNAL FLOW</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-bg px-2 py-1 text-[9px] font-black text-brand-teal-dark"><i className="h-1.5 w-1.5 rounded-full bg-brand-green" />{connectedContacts}/4 CONNECTED</span>
          </div>
          <div className="relative mt-2 min-h-[140px] flex-1 overflow-hidden rounded-2xl border border-brand-teal/10 bg-[radial-gradient(circle_at_80%_42%,rgba(122,199,196,.28),transparent_28%),linear-gradient(135deg,#f9fefd,#edf9f8)]">
            <motion.div aria-hidden="true" className="absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-brand-teal/10 blur-2xl" animate={reducedMotion ? {} : { x: [0, 42, 0], opacity: [.25, .75, .25] }} transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }} />
            <svg viewBox="0 0 180 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" aria-label="AF7 即時腦波波形">
              <path d="M0 20H180M0 40H180M0 60H180M0 80H180" stroke="#cce8e5" strokeWidth=".8" />
              <path d="M0 50H180" stroke="#7ac7c4" strokeWidth="1.1" strokeDasharray="3 4" />
              <motion.polyline points={waveformPoints} fill="none" stroke="#278f8e" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" animate={reducedMotion ? {} : { opacity: [.7, 1, .7] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
              <motion.line x1="0" x2="180" y1="0" y2="0" stroke="#58cc02" strokeWidth="1.2" strokeOpacity=".7" animate={reducedMotion ? {} : { y: [0, 100] }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
            </svg>
            <div className="absolute left-3 top-3 rounded-full border border-brand-teal/15 bg-white/70 px-2 py-1 text-[8px] font-black tracking-[.14em] text-brand-teal-dark backdrop-blur">LIVE SCAN</div>
            <div className="absolute bottom-2 right-2 h-[92px] w-[92px] rounded-2xl border border-white/70 bg-white/55 p-1.5 backdrop-blur-sm" aria-label={`${connectedContacts} 個接點訊號良好`}>
              <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full"><path d="M50 22V50M50 50H25M50 50H75M50 50V78" fill="none" stroke="#7ac7c4" strokeWidth="1.3" strokeDasharray="3 3" /><ellipse cx="50" cy="50" rx="21" ry="14" fill="none" stroke="#7ac7c4" strokeWidth="1.5" opacity=".6" /><motion.circle cx="50" cy="50" r="4" fill="none" stroke="#58cc02" strokeWidth="1.5" animate={reducedMotion ? {} : { r: [4, 32], opacity: [.85, 0] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }} /></svg>
              {contacts.map(([channel, data], index) => <motion.span key={channel} animate={data.quality === "good" && !reducedMotion ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 1.7, delay: index * .14, repeat: data.quality === "good" && !reducedMotion ? Infinity : 0, ease: "easeInOut" }} className={`absolute grid h-6 w-6 place-items-center rounded-full border text-[6px] font-black shadow-sm ${data.quality === "good" ? "border-brand-green bg-brand-green/20 text-brand-gray-700" : data.quality === "fair" ? "border-brand-teal bg-brand-teal-bg text-brand-gray-700" : "border-brand-gray-400 bg-brand-gray-100 text-brand-gray-600"} ${["left-1 top-1/2 -translate-y-1/2", "left-1/2 top-1 -translate-x-1/2", "right-1 top-1/2 -translate-y-1/2", "bottom-1 left-1/2 -translate-x-1/2"][index]}`}>{channel}</motion.span>)}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">{metrics.map(([label, progress, value], index) => <motion.div key={label} animate={reducedMotion ? {} : { y: [0, index % 2 ? -1 : 1, 0] }} transition={{ duration: 2.1 + index * .18, repeat: Infinity, ease: "easeInOut" }} className="relative min-w-0 overflow-hidden rounded-xl border border-brand-teal/10 bg-brand-teal-bg/55 px-1.5 py-1.5 text-center"><svg viewBox="0 0 28 28" className="mx-auto h-8 w-8 -rotate-90" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="#d8efed" strokeWidth="3" /><circle cx="14" cy="14" r="10" fill="none" stroke="#58CC02" strokeWidth="3" pathLength="100" strokeDasharray={`${frame.qualityGatePassed && progress !== null ? Math.max(4, Math.min(100, progress)) : 0} 100`} strokeLinecap="round" /></svg><p className="text-[8px] font-black tracking-[.08em] text-brand-gray-500">{label}</p><p className="mt-.5 truncate text-[10px] font-black text-brand-gray-700">{frame.qualityGatePassed && value !== null ? value.toFixed(1) : "—"}</p></motion.div>)}</div>
        </div>
      </div>
    </section>
    <CompetitionExperienceOverlay plan={plan} events={events} source={source} />
  </div>;
}
