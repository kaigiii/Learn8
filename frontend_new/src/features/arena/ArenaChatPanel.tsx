"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export function ArenaChatPanel() {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { id: number; role: "user" | "assistant"; text: string }[]
  >([]);
  const [isRecording, setIsRecording] = useState(false);
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

  const streamFakeAssistantOutput = useCallback(async (aiOutput: string, delay: number) => {
    const assistantId = Date.now() + 2;
    const assistantMsg = { id: assistantId, role: "assistant" as const, text: "" };
    setChatMessages((prev) => [...prev, assistantMsg]);
    for (const ch of aiOutput) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, delay));
      setChatMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + ch } : m))
      );
    }
  }, []);

  const cannedResponse = `保護性構造(Protectivestructure)：Pericardium(心包膜)、Pericardialfluid(心包液)、Fibrouspericardium(纖維性心包膜)
 
肌肉構造(Muscularstructure)： Myocardium(心肌層)、Cardiacmusclefibers(心肌纖維)、Intercalateddiscs(閏盤)
 
選項詳細解釋
 
1.保護性構造(Protectivestructure)
 
這類構造的主要功能是固定心臟位置、減少摩擦並防止過度擴張。
 
Pericardium(心包膜)：包圍心臟的雙層囊狀結構。它像一個保護套，將心臟與周圍器官隔開。
Pericardialfluid(心包液)：存在於兩層心包膜之間的潤滑液。心臟跳動時，它能減少摩擦，保護心臟表面不被磨損。
Fibrouspericardium(纖維性心包膜)：這是心包膜最外層，由堅韌的結締組織組成。它的作用是防止心臟過度充血膨脹，並將心臟固定在胸腔中。
 
2.肌肉構造(Muscularstructure)
 
這類構造直接參與心臟的收縮與訊號傳導，是心臟跳動（幫浦功能）的核心。
 
Myocardium(心肌層)：這是心臟壁中最厚的一層，由心肌細胞組成。它是心臟收縮與舒張的主體。
Cardiacmusclefibers(心肌纖維)：指的就是組成心肌的細胞。它們具有自動律動性，能協同收縮。
Intercalateddiscs(閏盤)：這是心肌細胞特有的連接結構。它含有縫隙連接（Gapjunctions），能讓電訊號快速在細胞間傳導，確保心臟肌肉能同步收縮。`;

  const handleChatSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const userMsg = { id: Date.now(), role: "user" as const, text: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    void streamFakeAssistantOutput(cannedResponse, 20);
  }, [cannedResponse, chatInput, streamFakeAssistantOutput]);

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
    const micText = "麥克風測試";
    const userMsg = { id: Date.now(), role: "user" as const, text: micText };
    setChatMessages((prev) => [...prev, userMsg]);
    void streamFakeAssistantOutput(cannedResponse, 40);
  }, [cannedResponse, isRecording, streamFakeAssistantOutput]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: "spring", damping: 18 }}
      className="flex w-full flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-lg shadow-teal-200/20 backdrop-blur-xl"
      style={{ height: "calc(100vh - 80px)" }}
    >
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="relative h-14 w-14 flex-shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-md">
            <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none">
              <ellipse cx="20" cy="24" rx="12" ry="10" fill="#C47F17" />
              <circle cx="15" cy="20" r="5" fill="white" />
              <circle cx="25" cy="20" r="5" fill="white" />
              <circle cx="15" cy="20" r="2.5" fill="#2D2D2D" />
              <circle cx="25" cy="20" r="2.5" fill="#2D2D2D" />
              <circle cx="16" cy="19" r="1" fill="white" />
              <circle cx="26" cy="19" r="1" fill="white" />
              <polygon points="20,22 18,25 22,25" fill="#FF9500" />
              <polygon points="10,16 8,8 15,14" fill="#C47F17" />
              <polygon points="30,16 32,8 25,14" fill="#C47F17" />
            </svg>
          </div>
        </div>
        <div>
          <h3 className="font-heading text-[15px] font-bold text-brand-gray-700">
            AI Chat Assistant
          </h3>
          <p className="mt-0.5 text-xs text-brand-gray-400">
            Ask me anything about this stage!
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
              Type a message to get help from your AI study companion!
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
