"use client";

import Image from "next/image";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type {
  QuestionCommonActions,
  QuestionFeedbackMessages,
  QuestionStageMeta,
  QuestionSubmitResponse,
} from "./questionSharedTypes";

import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";

/* ═══════════════════ Types ═══════════════════ */

export interface FeynmanMessage {
  role: "teacher" | "student";
  content: string;
}

export interface FeynmanQuestionProps
  extends QuestionStageMeta,
    QuestionCommonActions {
  prompt: string;
  sampleAnswer: string;
  feedbackMsg: QuestionFeedbackMessages;
  onSubmit: (answer: string, history?: FeynmanMessage[]) => Promise<QuestionSubmitResponse | void>;
  onContinue: () => void;
  onError?: () => void;
  onChange?: (answer: string) => void;
  onHintUse: () => Promise<boolean>;
  hideChrome?: boolean;
  maxRounds?: number;
  isRevealed?: boolean;
}

/* ═══════════════════ Avatars ═══════════════════ */

function OwlTeacher() {
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full shadow-md border-2 border-amber-200">
      <Image
        src="/icons/icon.ico"
        alt="Professor avatar"
        width={40}
        height={40}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function StudentFeynman() {
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full shadow-md border-2 border-purple-200 bg-purple-50 flex items-center justify-center">
       <span className="text-xl">👦</span>
    </div>
  );
}

/* ═══════════════════ Component ═══════════════════ */

