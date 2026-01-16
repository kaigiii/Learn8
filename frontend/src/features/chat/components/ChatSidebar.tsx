/**
 * 檔案名稱: features/chat/components/ChatSidebar.tsx
 * 功能描述: AI 課程架構師聊天室 (Architect Chat Sidebar)
 * 
 * 允許使用者與 AI Architect 進行對話，以微調 (Refine) 課程大綱。
 * 
 * 主要功能:
 * - 即時對話: 顯示 User 與 Model 的訊息串。
 * - 觸發修改: 使用者輸入指令後，由上層組件呼叫後端 `refine_syllabus`。
 * - 狀態回饋: 顯示 "Architecting updates..." 等待動畫。
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils'; // Assuming you have a cleanup utility or just use string concat if not

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

interface ChatSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isRefining: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    isOpen,
    onToggle,
    messages,
    onSendMessage,
    isRefining
}) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || isRefining) return;
        onSendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Toggle Button (Visible when closed) */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        onClick={onToggle}
                        className="absolute bottom-6 right-6 z-30 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                    >
                        <MessageSquare className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Sidebar Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: 320, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 320, opacity: 0 }}
                        className="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl z-40 border-l border-slate-200 flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                <Sparkles className="w-4 h-4 text-blue-500" />
                                <span>Refine Syllabus</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 hover:bg-slate-200 rounded-full">
                                <X className="w-4 h-4 text-slate-500" />
                            </Button>
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30"
                        >
                            {messages.length === 0 && (
                                <div className="text-center text-sm text-slate-400 mt-10 px-4">
                                    <p>Talk to the Architect.</p>
                                    <p className="mt-2">"Add a unit on Derivatives"</p>
                                    <p>"Make the exercises harder"</p>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white ml-auto rounded-br-sm"
                                            : "bg-white border border-slate-200 text-slate-700 mr-auto rounded-bl-sm shadow-sm"
                                    )}
                                >
                                    {msg.content}
                                </div>
                            ))}

                            {isRefining && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 ml-2 animate-pulse">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Architecting updates...</span>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="relative flex items-center">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type instructions..."
                                    className="pr-10 py-6 text-sm resize-none"
                                    disabled={isRefining}
                                />
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    disabled={!input.trim() || isRefining}
                                    className="absolute right-1 top-1.5 h-9 w-9 bg-transparent hover:bg-slate-100 text-blue-600 disabled:text-slate-300"
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
