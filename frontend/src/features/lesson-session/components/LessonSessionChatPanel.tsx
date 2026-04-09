"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { LESSON_SESSION_PHASE } from "@/lib/domain/statuses";
import type {
  LessonAssistantResponse,
  LessonSessionPayload,
  LessonStage,
} from "@/lib/apiTypes";

export function LessonSessionChatPanel({
  courseId,
  courseTopic,
  courseTitle,
  nodeId,
  nodeTitle,
  nodeDescription,
  lessonSession,
  currentStage,
  stageIdx,
  totalStages,
}: {
  courseId: number | null;
  courseTopic: string;
  courseTitle: string;
  nodeId: string;
  nodeTitle: string;
  nodeDescription: string;
  lessonSession: LessonSessionPayload | null;
  currentStage: LessonStage | null;
  stageIdx: number;
  totalStages: number;
}) {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { id: number; role: "user" | "assistant"; text: string }[]
  >([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeInput = (el?: HTMLTextAreaElement | null) => {
    const ta = el ?? inputRef.current;
    if (!ta) return;
    ta.style.height = "40px";
    const max = 240;
    const newH = Math.min(Math.max(ta.scrollHeight, 40), max);
    ta.style.height = `${newH}px`;
    ta.style.overflow = newH >= max ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeInput();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isThinking) return;
    const nextMessages = [
      ...chatMessages,
      { id: Date.now(), role: "user" as const, text: trimmed },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsThinking(true);

    try {
      const response = await apiFetch<LessonAssistantResponse>(
        "/lessons/assistant/respond",
        {
          method: "POST",
          body: JSON.stringify({
            userQuestion: trimmed,
            sessionId: lessonSession?.sessionId ?? null,
            courseId,
            courseTopic,
            courseTitle,
            nodeId,
            nodeTitle,
            nodeDescription,
            activePhase: lessonSession?.activePhase ?? LESSON_SESSION_PHASE.PRIMARY,
            stageIndex: stageIdx,
            totalStages,
            currentStage,
            conversation: nextMessages.map((message) => ({
              role: message.role,
              content: message.text,
            })),
          }),
        }
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: response.answer,
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            error instanceof ApiError
              ? error.detail
              : "I couldn't answer that lesson question right now.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [
    chatInput,
    chatMessages,
    courseTitle,
    courseTopic,
    currentStage,
    isThinking,
    lessonSession?.activePhase,
    lessonSession?.sessionId,
    nodeDescription,
    nodeId,
    nodeTitle,
    courseId,
    stageIdx,
    totalStages,
  ]);

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    },
    [handleChatSend]
  );

  const handleMicDown = useCallback(() => {
    if (isRecording) return;
    setIsRecording(true);
    setChatInput("");
  }, [isRecording]);

  const handleMicUp = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    setChatInput("Help me with this stage.");
  }, [isRecording]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: "spring", damping: 18 }}
      className="flex w-full flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-lg shadow-teal-200/20 backdrop-blur-xl"
      style={{ height: "calc(100vh - 80px)" }}
    >
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full shadow-md">
          <Image
            src="/homeicon.ico"
            alt="Lesson tutor avatar"
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h3 className="font-heading text-[15px] font-bold text-brand-gray-700">
            Lesson Tutor
          </h3>
          <p className="mt-0.5 text-xs text-brand-gray-400">
            Ask for hints, concepts, or help on this lesson stage.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-3">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-brand-teal"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="max-w-[200px] text-xs leading-relaxed text-brand-gray-400">
              Ask about the current lesson, node, or stage.
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-md bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white"
                  : "rounded-bl-md border border-white/60 bg-white/70 text-brand-gray-600 shadow-sm"
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        {isThinking && (
          <p className="px-1 text-xs text-brand-gray-400">
            Thinking through this lesson context...
          </p>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />

      <div className="flex items-center gap-2 px-5 py-3">
        <div className="relative flex-1">
          {isRecording ? (
            <div className="flex h-[40px] items-center justify-center gap-[6px] rounded-xl border border-brand-teal/40 bg-white/70 px-4 py-3 ring-2 ring-brand-teal/30">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-brand-teal"
                  animate={{
                    height: [4, 16 + Math.random() * 8, 6, 20, 4],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                resizeInput(e.target);
              }}
              onInput={(e) => resizeInput(e.currentTarget)}
              onKeyDown={handleChatKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={isThinking}
              className="h-10 w-full resize-none rounded-xl border border-white/60 bg-white/70 px-4 py-[10px] text-[13px] leading-[18px] text-brand-gray-700 placeholder-brand-gray-300 focus:border-brand-teal/40 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              style={{ maxHeight: 240, overflow: "hidden" }}
            />
          )}
        </div>
        <motion.button
          onMouseDown={handleMicDown}
          onMouseUp={handleMicUp}
          onMouseLeave={handleMicUp}
          onTouchStart={handleMicDown}
          onTouchEnd={handleMicUp}
          className={`flex h-10 w-10 flex-shrink-0 select-none items-center justify-center rounded-xl border border-white/60 shadow-md ${
            isRecording
              ? "bg-red-500 text-white"
              : "bg-white/70 text-brand-teal hover:bg-brand-teal/10"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 01-14 0v-1" />
            <line x1="12" y1="18" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </motion.button>
        <motion.button
          onClick={handleChatSend}
          whileTap={{ scale: 0.9 }}
          disabled={isThinking}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white shadow-md shadow-teal-300/30 transition-all hover:shadow-lg hover:shadow-teal-300/40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}
