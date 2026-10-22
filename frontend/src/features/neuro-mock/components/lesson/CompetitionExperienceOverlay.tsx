"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BrainCircuit, CirclePause, Lightbulb, Orbit, Sparkles, Waves, X, Zap } from "lucide-react";
import type { NeuroLabSource, NeuroLearningEvent, Proposal } from "../../contract";
import { NeuroConnectionCompanion } from "./NeuroConnectionCompanion";

export type CompetitionExperiencePlan = {
  version: "competition-neuro-v1";
  seed: number;
  nodeId: string;
  stageIndex: number;
  component: string;
  onboarding: boolean;
  baselineSeconds: number;
  visualMode: string;
  title: string;
  objective: string;
  alternate: { label: string; headline: string; detail: string };
};

export function readCompetitionExperiencePlan(value: unknown): CompetitionExperiencePlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<CompetitionExperiencePlan>;
  return plan.version === "competition-neuro-v1" && typeof plan.seed === "number" && typeof plan.nodeId === "string" && typeof plan.stageIndex === "number" && typeof plan.title === "string" && typeof plan.objective === "string" && !!plan.alternate ? plan as CompetitionExperiencePlan : null;
}

type Moment = "focused" | "frustrated" | "recovered" | "idle";
type FrameSide = "top" | "right" | "bottom" | "left";

function frameSidePoints(values: number[], side: FrameSide, amplitude: number, offset = 0) {
  const count = 36;
  const source = values.length ? values : Array.from({ length: count }, (_, index) => Math.sin(index * .72));
  const minimum = Math.min(...source);
  const rawRange = Math.max(...source) - minimum;
  const corners = { top: [[22, 22], [1418, 22]], right: [[1418, 22], [1418, 878]], bottom: [[1418, 878], [22, 878]], left: [[22, 878], [22, 22]] } as const;
  return Array.from({ length: count }, (_, index) => {
    if (index === 0 || index === count - 1) {
      const corner = corners[side][index === 0 ? 0 : 1];
      return { x: corner[0], y: corner[1] };
    }
    const sourceIndex = Math.floor((index / (count - 1)) * (source.length - 1));
    const energy = rawRange < .001 ? .5 : (source[(sourceIndex + offset) % source.length] - minimum) / rawRange;
    const value = (energy - .5) * 2;
    const progress = index / (count - 1);
    if (side === "top") return { x: 22 + progress * 1396, y: 22 + value * amplitude };
    if (side === "right") return { x: 1418 - value * amplitude, y: 22 + progress * 856 };
    if (side === "bottom") return { x: 1418 - progress * 1396, y: 878 - value * amplitude };
    return { x: 22 + value * amplitude, y: 878 - progress * 856 };
  });
}

function closedSmoothFramePath(points: Array<{ x: number; y: number }>) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    const controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const controlTwo = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    path += ` C ${controlOne.x} ${controlOne.y} ${controlTwo.x} ${controlTwo.y} ${next.x} ${next.y}`;
  }
  return `${path} Z`;
}

function continuousFramePath(values: number[], amplitude: number) {
  const sides: FrameSide[] = ["top", "right", "bottom", "left"];
  const points = sides.flatMap((side, index) => frameSidePoints(values, side, amplitude, index * 7).slice(index ? 1 : 0, index === sides.length - 1 ? -1 : undefined));
  return closedSmoothFramePath(points);
}

function mixRgb(from: number[], to: number[], progress: number) {
  const ratio = Math.max(0, Math.min(1, progress));
  return from.map((value, index) => Math.round(value + (to[index] - value) * ratio));
}

