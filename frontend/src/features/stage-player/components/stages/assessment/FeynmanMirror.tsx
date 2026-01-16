/**
 * 檔案名稱: features/stage-player/components/stages/assessment/FeynmanMirror.tsx
 * 功能描述: 費曼鏡像 (Feynman Mirror) - 評量組件
 * 
 * 模擬「費曼學習法」的互動組件。
 * 
 * 互動邏輯:
 * 1. 使用者用自己的話解釋一個概念。
 * 2. 提交後，後端 (AI Agent) 扮演費曼的角色進行評分。
 * 3. 系統回饋解釋的準確度、簡單度以及改進建議。
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { User, Bot } from 'lucide-react';

interface FeynmanMirrorProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

export const FeynmanMirror: React.FC<FeynmanMirrorProps> = ({ stage, onSubmit }) => {
    const [explanation, setExplanation] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (!explanation.trim()) return;
        setSubmitted(true);
        // We pass 'false' for isCorrect because backend decides.
        // But for UI optimism, we could pass true? No, adhere to protocol.
        onSubmit(explanation, false);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-2xl mx-auto">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-slate-800 mb-2 font-serif">The Feynman Challenge</h2>
                <p className="text-slate-500">Teach it to learn it.</p>
            </div>

            {/* Feynman Avatar / Prompt */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-6 flex gap-4 items-start"
            >
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-7 h-7 text-orange-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-700">Richard Feynman (AI)</h3>
                    <p className="text-slate-600 leading-relaxed">
                        "Okay, I'm listening. Explain <strong>{stage.topic}</strong> to me in simple terms.
                        Don't use jargon I wouldn't understand. Why does it work?"
                    </p>
                    {/* Display config-specific prompt if exists */}
                    {stage.config.data && (stage.config.data as any).prompt && (
                        <p className="text-slate-500 italic text-sm mt-2">
                            "{(stage.config.data as any).prompt}"
                        </p>
                    )}
                </div>
            </motion.div>

            {/* User Input */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col gap-4"
            >
                <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="w-full">
                        <Textarea
                            value={explanation}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExplanation(e.target.value)}
                            placeholder="Type your explanation here..."
                            className="min-h-[150px] p-4 text-base resize-none focus:ring-orange-500 border-slate-300"
                            disabled={submitted}
                        />
                    </div>
                </div>

                <div className="flex justify-end mt-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={!explanation.trim() || submitted}
                        size="lg"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {submitted ? "Grading..." : "Submit Explanation"}
                    </Button>
                </div>

                {submitted && (
                    <p className="text-center text-sm text-slate-400 mt-2 animate-pulse">
                        Feynman is judging your explanation...
                    </p>
                )}
            </motion.div>
        </div>
    );
};
