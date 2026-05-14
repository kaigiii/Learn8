"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { HintButton } from "./HintButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { RefreshCw, Zap, Layers, Terminal, HelpCircle } from "lucide-react";

export interface HeapSortExerciseProps extends QuestionStageMeta {
  initialArray: number[];
  title: string;
  explanation: string;
  messages?: {
    initial?: string;
    successSwap?: string;
    successExtract?: string;
    errorSwap?: string;
    errorInvalid?: string;
  };
  hints?: string[];
  onHintUse: () => Promise<boolean>;
  onContinue: (results: { errorCount: number }) => void;
  onSkip?: () => void;
}

type Phase = "BUILD_HEAP" | "SORTING" | "COMPLETE";

export default function HeapSortExercise({
  stageIndex, totalStages, stageLabel, topic,
  difficulty, recommendedDurationMinutes, initialArray,
  title, explanation, messages, hints = [], onHintUse, onContinue, onSkip,
}: HeapSortExerciseProps) {
  const defaultMessages = {
    initial: "請選中違反屬性的父子節點進行交換。",
    successSwap: "正確調整。",
    successExtract: "提取成功。",
    errorSwap: "錯誤。請交換子大於父的節點。",
    errorInvalid: "操作無效。"
  };
  const msg = { ...defaultMessages, ...messages };

  const [data, setData] = useState(() => initialArray.map((v, i) => ({ id: i, val: v })));
  const [heapSize, setHeapSize] = useState(initialArray.length);
  const [phase, setPhase] = useState<Phase>("BUILD_HEAP");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [swapping, setSwapping] = useState<[number, number] | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [shake, setShake] = useState(false);
  const [instruction, setInstruction] = useState(msg.initial);
  const [isComplete, setIsComplete] = useState(false);
  
  // Hint State
  const [currentHintIdx, setCurrentHintIdx] = useState(-1);
  const [isShowingHint, setIsShowingHint] = useState(false);

  const getCoords = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const posInLevel = index - (Math.pow(2, level) - 1);
    const levelWidth = Math.pow(2, level);
    const x = (posInLevel + 0.5) * (100 / levelWidth);
    const y = (level + 1) * 24; 
    return { x, y };
  };

  const isMaxHeap = (arr: {val: number}[], size: number) => {
    for (let i = 0; i <= Math.floor(size / 2) - 1; i++) {
      const left = 2 * i + 1; const right = 2 * i + 2;
      if (left < size && arr[left].val > arr[i].val) return false;
      if (right < size && arr[right].val > arr[i].val) return false;
    }
    return true;
  };

  useEffect(() => {
    if (phase === "BUILD_HEAP" && isMaxHeap(data, heapSize)) {
      setPhase("SORTING");
      setInstruction("堆積已建立。請提取根節點。");
    }
  }, [data, heapSize, phase]);

  const handleNodeClick = (idx: number) => {
    if (phase === "COMPLETE") return;
    if (idx >= heapSize && phase === "SORTING") return;
    if (selectedIdx === null) {
      setSelectedIdx(idx);
    } else if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else {
      validateAndSwap(selectedIdx, idx);
      setSelectedIdx(null);
    }
  };

  const validateAndSwap = (i: number, j: number) => {
    let parent = Math.min(i, j); let child = Math.max(i, j);
    const isParentChild = Math.floor((child - 1) / 2) === parent;
    setIsShowingHint(false); // Clear hint on interaction
    if (phase === "BUILD_HEAP") {
      if (isParentChild && data[child].val > data[parent].val) executeSwap(i, j, msg.successSwap);
      else triggerError(msg.errorSwap);
    } else if (phase === "SORTING") {
      const isRootSwap = (i === 0 && j === heapSize - 1) || (j === 0 && i === heapSize - 1);
      if (isRootSwap) { executeSwap(i, j, msg.successExtract); setHeapSize(prev => prev - 1); }
      else if (isParentChild && data[child].val > data[parent].val) executeSwap(i, j, msg.successSwap);
      else triggerError(msg.errorInvalid);
    }
  };

  const executeSwap = async (i: number, j: number, feedback: string) => {
    setSwapping([i, j]);
    await new Promise(r => setTimeout(r, 400));
    const newData = [...data];
    [newData[i], newData[j]] = [newData[j], newData[i]];
    setData(newData);
    
    setTimeout(() => {
      setSwapping(null);
      setInstruction(feedback);
      if (phase === "BUILD_HEAP" && isMaxHeap(newData, heapSize)) setPhase("SORTING");
      else if (phase === "SORTING") {
        const currentSize = (i === 0 || j === 0) ? heapSize - 1 : heapSize;
        if (currentSize <= 1) { setPhase("COMPLETE"); setIsComplete(true); }
      }
    }, 850);
  };

  const triggerError = (feedback: string) => {
    setShake(true); setErrorCount(prev => prev + 1); setInstruction(feedback);
    setTimeout(() => setShake(false), 500);
  };

  const handleHint = useCallback(async () => {
    if (currentHintIdx >= hints.length - 1 || isComplete) return;
    const canAfford = await onHintUse();
    if (!canAfford) return;
    setCurrentHintIdx(prev => prev + 1);
    setIsShowingHint(true);
  }, [currentHintIdx, hints.length, isComplete, onHintUse]);

  const reset = () => {
    setData(initialArray.map((v, i) => ({ id: i, val: v })));
    setHeapSize(initialArray.length); setPhase("BUILD_HEAP");
    setSelectedIdx(null); setErrorCount(0); setIsComplete(false); 
    setInstruction(msg.initial); setCurrentHintIdx(-1); setIsShowingHint(false);
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
                   <p className="mt-2 text-xs font-medium text-brand-gray-600 leading-relaxed font-body">{explanation}</p>
                 </div>
                 <QuestionVoiceReader text={`${title}. ${explanation}`} />
               </div>
               
               <div className={`mt-4 overflow-hidden rounded-xl bg-slate-900 border transition-all ${shake ? 'border-red-500 ring-4 ring-red-500/20' : isShowingHint ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-white/10 ring-1 ring-brand-teal/20'}`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-white/5">
                     <Terminal className={`w-3 h-3 ${shake ? 'text-red-400' : isShowingHint ? 'text-amber-400' : 'text-brand-teal'}`} />
                     <span className={`text-[9px] font-black uppercase ${isShowingHint ? 'text-amber-400' : 'text-brand-teal'}`}>
                       {isShowingHint ? 'Intelligent Hint' : 'Workshop Console'}
                     </span>
                     <div className="ml-auto text-[9px] font-bold text-slate-500">Errors: {errorCount}</div>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                     <div className={`px-2 py-0.5 rounded text-[10px] font-black border ${isShowingHint ? 'bg-amber-400/20 border-amber-400/30 text-amber-400' : 'bg-brand-teal/20 border-brand-teal/30 text-brand-teal'}`}>{isShowingHint ? 'HINT' : phase}</div>
                     <span className={`text-sm font-bold truncate ${isShowingHint ? 'text-amber-100 italic' : 'text-slate-200'}`}>
                       {isShowingHint ? hints[currentHintIdx] : instruction}
                     </span>
                  </div>
               </div>
             </motion.div>

             <div className="flex-1 relative bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border-4 border-slate-900">
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#7AC7C4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
               <div className="w-full h-full relative">
                 <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                   <defs><filter id="glow-yellow-ex" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs>
                   {data.map((_, i) => {
                     if (i >= heapSize && !isComplete) return null;
                     const left = 2 * i + 1; const right = 2 * i + 2; const p = getCoords(i);
                     const limit = isComplete ? data.length : heapSize;
                     return (
                       <g key={`l-ex-${i}`}>
                         {left < limit && <motion.line animate={{ stroke: isComplete ? "#58CC02" : "#7AC7C4", strokeOpacity: 0.15 }} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${getCoords(left).x}%`} y2={`${getCoords(left).y}%`} strokeWidth="1.5" strokeDasharray="4 4" />}
                         {right < limit && <motion.line animate={{ stroke: isComplete ? "#58CC02" : "#7AC7C4", strokeOpacity: 0.15 }} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${getCoords(right).x}%`} y2={`${getCoords(right).y}%`} strokeWidth="1.5" strokeDasharray="4 4" />}
                       </g>
                     );
                   })}
                   <AnimatePresence>{swapping && <motion.line initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} x1={`${getCoords(swapping[0]).x}%`} y1={`${getCoords(swapping[0]).y}%`} x2={`${getCoords(swapping[1]).x}%`} y2={`${getCoords(swapping[1]).y}%`} stroke="#FACC15" strokeWidth="5" strokeLinecap="round" filter="url(#glow-yellow-ex)" />}</AnimatePresence>
                 </svg>
                 {data.map((item, i) => {
                    const { x, y } = getCoords(i); const isActive = selectedIdx === i; const isSwapping = swapping?.includes(i); const isSorted = isComplete || i >= heapSize;
                    return (
                      <motion.div key={`node-item-${item.id}`} layout animate={{ left: `${x}%`, top: `${y}%`, x: "-50%", y: "-50%" }} transition={{ layout: { type: "tween", ease: "easeInOut", duration: 0.8 }, left: { type: "tween", ease: "easeInOut", duration: 0.8 }, top: { type: "tween", ease: "easeInOut", duration: 0.8 } }} className="absolute z-10" onClick={() => handleNodeClick(i)}>
                        <motion.button animate={{ scale: isSwapping ? 1.25 : isActive ? 1.15 : 1, backgroundColor: isSorted ? "#58CC02" : isSwapping ? "#EAB308" : isActive ? "rgba(250, 204, 21, 0.3)" : "rgba(255,255,255,0.05)", borderColor: isSorted ? "#58CC02" : isSwapping ? "#FACC15" : isActive ? "#FACC15" : "rgba(255,255,255,0.15)", boxShadow: isSorted ? "0 0 20px rgba(88, 204, 2, 0.3)" : isSwapping ? "0 0 35px rgba(250, 204, 21, 0.5)" : "none" }} className="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-black shadow-lg backdrop-blur-sm cursor-pointer"><span className={isSorted || isSwapping || isActive ? "text-white" : "text-slate-400"}>{item.val}</span></motion.button>
                        {i === 0 && !isSorted && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-brand-teal uppercase tracking-widest bg-brand-teal/10 px-1 py-0.5 rounded border border-brand-teal/20 z-50">ROOT</span>}
                      </motion.div>
                    );
                  })}
               </div>
             </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-5">
             <div className="flex-none rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur flex flex-col gap-5">
                <div className="flex items-center gap-3 border-b border-brand-gray-100 pb-3"><div className="p-1.5 bg-brand-teal/10 rounded-lg text-brand-teal"><Layers className="w-4 h-4" /></div><span className="text-xs font-black text-brand-gray-700 uppercase tracking-widest font-heading">實戰控制</span></div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Status</span><span className="text-xs font-bold text-brand-teal">{phase}</span></div>
                   <GameButton variant="primary" onClick={reset} className="w-full h-14 rounded-2xl"><div className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-widest">Restart Challenge</span></div></GameButton>
                </div>
             </div>
             <div className="flex-1 rounded-[2.5rem] bg-slate-800 p-6 shadow-2xl border-4 border-slate-700 flex flex-col gap-5 overflow-hidden">
                <div className="flex justify-between items-center border-b border-white/5 pb-3"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Memory Snapshot</span></div>
                <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-1 lesson-session-scroll">
                  {data.map((item, i) => (
                    <motion.div key={`a-ex-${item.id}`} layout animate={{ backgroundColor: i >= heapSize || isComplete ? "#58CC02" : swapping?.includes(i) ? "#FACC15" : "rgba(255,255,255,0.02)", opacity: i >= heapSize || isComplete ? 0.6 : 1 }} className="aspect-square rounded-xl flex flex-col items-center justify-center relative border border-white/5 shadow-sm"><span className={`text-base font-black ${i >= heapSize || isComplete || swapping?.includes(i) ? 'text-white' : 'text-slate-400'}`}>{item.val}</span><span className="absolute bottom-1 text-[7px] font-mono text-slate-600 font-bold opacity-50">[{i}]</span></motion.div>
                  ))}
                </div>
                <div className="mt-auto pt-4 border-t border-white/5">
                   <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progress</span><span className="text-xs font-black text-brand-teal">{Math.round(progress)}%</span></div>
                   <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5"><motion.div animate={{ width: `${progress}%`, backgroundColor: isComplete ? "#58CC02" : "#7AC7C4" }} className="h-full rounded-full" /></div>
                </div>
             </div>
          </div>
        </div>
      </div>
      <QuestionActionBar 
        onSkip={onSkip} 
        onContinue={() => onContinue({ errorCount })} 
        isContinueDisabled={!isComplete} 
        leftSlot={
          hints.length > 0 && (
            <HintButton 
              onClick={() => void handleHint()} 
              disabled={currentHintIdx >= hints.length - 1 || isComplete} 
            />
          )
        }
      />
    </div>
  );
}