function proposalPresentation(proposal: Proposal, objective: string) {
  switch (proposal.action) {
    case "suggest_break": return { eyebrow: "NEURO CHECK-IN", title: "先休息 30 秒", detail: "持續低投入與疲勞趨勢已達提醒門檻，短暫換個節奏再回來", accept: "開始休息", icon: CirclePause, tone: "bg-gradient-to-br from-[#d9e7f1]/95 via-[#cfe4df]/94 to-[#b8d6ce]/90 text-brand-gray-700", action: "break" as const };
    case "change_question": return { eyebrow: "NEURO CHECK-IN", title: "換個方式看這一題", detail: `保留 ${objective} 的學習目標，改用另一個視角重新理解`, accept: "切換視角", icon: Orbit, tone: "bg-gradient-to-br from-[#d7eeee]/95 via-[#bfe2de]/94 to-[#cde4d8]/90 text-brand-gray-700", action: "alternate" as const };
    case "offer_hint":
    case "simplify_explanation": return { eyebrow: "NEURO CHECK-IN", title: "要不要先看一個線索", detail: "系統偵測到這個步驟停留較久，先抓住一個關鍵點再繼續", accept: "顯示線索", icon: Lightbulb, tone: "bg-gradient-to-br from-[#d8f1ef]/95 via-[#b7e5e2]/94 to-[#d5eee5]/90 text-brand-gray-700", action: "support" as const };
    default: return { eyebrow: "NEURO CHECK-IN", title: "先把步伐放慢一點", detail: "投入趨勢低於你的穩定區間，下一步可以從一個小線索開始", accept: "給我一個線索", icon: Sparkles, tone: "bg-gradient-to-br from-[#d8f1ef]/95 via-[#b7e5e2]/94 to-[#d5eee5]/90 text-brand-gray-700", action: "support" as const };
  }
}

