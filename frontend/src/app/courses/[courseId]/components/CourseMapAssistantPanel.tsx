"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { CoursePath } from "@/lib/apiTypes";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export function CourseMapAssistantPanel({
  coursePath,
  courseId,
  onCoursePathUpdated,
  compact = false,
  mobileOverlay = false,
}: {
  coursePath: CoursePath | null;
  courseId: number | null;
  onCoursePathUpdated: (coursePath: CoursePath) => void;
  compact?: boolean;
  mobileOverlay?: boolean;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeInput = (element?: HTMLTextAreaElement | null) => {
    const textarea = element ?? inputRef.current;
    if (!textarea) return;
    textarea.style.height = "40px";
    const maxHeight = 240;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflow = nextHeight >= maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeInput();
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !coursePath || isRefining) return;
    const nextMessages = [
      ...messages,
      { id: Date.now(), role: "user" as const, text: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsRefining(true);

    try {
      const refinedCoursePath = await apiFetch<CoursePath>("/courses/refine-syllabus", {
        method: "POST",
        body: JSON.stringify({
          topic: coursePath.topic || coursePath.courseTitle,
          currentSyllabus: coursePath,
          userFeedback: trimmed,
          history: nextMessages.map((message) => ({
            role: message.role === "assistant" ? "model" : message.role,
            content: message.text,
          })),
          courseId,
        }),
      });
      onCoursePathUpdated(refinedCoursePath);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "I updated the course map. Review the new structure and tell me what to adjust next.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            error instanceof ApiError
              ? error.detail
              : "I couldn't refine the syllabus right now.",
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  const finishRecording = () => {
    if (!isRecording || isRefining) return;
    setIsRecording(false);
    setInput("Please refine the syllabus based on this voice note.");
  };

  return (
    <motion.div
      initial={mobileOverlay ? { opacity: 0 } : { opacity: 0, x: 40 }}
      animate={mobileOverlay ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={
        mobileOverlay
          ? { duration: 0.2, ease: "easeOut" }
          : { delay: 0.3, type: "spring", damping: 18 }
      }
      className="flex flex-col overflow-hidden h-full"
    >
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full shadow-md">
          <Image
            src="/icons/icon.ico"
            alt="Syllabus architect avatar"
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h3 className="font-heading text-[15px] font-bold text-brand-gray-700">
            Syllabus Architect
          </h3>
          <p className="mt-0.5 text-xs text-brand-gray-400">
            Ask for unit changes, pacing tweaks, or difficulty adjustments.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="max-w-[200px] text-xs leading-relaxed text-brand-gray-400">
              Ask the architect to reshape this course map.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-md bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white"
                  : "rounded-bl-md border border-white/60 bg-white/70 text-brand-gray-600 shadow-sm"
              }`}
            >
              {message.text}
            </div>
          </motion.div>
        ))}
        {isRefining && (
          <p className="px-1 text-xs text-brand-gray-400">
            Architecting updates...
          </p>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />

      <div className="flex items-center gap-2 px-5 py-3">
        <div className="relative flex-1">
          {isRecording ? (
            <div className="flex h-[40px] items-center justify-center gap-[6px] rounded-xl border border-brand-teal/40 bg-white/70 px-4 py-3 ring-2 ring-brand-teal/30">
              {[...Array(12)].map((_, index) => (
                <motion.div
                  key={index}
                  className="w-[3px] rounded-full bg-brand-teal"
                  animate={{ height: [4, 16 + Math.random() * 8, 6, 20, 4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.08, ease: "easeInOut" }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                resizeInput(event.target);
              }}
              onInput={(event) => resizeInput(event.currentTarget)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(event) => {
                setIsComposing(false);
                resizeInput(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (isComposing || event.nativeEvent.isComposing) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              rows={1}
              disabled={isRefining}
              className="h-10 w-full resize-none rounded-xl border border-white/60 bg-white/70 px-4 py-[10px] text-[13px] leading-[18px] text-brand-gray-700 placeholder-brand-gray-300 focus:border-brand-teal/40 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              style={{ maxHeight: 240, overflow: "hidden" }}
            />
          )}
        </div>
        <motion.button
          onMouseDown={() => {
            if (isRecording) return;
            setIsRecording(true);
            setInput("");
          }}
          onMouseUp={finishRecording}
          onMouseLeave={finishRecording}
          onTouchStart={() => {
            if (isRecording) return;
            setIsRecording(true);
            setInput("");
          }}
          onTouchEnd={finishRecording}
          className={`flex h-10 w-10 flex-shrink-0 select-none items-center justify-center rounded-xl border border-white/60 shadow-md ${
            isRecording ? "bg-red-500 text-white" : "bg-white/70 text-brand-teal hover:bg-brand-teal/10"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 01-14 0v-1" />
            <line x1="12" y1="18" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </motion.button>
        <motion.button
          onClick={handleSend}
          whileTap={{ scale: 0.9 }}
          disabled={isRefining || !coursePath}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white shadow-md shadow-teal-300/30 transition-all hover:shadow-lg hover:shadow-teal-300/40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}
