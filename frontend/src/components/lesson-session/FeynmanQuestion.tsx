"use client";

import Image from "next/image";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { HintButton } from "./HintButton";
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
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full shadow-md border-2 border-[#9ecbd4]/50 bg-gradient-to-br from-[#e0f1f3] to-[#c9e3e7] flex items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-7 w-7" fill="none">
        <circle cx="20" cy="15" r="6" fill="#5fb3af" />
        <path d="M9 32 Q9 22 20 22 Q31 22 31 32 Z" fill="#5fb3af" />
        <circle cx="17.5" cy="14" r="1.2" fill="white" />
        <circle cx="22.5" cy="14" r="1.2" fill="white" />
      </svg>
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 rounded-3xl overflow-hidden border border-[#9ecbd4]/30 bg-white/40 backdrop-blur-md">
      {!hideChrome && (
        <div className="px-6 pt-4 bg-white/70 backdrop-blur-md border-b border-[#9ecbd4]/30">
           <QuestionStageHeader
            stageIndex={stageIndex}
            totalStages={totalStages}
            stageLabel={stageLabel}
            topic={topic}
            difficulty={difficulty}
            recommendedDurationMinutes={recommendedDurationMinutes}
            accentClassName="bg-gradient-to-br from-[#7AC7C4] to-[#5fb3af] shadow-[#7AC7C4]/30"
            accentTextClassName="text-brand-teal"
            subtitle="— Feynman Interactive Challenge"
          />
          <div className="flex items-center justify-between py-2">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400">Status</span>
                <div className={`h-2 w-2 rounded-full animate-pulse ${isFinished ? 'bg-brand-gray-300' : 'bg-[#5fb3af]'}`} />
                <span className="text-xs font-bold text-brand-gray-600">
                    {isFinished ? 'Challenge Ended' : `Student is listening... (Round ${round}/${maxRounds})`}
                </span>
             </div>
             {!isFinished && (
                <div className="flex gap-1">
                   {Array.from({length: maxRounds}).map((_, i) => (
                      <div key={i} className={`h-1.5 w-5 rounded-full transition-colors ${i < round ? 'bg-gradient-to-r from-[#7AC7C4] to-[#5fb3af]' : 'bg-[#9ecbd4]/30'}`} />
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
              <div className="flex flex-col gap-1" style={{ maxWidth: "78%" }}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === "student" ? "text-[#5fb3af]" : "text-[#D4A96A] text-right"}`}>
                  {msg.role === "student" ? "Student" : "You · Professor"}
                </span>
                <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.role === "student"
                    ? "bg-white/85 border border-[#9ecbd4]/30 text-brand-gray-800 rounded-tl-none backdrop-blur"
                    : "bg-gradient-to-br from-[#7AC7C4] to-[#5fb3af] text-white rounded-tr-none shadow-[0_6px_18px_-8px_rgba(122,199,196,0.6)]"
                }`}>
                  {msg.content}
                </div>
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
              <div className="bg-white/85 border border-[#9ecbd4]/30 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm backdrop-blur">
                <div className="flex gap-1">
                  {[0, 1, 2].map(d => (
                    <motion.div
                      key={d}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.1 }}
                      className="w-1.5 h-1.5 rounded-full bg-[#5fb3af]"
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
              className={`mt-8 p-6 rounded-3xl border text-center space-y-4 backdrop-blur-md ${
                result === "correct"
                  ? "bg-gradient-to-br from-[#e6f5e0]/80 to-[#d3ecc8]/70 border-[#86c46b]/40"
                  : "bg-gradient-to-br from-[#fff1de]/80 to-[#ffe6c2]/70 border-[#D4A96A]/40"
              }`}
            >
              <h3 className={`text-xl font-black ${result === "correct" ? "text-[#3d8a2a]" : "text-[#9d6a1f]"}`}>
                {result === "correct" ? "Success! The student understood!" : "Challenge Over"}
              </h3>

              {result === "incorrect" && advisorAdvice && (
                <div className="text-left bg-white/80 p-4 rounded-2xl border border-[#D4A96A]/30 shadow-inner backdrop-blur">
                   <p className="text-[10px] font-black text-[#9d6a1f] uppercase tracking-widest mb-2">Professor Feynman&apos;s Advice</p>
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
              className="mt-8 p-6 rounded-3xl border border-[#5fb3af]/40 bg-gradient-to-br from-[#e0f1f3]/85 to-[#d4ecef]/75 text-center space-y-4 backdrop-blur-md"
            >
              <h3 className="text-xl font-black text-brand-teal">Challenge Result</h3>

              <div className="text-left bg-white/80 p-4 rounded-2xl border border-brand-teal/15 shadow-inner backdrop-blur">
                 <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest mb-2">Sample Model Answer</p>
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
        <div className="p-4 bg-white/75 border-t border-[#9ecbd4]/30 backdrop-blur-md">
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
                className="flex-1 bg-white/80 border border-[#9ecbd4]/40 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7AC7C4]/30 focus:border-[#5fb3af] transition-all resize-none max-h-32 placeholder:text-brand-gray-400"
                rows={Math.min(5, input.split("\n").length || 1)}
                disabled={isProcessing}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="bg-gradient-to-br from-[#7AC7C4] to-[#5fb3af] hover:shadow-[0_8px_22px_-6px_rgba(122,199,196,0.7)] disabled:from-brand-gray-200 disabled:to-brand-gray-200 text-white p-3 rounded-2xl transition-all shadow-[0_6px_18px_-6px_rgba(122,199,196,0.55)] disabled:shadow-none active:scale-95"
                aria-label="Send"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.5 11.2 21 3.2c.6-.3 1.2.3.9.9l-8 18.5c-.3.6-1.1.6-1.4 0L9.5 15 3 12.6c-.6-.2-.6-1.1 0-1.3Z"/>
                </svg>
              </button>
           </div>
           <p className="text-[10px] text-brand-gray-400 mt-2 text-center font-bold uppercase tracking-widest">
              Shift + Enter for new line
           </p>
        </div>
      )}
      </div>

      {!hideChrome && !isFinished && (
        <QuestionActionBar
          onSkip={onSkip}
          leftSlot={<HintButton onClick={handleHint} />}
        />
      )}
    </div>
  );
}
