"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { RefreshCw, Play, Pause, Zap, Gauge, Info, Activity, Layers, Terminal } from "lucide-react";

export interface HeapSortSimulatorProps extends QuestionStageMeta {
  initialArray: number[];
  title: string;
  explanation: string;
  onContinue: () => void;
  onSkip?: () => void;
}

export default function HeapSortSimulator({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  initialArray,
  title,
  explanation,
  onContinue,
  onSkip,
}: HeapSortSimulatorProps) {
  const [array, setArray] = useState<number[]>([...initialArray]);
  const [heapSize, setHeapSize] = useState(initialArray.length);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const [swapping, setSwapping] = useState<[number, number] | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [stepDescription, setStepDescription] = useState("準備緒。點擊「開始模擬」觀察堆積排序邏輯。");
  const [currentStepLabel, setCurrentStepLabel] = useState("READY");
  const [isComplete, setIsComplete] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const isAutoPlayingRef = useRef(false);
  const arrayRef = useRef([...initialArray]);

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms / playbackSpeed));

  const runHeapSort = async () => {
    if (isAutoPlaying) return;
    setIsAutoPlaying(true);
    isAutoPlayingRef.current = true;
    
    let currentArr = [...arrayRef.current];
    let n = currentArr.length;

    setCurrentStepLabel("BUILDING");
    setStepDescription("【第一階段】由下而上建立最大堆積 (Build Max-Heap)。");
    await delay(1200);

    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      if (!isAutoPlayingRef.current) return;
      setStepDescription(`調整子樹節點 [${currentArr[i]}] 以符合堆積屬性。`);
      await heapify(currentArr, n, i);
    }

    setCurrentStepLabel("SORTING");
    setStepDescription("【第二階段】開始循環提取根節點（當前最大值）。");
    await delay(1200);

    for (let i = n - 1; i > 0; i--) {
      if (!isAutoPlayingRef.current) return;
      setStepDescription(`提取根節點 ${currentArr[0]} 至數組末尾，縮小堆積範圍。`);
      setSwapping([0, i]);
      await delay(800);
      
      [currentArr[0], currentArr[i]] = [currentArr[i], currentArr[0]];
      arrayRef.current = [...currentArr];
      setArray([...currentArr]);
      setSwapping(null);
      
      n--;
      setHeapSize(n);
      await delay(600);
      setStepDescription("重新向下調整根節點，尋找剩餘元素中的最大值。");
      await heapify(currentArr, n, 0);
    }

    setIsAutoPlaying(false);
    isAutoPlayingRef.current = false;
    setIsComplete(true);
    setCurrentStepLabel("DONE");
    setStepDescription("排序完成！數據現在呈遞增排列。");
  };

  const heapify = async (arr: number[], n: number, i: number) => {
    let largest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;

    setActiveIndices([i, l, r].filter(idx => idx < n));
    await delay(400);

    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;

    if (largest !== i) {
      setStepDescription(`節點 [${arr[largest]}] 大於父節點 [${arr[i]}]，執行交換。`);
      setSwapping([i, largest]);
      await delay(800);
      [arr[i], arr[largest]] = [arr[largest], arr[i]];
      arrayRef.current = [...arr];
      setArray([...arr]);
      setSwapping(null);
      await delay(300);
      await heapify(arr, n, largest);
    } else {
      setActiveIndices([]);
    }
  };

  const reset = () => {
    isAutoPlayingRef.current = false;
    setIsAutoPlaying(false);
    arrayRef.current = [...initialArray];
    setArray([...initialArray]);
    setHeapSize(initialArray.length);
    setActiveIndices([]);
    setSwapping(null);
    setIsComplete(false);
    setCurrentStepLabel("READY");
    setStepDescription("模擬器已重置。");
  };

  const getCoords = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const posInLevel = index - (Math.pow(2, level) - 1);
    const levelWidth = Math.pow(2, level);
    const x = (posInLevel + 0.5) * (100 / levelWidth);
    const y = (level + 1) * 22; // Compact Y
    return { x: `${x}%`, y: `${y}%` };
  };

  const progress = ((initialArray.length - heapSize) / (initialArray.length - 1)) * 100;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 lesson-session-scroll px-4 md:px-8">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={topic}
          difficulty={difficulty}
          recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-8 items-stretch">
          {/* Left Area (7/12) */}
          <div className="lg:col-span-7 flex flex-col gap-5 h-full">
             {/* Integrated Header */}
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur"
             >
               <div className="flex justify-between items-start gap-4">
                 <div className="flex-1">
                   <h3 className="text-lg font-bold text-brand-gray-700 font-heading">{title}</h3>
                   <p className="mt-2 text-xs font-medium leading-relaxed text-brand-gray-600 font-body">
                     {explanation}
                   </p>
                 </div>
                 <QuestionVoiceReader text={`${title}. ${explanation}`} />
               </div>
               
               {/* Advanced Instruction Console */}
               <div className="mt-4 overflow-hidden rounded-xl bg-slate-900 border border-white/10 shadow-lg ring-1 ring-brand-teal/20">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-white/5">
                     <Terminal className="w-3 h-3 text-brand-teal" />
                     <span className="text-[9px] font-black text-brand-teal uppercase tracking-widest">Algo Console v1.0</span>
                     <div className="ml-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                     <div className="px-2 py-0.5 rounded bg-brand-teal/20 border border-brand-teal/30 text-[10px] font-black text-brand-teal animate-pulse">
                        {currentStepLabel}
                     </div>
                     <span className="text-sm font-bold text-slate-200 font-heading truncate">{stepDescription}</span>
                  </div>
               </div>
             </motion.div>

             {/* Compact Visual Arena */}
             <div className="relative flex-1 min-h-[380px] bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden p-6">
               <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#7AC7C4 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }} />
               <div className="w-full h-full relative">
                 <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                   {array.map((_, i) => {
                     if (i >= heapSize) return null;
                     const left = 2 * i + 1;
                     const right = 2 * i + 2;
                     const p = getCoords(i);
                     return (
                       <g key={`lines-${i}`}>
                         {left < heapSize && <motion.line x1={p.x} y1={p.y} x2={getCoords(left).x} y2={getCoords(left).y} stroke="#7AC7C4" strokeWidth="2" strokeOpacity="0.1" strokeDasharray="5 5" />}
                         {right < heapSize && <motion.line x1={p.x} y1={p.y} x2={getCoords(right).x} y2={getCoords(right).y} stroke="#7AC7C4" strokeWidth="2" strokeOpacity="0.1" strokeDasharray="5 5" />}
                       </g>
                     );
                   })}
                 </svg>

                 {array.map((val, i) => {
                   const { x, y } = getCoords(i);
                   const isActive = activeIndices.includes(i);
                   const isSwapping = swapping?.includes(i);
                   const isSorted = i >= heapSize;

                   return (
                     <motion.div
                       key={`node-${i}-${val}`}
                       layout
                       style={{ left: x, top: y }}
                       transition={{ layout: { type: "spring", stiffness: 200, damping: 25 }, duration: 0.8 / playbackSpeed }}
                       className="absolute -translate-x-1/2 -translate-y-1/2"
                     >
                       <motion.div
                         animate={{
                           scale: isSwapping ? 1.2 : isActive ? 1.1 : 1,
                           backgroundColor: isSorted ? "#58CC02" : isSwapping ? "#7AC7C4" : isActive ? "rgba(122, 199, 196, 0.2)" : "rgba(255,255,255,0.05)",
                           borderColor: isSorted ? "#58CC02" : isSwapping ? "#7AC7C4" : isActive ? "#7AC7C4" : "rgba(255,255,255,0.1)",
                           boxShadow: isSwapping ? "0 0 30px rgba(122, 199, 196, 0.4)" : "none",
                         }}
                         className="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-base font-black shadow-lg backdrop-blur-sm"
                       >
                         <span className={isSorted || isSwapping ? "text-white" : "text-slate-400"}>{val}</span>
                       </motion.div>
                       {i === 0 && !isSorted && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-brand-teal uppercase tracking-widest bg-brand-teal/10 px-1.5 py-0.5 rounded border border-brand-teal/20">ROOT</span>
                       )}
                     </motion.div>
                   );
                 })}
               </div>
             </div>
          </div>

          {/* Right Area (5/12) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
             <div className="rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur flex flex-col gap-6">

                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">
                         <Gauge className="w-3.5 h-3.5" /> 模擬速度
                      </div>
                      <span className="text-xs font-black text-brand-teal">{playbackSpeed}x</span>
                   </div>
                   <input 
                      type="range" min="0.5" max="3" step="0.5" 
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-brand-gray-100 rounded-lg appearance-none cursor-pointer accent-brand-teal"
                   />
                </div>

                <div className="grid grid-cols-1 gap-3">
                   <GameButton variant="primary" onClick={runHeapSort} disabled={isAutoPlaying || isComplete} className="w-full h-14">
                      <div className="flex items-center justify-center gap-3">
                         {isAutoPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                         <span className="font-bold font-heading uppercase tracking-wide">
                           {isAutoPlaying ? "正在運行" : "開始模擬"}
                         </span>
                      </div>
                   </GameButton>
                   <GameButton variant="primary" onClick={reset} disabled={isAutoPlaying} className="w-full py-3 opacity-90">
                      <div className="flex items-center justify-center gap-2">
                         <RefreshCw className="w-4 h-4" />
                         <span className="text-xs font-bold font-heading uppercase tracking-wide">重置模擬</span>
                      </div>
                   </GameButton>
                </div>
             </div>

             <div className="flex-1 rounded-[2rem] bg-slate-800 p-6 shadow-xl border border-white/5 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">數組對照 (Array View)</span>
                   {isComplete && <span className="text-[9px] font-black text-brand-green uppercase">已完成</span>}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {array.map((val, i) => (
                    <motion.div
                      key={`arr-${i}-${val}`}
                      layout
                      animate={{
                        backgroundColor: i >= heapSize ? "#58CC02" : swapping?.includes(i) ? "#7AC7C4" : "rgba(255,255,255,0.02)",
                        opacity: i >= heapSize ? 0.6 : 1,
                        scale: swapping?.includes(i) ? 1.05 : 1
                      }}
                      className="aspect-square rounded-xl flex flex-col items-center justify-center relative border border-white/5"
                    >
                       <span className={`text-base font-black ${i >= heapSize || swapping?.includes(i) ? 'text-white' : 'text-slate-400'}`}>{val}</span>
                       <span className="absolute bottom-1 text-[6px] font-mono text-slate-600 font-bold">[{i}]</span>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-auto pt-4 border-t border-white/5">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">排序進度</span>
                      <span className="text-xs font-black text-brand-teal">{Math.round(progress)}%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 shadow-inner border border-white/5">
                      <motion.div animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-brand-teal to-brand-green rounded-full shadow-[0_0_10px_rgba(122,199,196,0.3)]" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <QuestionActionBar
        onSkip={onSkip}
        onContinue={onContinue}
        isContinueDisabled={!isComplete}
      />
    </div>
  );
}