export function CompetitionExperienceOverlay({ plan, events, source }: { plan: CompetitionExperiencePlan; events: NeuroLearningEvent[]; source: NeuroLabSource }) {
  const reduce = useReducedMotion();
  const sourceSnapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [mounted, setMounted] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [moment, setMoment] = useState<Moment>("idle");
  const [showSupport, setShowSupport] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [showAlternate, setShowAlternate] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const handledEvent = useRef<string | null>(null);
  const playedOnboarding = useRef(false);
  const incorrectCount = useRef(0);
  const liveState = sourceSnapshot.frame.qualityGatePassed ? sourceSnapshot.frame.inferredState : "poor_signal";
  const ambientState = moment === "frustrated" ? "frustrated" : moment === "recovered" ? "recovered" : liveState;
  const ambient = {
    // Stable teal has the smallest amplitude. Green is reserved for recovery and confirmed contact.
    focused: { color: "#54b9b6", secondary: "#7acb52", intensity: .48, speed: 7.2, drift: 12, spread: 1.04 },
    // Cool blue-teal drifts sideways to signal attention moving without framing it as an error.
    distracted: { color: "#69aebe", secondary: "#b7d8d0", intensity: .44, speed: 4.5, drift: 54, spread: 1.14 },
    // Coral appears only at the edges and pulses quickly; it never turns the page into an alarm.
    frustrated: { color: "#e8734a", secondary: "#f2b47e", intensity: .58, speed: 1.65, drift: 15, spread: 1.08 },
    // Desaturated slate fades downward with a long cycle to convey low energy rather than urgency.
    fatigued: { color: "#8ca7ae", secondary: "#b9d7d3", intensity: .31, speed: 9.2, drift: 8, spread: .98 },
    recovered: { color: "#62bd54", secondary: "#67bbb8", intensity: .43, speed: 5.4, drift: 24, spread: 1.06 },
    calibrating: { color: "#72c3c0", secondary: "#e5f5f2", intensity: .25, speed: 7.4, drift: 12, spread: 1 },
    poor_signal: { color: "#a7b7bb", secondary: "#d5e4e3", intensity: .21, speed: 9.5, drift: 5, spread: .96 },
  }[ambientState];
  const waveAmplitude = ambientState === "frustrated" ? 1.36 : ambientState === "distracted" ? 1.2 : ambientState === "fatigued" ? .78 : 1;
  const frameAmplitude = ({ focused: 3, distracted: 12, frustrated: 18, fatigued: 2, recovered: 5, calibrating: 5, poor_signal: 2 }[ambientState]) * (sourceSnapshot.frame.qualityGatePassed ? 1 : .72);
  const frameSignal = sourceSnapshot.frame.signal.channels.AF7.waveform;
  const focusLevel = Math.max(0, Math.min(100, sourceSnapshot.frame.normalized.engagement ?? 50));
  const fatigueLevel = Math.max(0, Math.min(100, sourceSnapshot.frame.normalized.fatigue ?? 0));
  let lineRgb = mixRgb([127, 151, 182], [104, 176, 164], focusLevel / 100);
  if (ambientState === "distracted") lineRgb = mixRgb(lineRgb, [124, 151, 180], .42);
  if (ambientState === "frustrated") lineRgb = mixRgb(lineRgb, [191, 143, 124], .56);
  if (ambientState === "recovered") lineRgb = mixRgb(lineRgb, [113, 176, 138], .28);
  lineRgb = mixRgb(lineRgb, [153, 165, 175], Math.max(0, (fatigueLevel - 35) / 100));
  if (!sourceSnapshot.frame.qualityGatePassed) lineRgb = [158, 174, 177];
  const lineTone = `rgb(${lineRgb.join(" ")})`;
  const lineToneGlow = `rgb(${lineRgb.join(" ")} / .24)`;
  const lineToneFaint = `rgb(${lineRgb.join(" ")} / .12)`;
  const framePath = continuousFramePath(frameSignal, frameAmplitude);
  const frameFillPath = `M 0 0 H 1440 V 900 H 0 Z ${framePath}`;
  const activeProposal = !onboarding ? sourceSnapshot.proposal : null;
  const proposalVisual = activeProposal ? proposalPresentation(activeProposal, plan.objective) : null;
  const acceptProposal = () => {
    if (!activeProposal || !proposalVisual) return;
    source.decide("accepted");
    if (proposalVisual.action === "break") setShowBreak(true);
    if (proposalVisual.action === "alternate") setShowAlternate(true);
    if (proposalVisual.action === "support") setShowSupport(true);
    setMoment("recovered");
  };

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  useEffect(() => {
    incorrectCount.current = 0;
    setShowSupport(false);
    setShowChoice(false);
    setShowAlternate(false);
    setShowBreak(false);
    setMoment("idle");
  }, [plan.nodeId, plan.stageIndex]);
  useEffect(() => {
    if (!plan.onboarding || playedOnboarding.current) return;
    playedOnboarding.current = true;
    setOnboarding(true);
    source.inject("focused");
  }, [plan.onboarding, source]);
  useEffect(() => {
    if (!onboarding) return;
    const timers = [900, 2200, 4100, 6100].map((delay, index) => window.setTimeout(() => setOnboardingStep(index + 1), reduce ? 0 : delay));
    const done = window.setTimeout(() => setOnboarding(false), reduce ? 0 : 8200);
    return () => { timers.forEach(window.clearTimeout); window.clearTimeout(done); };
  }, [onboarding, reduce]);
  useEffect(() => {
    const event = events.at(-1);
    if (!event) return;
    const key = `${event.timestampMs}-${event.type}-${event.stageId ?? ""}`;
    if (handledEvent.current === key) return;
    handledEvent.current = key;
    if (event.type === "answer_correct") {
      setMoment("focused"); setShowSupport(false); setShowChoice(false); source.inject("recovered");
      const timer = window.setTimeout(() => { setMoment("idle"); source.inject(null); }, reduce ? 0 : 2300);
      return () => window.clearTimeout(timer);
    }
    if (event.type === "hint_requested") {
      setMoment("recovered"); setShowSupport(true); source.inject("recovered");
      return;
    }
    if (event.type === "answer_incorrect") {
      incorrectCount.current += 1;
      setMoment("frustrated"); source.inject("frustrated");
      if (incorrectCount.current >= 2) setShowChoice(true); else setShowSupport(true);
    }
  }, [events, reduce, source]);
  if (!mounted) return null;
  return createPortal(<>
    {!onboarding && <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : .7 }} className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <motion.div className="absolute inset-0" style={{ background: `radial-gradient(circle at ${ambientState === "fatigued" ? "50% 112%" : "8% 8%"}, ${lineToneGlow}, transparent 30%), radial-gradient(circle at ${ambientState === "distracted" ? "95% 46%" : "92% 88%"}, ${lineToneFaint}, transparent 32%)` }} animate={reduce ? { opacity: ambient.intensity } : { opacity: [ambient.intensity * .55, ambient.intensity, ambient.intensity * .55] }} transition={{ duration: ambient.speed, repeat: Infinity, ease: "easeInOut" }} />
      <motion.svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" animate={reduce ? { opacity: ambient.intensity } : { opacity: [ambient.intensity * .5, ambient.intensity, ambient.intensity * .5] }} transition={{ duration: ambient.speed, repeat: Infinity, ease: "easeInOut" }}>
        <motion.path d={frameFillPath} fillRule="evenodd" clipRule="evenodd" stroke="none" animate={reduce ? { fill: lineTone, opacity: .38 } : { fill: lineTone, opacity: [.26, .46, .26] }} transition={{ fill: { duration: .62, ease: "easeOut" }, opacity: { duration: ambient.speed, repeat: Infinity, ease: "easeInOut" } }} />
        <motion.path d={framePath} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" animate={reduce ? { stroke: lineTone, opacity: .38 } : { stroke: lineTone, opacity: [.26, .46, .26] }} transition={{ stroke: { duration: .62, ease: "easeOut" }, opacity: { duration: ambient.speed, repeat: Infinity, ease: "easeInOut" } }} />
      </motion.svg>
    </motion.div>}

    <AnimatePresence>
      {onboarding && <motion.section initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(18px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#e5f0f2]/75 p-4 text-brand-gray-800" aria-label="Neuro Link 連線">
        <motion.div aria-hidden="true" initial={{ x: "-35%", opacity: 0 }} animate={reduce ? { opacity: .7 } : { x: ["-35%", "15%", "-5%"], opacity: [.1, .8, .45] }} transition={{ duration: reduce ? 0 : 7.5, ease: "easeInOut" }} className="absolute h-[72vmin] w-[72vmin] rounded-full bg-brand-teal/25 blur-3xl" />
        <motion.div aria-hidden="true" initial={{ x: "45%", opacity: 0 }} animate={reduce ? { opacity: .45 } : { x: ["45%", "4%", "26%"], opacity: [.05, .5, .25] }} transition={{ duration: reduce ? 0 : 8.2, ease: "easeInOut" }} className="absolute h-[64vmin] w-[64vmin] rounded-full bg-brand-green/20 blur-3xl" />
        <motion.div aria-hidden="true" animate={reduce ? {} : { rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} className="absolute h-[82vmin] w-[82vmin] rounded-full border border-brand-teal/25 border-dashed" />
        <div className="relative w-full max-w-5xl translate-y-[7vh] px-2 sm:translate-y-[8vh] sm:px-6">
          <div className="relative">
            <div className="relative mx-auto h-[500px] w-full max-w-[820px] overflow-visible sm:h-[590px]">
              <motion.div aria-hidden="true" initial={{ opacity: 0, scale: .65 }} animate={reduce ? { opacity: .7, scale: 1 } : { opacity: onboardingStep >= 2 ? [.45, 1, .45] : .3, scale: onboardingStep >= 2 ? [1, 1.14, 1] : 1 }} transition={{ duration: 2.2, repeat: onboardingStep >= 2 && !reduce ? Infinity : 0 }} className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-teal/45" />
              <motion.div aria-hidden="true" initial={{ rotate: -20, opacity: 0 }} animate={reduce ? { opacity: .5 } : { rotate: 340, opacity: .65 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-green" />
              <motion.div initial={{ y: reduce || onboardingStep >= 1 ? 0 : -250, opacity: reduce || onboardingStep >= 1 ? 1 : 0 }} animate={{ y: reduce || onboardingStep >= 1 ? 0 : -250, opacity: reduce || onboardingStep >= 1 ? 1 : 0 }} transition={{ type: "spring", damping: 15, stiffness: 110 }} className="absolute inset-x-0 bottom-[46px] h-[465px] sm:h-[535px]"><NeuroConnectionCompanion step={onboardingStep} reduced={!!reduce} /></motion.div>
              <AnimatePresence>{onboardingStep === 0 && <motion.div initial={{ opacity: 0, y: -80 }} animate={reduce ? { opacity: 1, y: 0 } : { opacity: [0, 1, 1, 0], y: [-80, 70, 260, 420] }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.5, repeat: Infinity, repeatDelay: .3 }} className="absolute inset-x-8 top-8 h-1 rounded-full bg-brand-teal shadow-[0_0_24px_8px_rgba(122,199,196,.6)]" />}</AnimatePresence>
            </div>
            <div className="relative z-20 mt-16 text-center sm:mt-24"><AnimatePresence mode="wait"><motion.h2 key={onboardingStep} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -12 }} transition={{ duration: reduce ? 0 : .35 }} className="font-heading text-4xl font-black leading-none text-[#0B4E56] drop-shadow-[0_4px_14px_rgba(28,97,103,.2)] sm:text-6xl">{onboardingStep < 1 ? "正在搜尋頭帶" : onboardingStep < 2 ? "正在戴上頭帶" : onboardingStep < 3 ? "正在校準接點" : <span className="text-brand-teal-dark">連線完成</span>}</motion.h2></AnimatePresence><motion.div aria-hidden="true" animate={onboardingStep >= 4 && !reduce ? { y: [0, -4, 0], opacity: [.55, 1, .55] } : { opacity: onboardingStep >= 4 ? 1 : .3 }} transition={{ duration: reduce ? 0 : 2.8, repeat: onboardingStep >= 4 && !reduce ? Infinity : 0, ease: "easeInOut" }} className="mt-4 flex items-center justify-center gap-3">{[0, 1, 2, 3, 4].map((index) => <i key={index} className={`block rounded-full ${index === 2 ? "h-2.5 w-2.5" : "h-1.5 w-1.5"} ${onboardingStep >= 4 ? "bg-brand-green" : "bg-brand-teal"}`} />)}</motion.div></div>
          </div>
          <div aria-label={`Neuro Link 連線進度，第 ${Math.min(4, onboardingStep + 1)} 步，共四步`} className="mx-auto mt-1 flex max-w-sm items-center justify-center gap-2">{[0,1,2,3].map((index) => <motion.i key={index} animate={{ opacity: onboardingStep >= index ? 1 : .22, scale: onboardingStep === index ? [1, 1.35, 1] : 1 }} transition={{ duration: reduce ? 0 : .8, repeat: onboardingStep === index && !reduce ? Infinity : 0 }} className={`block h-2.5 rounded-full ${onboardingStep > index ? "w-10 bg-brand-teal" : "w-2.5 bg-brand-teal"}`} />)}</div>
        </div>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence>
      {activeProposal && proposalVisual && <motion.section initial={{ opacity: 0, scale: reduce ? 1 : .9, y: reduce ? 0 : 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reduce ? 0 : .94, y: reduce ? 0 : 16 }} className="pointer-events-none fixed inset-0 z-[65] grid place-items-center bg-[#103840]/18 p-5 backdrop-blur-[5px]" role="dialog" aria-modal="true" aria-labelledby="neuro-checkin-title">
        <motion.div className={`pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[32px] border border-brand-teal/25 p-6 shadow-[0_28px_90px_rgba(15,58,65,.25)] backdrop-blur-2xl ${proposalVisual.tone}`} animate={reduce ? {} : { y: [0, -3, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}>
          <motion.div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-teal/20 blur-3xl" animate={reduce ? {} : { scale: [.85, 1.2, .85], opacity: [.4, .9, .4] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/60 ring-1 ring-brand-teal/20"><proposalVisual.icon size={28} aria-hidden="true" /></span><div><p className="text-[10px] font-black tracking-[.18em] text-brand-teal-dark">{proposalVisual.eyebrow}</p><h2 id="neuro-checkin-title" className="mt-1 font-heading text-3xl font-black leading-tight">{proposalVisual.title}</h2><p className="mt-3 text-sm leading-6 text-brand-gray-600">{proposalVisual.detail}</p></div></div><div className="mt-5 rounded-2xl border border-brand-teal/15 bg-white/45 px-3 py-2 text-[11px] font-semibold leading-5 text-brand-gray-600">{activeProposal.reason}</div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={acceptProposal} className="min-h-11 rounded-2xl bg-brand-teal px-4 text-sm font-black text-brand-gray-800 shadow-sm">{proposalVisual.accept}</button><button type="button" onClick={() => source.decide("declined")} className="min-h-11 rounded-2xl border border-brand-teal/30 bg-white/45 px-4 text-sm font-bold text-brand-gray-700">我想繼續</button></div></div>
        </motion.div>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence>
      {showSupport && !showChoice && <motion.section initial={{ opacity: 0, x: reduce ? 0 : 48, scale: .92 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: reduce ? 0 : 48 }} className="fixed bottom-5 right-5 z-[60] w-[min(420px,calc(100vw-40px))] overflow-hidden rounded-[28px] border-2 border-brand-teal bg-white p-5 shadow-[0_24px_75px_rgba(28,73,80,.32)]" aria-label="Neuro 即時支援">
        <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#7AC7C4,#58CC02,#7AC7C4)]" /><div className="flex gap-3"><motion.div animate={reduce ? {} : { rotate: [0,-12,12,0] }} transition={{ duration: .55, repeat: 2 }} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-teal text-brand-gray-700"><Sparkles size={26} /></motion.div><div><p className="text-[10px] font-black tracking-[.16em] text-brand-teal-dark">NEURO BOOST</p><h3 className="mt-1 font-heading text-xl font-black text-brand-gray-800">停一下，我們換一條更亮的路。</h3><p className="mt-2 text-sm leading-6 text-brand-gray-600">先抓住 <strong>{plan.objective}</strong> 的一個核心步驟，再回來完成這一題。</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { setMoment("recovered"); source.inject("recovered"); }} className="min-h-11 rounded-2xl bg-brand-teal px-4 text-sm font-bold text-brand-gray-700">看視覺提示</button><button onClick={() => setShowSupport(false)} className="min-h-11 rounded-2xl border border-brand-gray-200 px-4 text-sm font-bold">我想先自己試</button></div>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence>
      {showChoice && <motion.section initial={{ opacity: 0, y: reduce ? 0 : 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : 80 }} className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-3xl rounded-t-[34px] border-x border-t border-brand-coral bg-white p-6 shadow-[0_-20px_80px_rgba(32,54,58,.32)] sm:bottom-6 sm:rounded-[34px]" aria-label="Neuro 選擇路徑">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black tracking-[.18em] text-brand-coral">LEVEL 3 / REROUTE THE MOMENT</p><h3 className="mt-2 font-heading text-3xl font-black text-brand-gray-800">這一關還有另一條路。</h3><p className="mt-2 text-sm text-brand-gray-600">保留原題，同時用另一個視角重新理解它。</p></div><button className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-gray-200" onClick={() => setShowChoice(false)} aria-label="關閉選擇"><X size={18} /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={() => { setShowChoice(false); setShowAlternate(true); setMoment("recovered"); source.inject("recovered"); }} className="min-h-[88px] rounded-3xl bg-brand-teal p-4 text-left font-heading font-black text-brand-gray-800"><Orbit className="mb-2" />切進視覺模式</button><button onClick={() => { setShowChoice(false); setShowSupport(true); }} className="min-h-[88px] rounded-3xl border border-brand-teal-light bg-brand-teal-bg p-4 text-left font-heading font-black"><Lightbulb className="mb-2" />先看一個線索</button><button onClick={() => { setShowChoice(false); setShowBreak(true); }} className="min-h-[88px] rounded-3xl border border-brand-gray-200 p-4 text-left font-heading font-black"><CirclePause className="mb-2" />換 30 秒節奏</button></div>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence>
      {showAlternate && <motion.section initial={{ opacity: 0, scale: reduce ? 1 : .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : .92 }} className="fixed inset-0 z-[75] grid place-items-center overflow-auto bg-[#102d35]/95 p-5 text-white" aria-label="視覺化替代呈現">
        <div className="w-full max-w-5xl rounded-[40px] border border-white/20 bg-white/10 p-6 shadow-[0_30px_100px_rgba(0,0,0,.48)] backdrop-blur-xl sm:p-10"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-brand-teal px-3 py-1 text-[10px] font-black tracking-[.15em] text-brand-gray-800">{plan.alternate.label}</span><button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30" onClick={() => setShowAlternate(false)} aria-label="回到原本題目"><X size={19} /></button></div><div className="mt-8 grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center"><div><p className="text-xs font-bold tracking-[.2em] text-brand-teal-light">SAME OBJECTIVE / NEW CAMERA</p><h2 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">{plan.alternate.headline}</h2><p className="mt-5 text-sm leading-7 text-white/75">{plan.alternate.detail}</p><button onClick={() => setShowAlternate(false)} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand-teal px-5 font-bold text-brand-gray-800">帶著這個線索回原題 <ArrowRight size={18} /></button></div><div className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[30px] border border-brand-teal/50 bg-[radial-gradient(circle_at_50%_40%,rgba(122,199,196,.45),transparent_36%),linear-gradient(135deg,#0a1d22,#1c4e56)]"><motion.div animate={reduce ? {} : { rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} className="absolute h-72 w-72 rounded-full border border-dashed border-brand-teal" />{[0,1,2,3,4].map(index => <motion.div key={index} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0, scale: [1, 1.08, 1] }} transition={{ delay: reduce ? 0 : index * .22, duration: reduce ? 0 : 1.2, repeat: reduce ? 0 : Infinity, repeatDelay: 1.2 }} className="relative z-10 mb-2 flex w-[74%] items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-teal font-black text-brand-gray-800">{index + 1}</span><i className="h-3 flex-1 rounded-full bg-gradient-to-r from-brand-teal via-brand-green to-white/30" /><Zap size={18} className="text-brand-coral" /></motion.div>)}</div></div></div>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence>
      {showBreak && <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] grid place-items-center bg-[#102d35]/90 p-5 text-white" aria-label="Neuro 節奏重整"><div className="text-center"><motion.div animate={reduce ? {} : { scale: [1, 1.26, 1], opacity: [.55, 1, .55] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto grid h-52 w-52 place-items-center rounded-full border-[14px] border-brand-teal shadow-[0_0_100px_24px_rgba(122,199,196,.35)]"><Waves size={64} /></motion.div><p className="mt-10 text-xs font-black tracking-[.2em] text-brand-teal-light">RESET THE RHYTHM</p><h2 className="mt-3 font-heading text-4xl font-black">停 30 秒，讓下一步更清楚。</h2><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/75">原題保持在背景，隨時可以回來。</p><button onClick={() => { setShowBreak(false); setMoment("recovered"); source.inject("recovered"); }} className="mt-8 min-h-12 rounded-2xl bg-brand-teal px-6 font-bold text-brand-gray-800">立即回到挑戰</button></div></motion.section>}
    </AnimatePresence>
  </>, document.body);
}
