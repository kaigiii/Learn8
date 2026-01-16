
/**
 * 檔案名稱: features/course-map/components/NodeDrawer.tsx
 * 功能描述: 節點詳情側邊欄 (Node Detail Drawer)
 * 
 * 當使用者點擊地圖上的節點時，從右側滑出的詳細資訊面板。
 * 
 * 功能:
 * - 顯示元數據: 標題、描述、類型 (Concept/Exercise/Quiz)。
 * - 學習目標: 靜態的學習目標列表 (未來可由 AI 生成)。
 * - 開始按鈕: 呼叫 `onStartLesson` 進入 StagePlayer。(若鎖定則禁用)
 */
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LessonNode } from '@/types/lesson';

interface NodeDrawerProps {
    node: LessonNode | null;
    isOpen: boolean;
    onClose: () => void;
    onStartLesson: (node: LessonNode) => void;
    isGenerating: boolean;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({ node, isOpen, onClose, onStartLesson, isGenerating }) => {
    return (
        <AnimatePresence>
            {isOpen && node && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 p-6 flex flex-col border-l border-slate-200"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{node.title}</h2>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-2 ${node.type === 'concept' ? 'bg-blue-100 text-blue-700' :
                                    node.type === 'exercise' ? 'bg-green-100 text-green-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                    {node.type.toUpperCase()}
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
                                <X className="w-5 h-5 text-slate-500" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <p className="text-slate-600 leading-relaxed">
                                {node.description}
                            </p>
                            <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <h3 className="text-sm font-semibold text-slate-700 mb-2">Learning Objectives</h3>
                                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                                    <li>Understand core concepts of {node.title}</li>
                                    <li>Apply knowledge in interactive scenarios</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <Button
                                onClick={() => onStartLesson(node)}
                                disabled={node.status === 'locked' || isGenerating}
                                className={`w-full h-12 text-lg font-semibold ${node.status === 'locked' ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
                                    }`}
                            >
                                {isGenerating ? 'Generating...' : node.status === 'locked' ? (
                                    <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Locked</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Play className="w-5 h-5" /> Start Lesson</span>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