export default function FeynmanQuestion({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  courseId,
  difficulty,
  recommendedDurationMinutes,
  prompt,
  sampleAnswer,
  onSubmit,
  onSkip,
  onContinue,
  onHintUse,
  hideChrome = false,
  isRevealed = false,
  maxRounds: maxRoundsProp = 8,
}: FeynmanQuestionProps) {
  const [messages, setMessages] = useState<FeynmanMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [round, setRound] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [advisorAdvice, setAdvisorAdvice] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxRounds = maxRoundsProp;

  // Initial prompt from student
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: "student", content: `Teacher, I'm curious about "${topic}". ${prompt}` }]);
    }
  }, [messages.length, topic, prompt]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing || isFinished) return;
    
    const teacherMsg = input.trim();
    setInput("");
    const newHistory = [...messages, { role: "teacher" as const, content: teacherMsg }];
    setMessages(newHistory);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/v1/lessons/feynman/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          history: newHistory,
          userInput: teacherMsg,
          courseId: courseId,
          maxRounds: maxRounds
        })
      });
      
      const data = await res.json();
      const studentReply = data.reply || "I'm still a bit confused...";
      const isSatisfied = !!data.isSatisfied;
      
      const updatedHistory = [...newHistory, { role: "student" as const, content: studentReply }];
      setMessages(updatedHistory);
      
      if (isSatisfied) {
        // Success!
        const finalRes = await onSubmit(teacherMsg, updatedHistory);
        setResult("correct");
        setIsFinished(true);
      } else if (round >= maxRounds) {
        // Failed!
        const finalRes = await onSubmit(teacherMsg, updatedHistory);
        setResult("incorrect");
        setAdvisorAdvice(data.advice || "Try explaining with a simpler analogy next time.");
        setIsFinished(true);
      } else {
        setRound(prev => prev + 1);
      }
    } catch (err) {
      console.error("Feynman interaction failed", err);
    } finally {
      setIsProcessing(false);
    }
  }, [input, messages, isProcessing, isFinished, topic, round, onSubmit]);

  const handleHint = useCallback(async () => {
    await onHintUse();
  }, [onHintUse]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-brand-gray-50/30 rounded-3xl overflow-hidden border border-brand-gray-100">
      {!hideChrome && (
        <div className="px-6 pt-4 bg-white/80 backdrop-blur-sm border-b border-brand-gray-100">
           <QuestionStageHeader
            stageIndex={stageIndex}
            totalStages={totalStages}
            stageLabel={stageLabel}
            topic={topic}
            difficulty={difficulty}
            recommendedDurationMinutes={recommendedDurationMinutes}
            accentClassName="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-300/30"
            accentTextClassName="text-indigo-500"
            subtitle="— Feynman Interactive Challenge"
          />
          <div className="flex items-center justify-between py-2">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400">Status</span>
                <div className={`h-2 w-2 rounded-full animate-pulse ${isFinished ? 'bg-brand-gray-300' : 'bg-green-500'}`} />
                <span className="text-xs font-bold text-brand-gray-600">
                    {isFinished ? 'Challenge Ended' : `Student is listening... (Round ${round}/${maxRounds})`}
                </span>
             </div>
             {!isFinished && (
                <div className="flex gap-1">
                   {Array.from({length: maxRounds}).map((_, i) => (
                      <div key={i} className={`h-1.5 w-4 rounded-full transition-colors ${i < round ? 'bg-indigo-500' : 'bg-brand-gray-200'}`} />
                   ))}
                </div>
             )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 lesson-session-scroll"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex items-start gap-3 ${msg.role === "teacher" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "student" ? <StudentFeynman /> : <OwlTeacher />}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                msg.role === "student" 
                  ? "bg-white border border-brand-gray-100 text-brand-gray-800 rounded-tl-none" 
                  : "bg-indigo-600 text-white rounded-tr-none"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <StudentFeynman />
              <div className="bg-white border border-brand-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(d => (
                    <motion.div
                      key={d}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.1 }}
                      className="w-1.5 h-1.5 rounded-full bg-brand-gray-300"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {isFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`mt-8 p-6 rounded-3xl border-2 text-center space-y-4 ${
                result === "correct" 
                  ? "bg-green-50 border-green-200" 
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <div className="text-4xl">{result === "correct" ? "🎉" : "💡"}</div>
              <h3 className={`text-xl font-black ${result === "correct" ? "text-green-700" : "text-orange-700"}`}>
                {result === "correct" ? "Success! The student understood!" : "Challenge Over"}
              </h3>
              
              {result === "incorrect" && advisorAdvice && (
                <div className="text-left bg-white/80 p-4 rounded-xl border border-orange-100 shadow-inner">
                   <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2">Professor Feynman&apos;s Advice:</p>
                   <p className="text-sm text-brand-gray-700 italic font-medium leading-relaxed">
                      &ldquo;{advisorAdvice}&rdquo;
                   </p>
                </div>
              )}
              
              <div className="pt-2">
                <GameButton variant="primary" onClick={onContinue}>
                  CONTINUE
                </GameButton>
              </div>
            </motion.div>
          )}

          {isRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 rounded-3xl border-2 border-brand-teal bg-brand-teal/5 text-center space-y-4"
            >
              <div className="text-4xl">🎯</div>
              <h3 className="text-xl font-black text-brand-teal">Challenge Result</h3>
              
              <div className="text-left bg-white/80 p-4 rounded-xl border border-brand-teal/10 shadow-inner">
                 <p className="text-xs font-black text-brand-teal uppercase tracking-widest mb-2">Sample Model Answer:</p>
                 <p className="text-sm text-brand-gray-700 italic font-medium leading-relaxed">
                    &ldquo;{sampleAnswer}&rdquo;
                 </p>
              </div>
              
              <div className="pt-2">
                <GameButton variant="primary" onClick={onContinue}>
                  CONTINUE
                </GameButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      {!isFinished && !isRevealed && (
        <div className="p-4 bg-white border-t border-brand-gray-100">
           <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your explanation here..."
                className="flex-1 bg-brand-gray-50 border border-brand-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none max-h-32"
                rows={Math.min(5, input.split("\n").length || 1)}
                disabled={isProcessing}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-brand-gray-200 text-white p-3 rounded-2xl transition-colors shadow-md shadow-indigo-200 disabled:shadow-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
           </div>
           <p className="text-[10px] text-brand-gray-400 mt-2 text-center font-bold uppercase tracking-widest">
              Shift + Enter for new line
           </p>
        </div>
      )}

      {!hideChrome && !isFinished && (
        <QuestionActionBar
          leftSlot={
             <button
                onClick={handleHint}
                className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-100 transition shadow-sm"
              >
                💡 Hint <span className="text-[10px] opacity-60">(10 💎)</span>
              </button>
          }
          rightSlot={
            <GameButton
              variant="secondary"
              onClick={() => onSkip?.()}
              className="min-w-[100px]"
            >
              SKIP
            </GameButton>
          }
        />
      )}
    </div>
  );
}
