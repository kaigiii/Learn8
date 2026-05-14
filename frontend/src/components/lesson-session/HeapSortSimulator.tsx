"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { RefreshCw, Play, Pause, Gauge, Terminal } from "lucide-react";

export interface HeapSortSimulatorProps extends QuestionStageMeta {
  initialArray: number[];
  title: string;
  explanation: string;
  messages?: {
    ready?: string;
    building?: string;
    sorting?: string;
    done?: string;
  };
  onContinue: () => void;
  onSkip?: () => void;
}

export default function HeapSortSimulator({
  stageIndex, totalStages, stageLabel, topic, difficulty, recommendedDurationMinutes,
  initialArray, title, explanation, messages, onContinue, onSkip,
}: HeapSortSimulatorProps) {
  const defaultMessages = {
    ready: "準備就緒。點擊「運行模擬」。",
    building: "正在建立最大堆積...",
    sorting: "開始循環提取根節點...",
    done: "排序完成！"
  };
  const msg = { ...defaultMessages, ...messages };

  const [data, setData] = useState(() => initialArray.map((v, i) => ({ id: i, val: v })));
  const [heapSize, setHeapSize] = useState(initialArray.length);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const [swapping, setSwapping] = useState<[number, number] | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [stepDescription, setStepDescription] = useState(msg.ready);
  const [currentStepLabel, setCurrentStepLabel] = useState("READY");
  const [isComplete, setIsComplete] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const isAutoPlayingRef = useRef(false);

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms / playbackSpeed));

  const runHeapSort = async () => {
    if (isAutoPlaying) return;
    setIsAutoPlaying(true); isAutoPlayingRef.current = true;
    let currentData = [...data];
    let n = currentData.length;
    setCurrentStepLabel("BUILDING"); setStepDescription(msg.building);
    await delay(1200);
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      if (!isAutoPlayingRef.current) return;
      await heapify(currentData, n, i);
    }
    setCurrentStepLabel("SORTING"); setStepDescription(msg.sorting);
    await delay(1200);
    for (let i = n - 1; i > 0; i--) {
      if (!isAutoPlayingRef.current) return;
      setSwapping([0, i]);
      await delay(600); 
      [currentData[0], currentData[i]] = [currentData[i], currentData[0]];
      setData([...currentData]);
      await delay(850); 
      setSwapping(null);
      n--; setHeapSize(n);
      await delay(600);
      await heapify(currentData, n, 0);
    }
    setIsAutoPlaying(false); isAutoPlayingRef.current = false;
    setIsComplete(true); setCurrentStepLabel("DONE"); setStepDescription(msg.done);
  };

  const heapify = async (arr: {id: number, val: number}[], n: number, i: number) => {
    let largest = i; const l = 2 * i + 1; const r = 2 * i + 2;
    setActiveIndices([i, l, r].filter(idx => idx < n));
    await delay(400);
    if (l < n && arr[l].val > arr[largest].val) largest = l;
    if (r < n && arr[r].val > arr[largest].val) largest = r;
    if (largest !== i) {
      setSwapping([i, largest]);
      await delay(600);
      [arr[i], arr[largest]] = [arr[largest], arr[i]];
      setData([...arr]);
      await delay(850);
      setSwapping(null);
      await delay(300);
      await heapify(arr, n, largest);
    } else { setActiveIndices([]); }
  };

  const reset = () => {
    isAutoPlayingRef.current = false; setIsAutoPlaying(false);
    const initialData = initialArray.map((v, i) => ({ id: i, val: v }));
    setData(initialData); setHeapSize(initialArray.length); setActiveIndices([]);
    setSwapping(null); setIsComplete(false); setCurrentStepLabel("READY"); setStepDescription(msg.ready);
  };

  const getCoords = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const posInLevel = index - (Math.pow(2, level) - 1);
    const levelWidth = Math.pow(2, level);
    const x = (posInLevel + 0.5) * (100 / levelWidth);
    const y = (level + 1) * 24; 
    return { x, y };
  };

  const progress = ((initialArray.length - heapSize) / (initialArray.length - 1)) * 100;

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex} totalStages={totalStages} stageLabel={stageLabel} topic={topic}
          difficulty={difficulty} recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-brand-teal" accentTextClassName="text-brand-teal"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pb-10">
          <div className="lg:col-span-7 flex flex-col gap-5 min-h-[600px]">
             <motion.div className="flex-none rounded-3xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur">
               <div className="flex justify-between items-start gap-4">
                 <div className="flex-1">
                   <h3 className="text-lg font-bold text-brand-gray-700 font-heading">{title}</h3>
                   <p className="mt-2 text-xs font-medium text-brand-gray-600">{explanation}</p>
                 </div>
                 <QuestionVoiceReader text={`${title}. ${explanation}`} />
               </div>
               <div className="mt-4 overflow-hidden rounded-xl bg-slate-900 border border-white/10 ring-1 ring-brand-teal/20">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-white/5">
                     <Terminal className="w-3 h-3 text-brand-teal" />
                     <span className="text-[9px] font-black uppercase text-brand-teal">Simulator Console</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                     <div className="px-2 py-0.5 rounded bg-brand-teal/20 border border-brand-teal/30 text-[10px] font-black text-brand-teal animate-pulse">{currentStepLabel}</div>
                     <span className="text-sm font-bold text-slate-200 truncate">{stepDescription}</span>
                  </div>
               </div>
             </motion.div>

             <div className="flex-1 relative bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border-4 border-slate-900">
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#7AC7C4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
               <div className="w-full h-full relative">
                 <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                   <defs><filter id="glow-yellow-sim" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs>
                   {data.map((_, i) => {
                     if (i >= heapSize && !isComplete) return null;
                     const left = 2 * i + 1; const right = 2 * i + 2; const p = getCoords(i);
                     const limit = isComplete ? data.length : heapSize;
                     return (
                       <g key={`l-sim-${i}`}>
                         {left < limit && <motion.line animate={{ stroke: isComplete ? "#58CC02" : "#7AC7C4", strokeOpacity: 0.15 }} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${getCoords(left).x}%`} y2={`${getCoords(left).y}%`} strokeWidth="1.5" strokeDasharray="4 4" />}
                         {right < limit && <motion.line animate={{ stroke: isComplete ? "#58CC02" : "#7AC7C4", strokeOpacity: 0.15 }} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${getCoords(right).x}%`} y2={`${getCoords(right).y}%`} strokeWidth="1.5" strokeDasharray="4 4" />}
                       </g>
                     );
                   })}
                   <AnimatePresence>{swapping && <motion.line initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} x1={`${getCoords(swapping[0]).x}%`} y1={`${getCoords(swapping[0]).y}%`} x2={`${getCoords(swapping[1]).x}%`} y2={`${getCoords(swapping[1]).y}%`} stroke="#FACC15" strokeWidth="5" strokeLinecap="round" filter="url(#glow-yellow-sim)" />}</AnimatePresence>
                 </svg>
                 {data.map((item, i) => {
                    const { x, y } = getCoords(i); const isActive = activeIndices.includes(i); const isSwapping = swapping?.includes(i); const isSorted = isComplete || i >= heapSize;
                    return (
                      <motion.div key={`n-sim-${item.id}`} layout animate={{ left: `${x}%`, top: `${y}%`, x: "-50%", y: "-50%" }} transition={{ layout: { type: "tween", ease: "easeInOut", duration: 0.8 }, left: { type: "tween", ease: "easeInOut", duration: 0.8 }, top: { type: "tween", ease: "easeInOut", duration: 0.8 } }} className="absolute z-10">
                        <motion.div animate={{ scale: isSwapping ? 1.25 : isActive ? 1.15 : 1, backgroundColor: isSorted ? "#58CC02" : isSwapping ? "#EAB308" : isActive ? "rgba(250, 204, 21, 0.3)" : "rgba(255,255,255,0.05)", borderColor: isSorted ? "#58CC02" : isSwapping ? "#FACC15" : isActive ? "#FACC15" : "rgba(255,255,255,0.15)", boxShadow: isSorted ? "0 0 20px rgba(88, 204, 2, 0.3)" : isSwapping ? "0 0 35px rgba(250, 204, 21, 0.5)" : "none" }} className="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-black shadow-lg backdrop-blur-sm"><span className={isSorted || isSwapping || isActive ? "text-white" : "text-slate-400"}>{item.val}</span></motion.div>
                        {i === 0 && !isSorted && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-brand-teal uppercase tracking-widest bg-brand-teal/10 px-1 py-0.5 rounded border border-brand-teal/20 z-50">ROOT</span>}
                      </motion.div>
                    );
                  })}
               </div>
             </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-5">
             <div className="flex-none rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur flex flex-col gap-5">
                <div className="space-y-3">
                   <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-[10px] font-black text-brand-gray-400 uppercase tracking-widest"><Gauge className="w-3.5 h-3.5" /> 模擬速度</div><span className="text-xs font-black text-brand-teal">{playbackSpeed}x</span></div>
                   <input type="range" min="0.5" max="3" step="0.5" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="w-full h-1.5 bg-brand-gray-100 rounded-lg appearance-none cursor-pointer accent-brand-teal" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                   <GameButton variant="primary" onClick={runHeapSort} disabled={isAutoPlaying || isComplete} className="w-full h-14"><div className="flex items-center justify-center gap-3">{isAutoPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}<span className="font-bold uppercase">運行模擬</span></div></GameButton>
                   <GameButton variant="primary" onClick={reset} className="w-full h-14 opacity-90"><div className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /><span className="text-xs font-bold uppercase">重置模擬</span></div></GameButton>
                </div>
             </div>
             <div className="flex-1 rounded-[2.5rem] bg-slate-800 p-6 shadow-2xl border-4 border-slate-700 flex flex-col gap-5 overflow-hidden">
                <div className="flex justify-between items-center border-b border-white/5 pb-3"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Memory Snapshot</span></div>
                <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-1 lesson-session-scroll">
                  {data.map((item, i) => (
                    <motion.div key={`a-sim-${item.id}`} layout animate={{ backgroundColor: i >= heapSize || isComplete ? "#58CC02" : swapping?.includes(i) ? "#FACC15" : "rgba(255,255,255,0.02)", opacity: i >= heapSize || isComplete ? 0.6 : 1 }} className="aspect-square rounded-xl flex flex-col items-center justify-center relative border border-white/5 shadow-sm"><span className={`text-base font-black ${i >= heapSize || isComplete || swapping?.includes(i) ? 'text-white' : 'text-slate-400'}`}>{item.val}</span><span className="absolute bottom-1 text-[7px] font-mono text-slate-600 font-bold opacity-50">[{i}]</span></motion.div>
                  ))}
                </div>
                <div className="mt-auto pt-4 border-t border-white/5">
                   <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progress</span><span className="text-xs font-black text-brand-teal">{Math.round(progress)}%</span></div>
                   <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner"><motion.div animate={{ width: `${progress}%` }} className="h-full bg-brand-teal rounded-full" /></div>
                </div>
             </div>
          </div>
        </div>
      </div>
      <QuestionActionBar onSkip={onSkip} onContinue={onContinue} isContinueDisabled={!isComplete} />
    </div>
  );
}
