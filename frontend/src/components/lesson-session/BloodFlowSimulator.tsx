"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LessonStage } from "@/lib/apiTypes";

interface BloodFlowSimulatorProps {
  stage: LessonStage;
  onSubmit: (input: string[]) => void;
  onContinue: () => void;
}

interface Step {
  id: string;
  label: string;
  type: "chamber" | "valve" | "vessel";
}

export default function BloodFlowSimulator({
  stage,
  onSubmit,
  onContinue,
}: BloodFlowSimulatorProps) {
  const data = stage.config.data as { question: string; steps: Step[] };
  const steps = data.steps;

  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleDrop = (step: Step) => {
    if (step.id === steps[currentStepIndex].id) {
      const nextPlaced = [...placedIds, step.id];
      setPlacedIds(nextPlaced);
      
      if (currentStepIndex === steps.length - 1) {
        setIsComplete(true);
        onSubmit(nextPlaced);
      } else {
        setCurrentStepIndex(currentStepIndex + 1);
      }
      setErrorId(null);
    } else {
      setErrorId(step.id);
      setTimeout(() => setErrorId(null), 500);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/50">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-brand-gray-800">{stage.topic}</h2>
        <p className="mt-2 text-brand-gray-600">{data.question}</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center">
        {/* Heart Diagram Area */}
        <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl">
            {/* Stylized Heart Shape */}
            <path
              d="M200,350 C200,350 50,250 50,150 C50,80 120,50 200,120 C280,50 350,80 350,150 C350,250 200,350 200,350 Z"
              fill="rgba(255,255,255,0.6)"
              stroke="rgba(122,199,196,0.3)"
              strokeWidth="4"
            />
            
            {/* Zones / Slots */}
            {steps.map((step, idx) => {
              const isActive = placedIds.includes(step.id);
              const isTarget = idx === currentStepIndex && !isComplete;
              const yPos = 120 + idx * 60;
              
              return (
                <g key={`slot-${step.id}`}>
                  <motion.circle
                    cx="200"
                    cy={yPos}
                    r="35"
                    fill={isActive ? "rgba(122,199,196,0.8)" : "rgba(255,255,255,0.4)"}
                    stroke={isTarget ? "#7AC7C4" : "rgba(122,199,196,0.2)"}
                    strokeWidth={isTarget ? "3" : "1"}
                    strokeDasharray={isTarget ? "5,5" : "0"}
                    animate={isTarget ? { scale: [1, 1.05, 1], rotate: 360 } : {}}
                    transition={isTarget ? { scale: { repeat: Infinity, duration: 2 }, rotate: { repeat: Infinity, duration: 10, ease: "linear" } } : {}}
                  />
                  {isActive && (
                    <motion.text
                      x="200"
                      y={yPos + 5}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      {step.label}
                    </motion.text>
                  )}
                </g>
              );
            })}

            {/* Blood Flow Animation */}
            {isComplete && (
              <motion.path
                d={`M200,120 Q230,150 200,180 Q170,210 200,240 Q230,270 200,300`}
                stroke="rgba(59,130,246,0.5)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </svg>
        </div>

        {/* Labels to Drag */}
        <div className="w-full lg:w-64 space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-brand-gray-400 mb-2">Anatomical Labels</div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <AnimatePresence>
              {steps.map((step) => {
                const isPlaced = placedIds.includes(step.id);
                if (isPlaced) return null;

                return (
                  <motion.button
                    key={step.id}
                    layoutId={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      x: errorId === step.id ? [0, -5, 5, -5, 5, 0] : 0
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => handleDrop(step)}
                    className={`px-4 py-3 rounded-2xl border text-sm font-semibold transition-all shadow-sm ${
                      errorId === step.id 
                        ? "border-rose-400 bg-rose-50 text-rose-600" 
                        : "border-brand-teal/20 bg-white/80 text-brand-gray-700 hover:border-brand-teal hover:shadow-md"
                    }`}
                  >
                    {step.label}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
          
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium text-center"
            >
              Great job! Circulation path established.
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        {isComplete && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onContinue}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white font-bold shadow-lg shadow-teal-200/50 transition-all hover:brightness-105"
          >
            Next Stage
          </motion.button>
        )}
      </div>
    </div>
  );
}
