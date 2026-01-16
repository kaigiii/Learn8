/**
 * 檔案名稱: frontend/src/components/ui/RegenerateDialog.tsx
 * 功能描述: 課程大綱重新生成對話框 (Syllabus Regeneration Modal)
 * 
 * 此組件提供使用者一個確認視窗，用於觸發「重新生成大綱」的功能。
 * 它允許使用者修改原本的 Topic Prompt，並警告此操作將會清除目前的學習進度。
 * 
 * Props:
 *     - isOpen: boolean - 控制對話框是否顯示。
 *     - onClose: function - 關閉對話框的回調。
 *     - currentTopic: string - 預填的當前主題。
 *     - onConfirm: async function - 使用者點擊確認後的處理函式 (呼叫 API)。
 *     - isRegenerating: boolean - 載入狀態，防止重複點擊。
 * 
 * UI 特色:
 *     - 使用 Framer Motion 實作淡入 (Fade-in) 與縮放 (Scale) 動畫效果 (`AnimatePresence`).
 *     - 包含 AlertTriangle 警告區塊，強調資料遺失風險。
 *     - 支援鎖定狀態 (Generating...)，按鈕與輸入框會變為 Disabled。
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RegenerateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentTopic: string;
    onConfirm: (newTopic: string) => Promise<void>;
    isRegenerating: boolean;
}

export const RegenerateDialog: React.FC<RegenerateDialogProps> = ({
    isOpen,
    onClose,
    currentTopic,
    onConfirm,
    isRegenerating
}) => {
    const [topic, setTopic] = useState(currentTopic);

    // Reset when opening
    React.useEffect(() => {
        if (isOpen) setTopic(currentTopic);
    }, [isOpen, currentTopic]);

    const handleConfirm = async () => {
        if (!topic.trim()) return;
        await onConfirm(topic);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={isRegenerating ? undefined : onClose}
                        className="fixed inset-0 bg-black z-50"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 pointer-events-auto border border-slate-100">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-slate-800 font-semibold text-lg">
                                    <RefreshCw className="w-5 h-5 text-blue-600" />
                                    <span>Regenerate Syllabus</span>
                                </div>
                                {!isRegenerating && (
                                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
                                        <X className="w-4 h-4 text-slate-500" />
                                    </Button>
                                )}
                            </div>

                            {/* Body */}
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg flex gap-2 items-start">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p>
                                        Warning: This will <b>delete all existing progress</b> and generate a completely new syllabus structure.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Topic Prompt</label>
                                    <Input
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="e.g. Introduction to Python"
                                        disabled={isRegenerating}
                                        className="bg-slate-50"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-6 flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isRegenerating}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isRegenerating || !topic.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                                >
                                    {isRegenerating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            Regenerate
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
