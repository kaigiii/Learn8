/**
 * 檔案名稱: features/stage-player/components/stages/instruction/TextToken.tsx
 * 功能描述: 對應文本 (Text Token) - 教學組件
 * 
 * 用於語言學習或概念定義的關鍵字重組練習。
 * 
 * 互動邏輯:
 * 1. 提供一段打散的文本或句子。
 * 2. 使用者點擊 Token 依序還原正確的句子結構。
 */
import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LessonStage } from '@/types/lesson';
import { clsx } from 'clsx';

interface TextTokenProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface TokenItem {
    id: string;
    text: string;
}

export default function TextToken({ stage, onSubmit }: TextTokenProps) {
    const [tokens, setTokens] = useState<TokenItem[]>([]);

    useEffect(() => {
        const configData = stage.config.data || {};
        const rawData = configData.text || configData.items || [];
        let items: string[] = [];

        if (typeof rawData === 'string') {
            items = rawData.split(' ').filter(Boolean);
        } else if (Array.isArray(rawData)) {
            items = rawData;
        }

        // Shuffle
        const shuffled = items
            .map((text, i) => ({ id: `${text}-${i}-${Math.random().toString(36).substr(2, 9)}`, text }))
            .sort(() => Math.random() - 0.5);

        setTokens(shuffled);
    }, [stage]);

    const handleSubmit = () => {
        const currentOrder = tokens.map(t => t.text);
        let isCorrect = false;

        if (stage.config.data.text && currentOrder.join(' ') === stage.config.data.text) {
            isCorrect = true;
        }

        console.log("Submitting:", currentOrder, isCorrect);
        onSubmit(currentOrder, isCorrect);
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">{stage.topic}</h2>
                <p className="text-slate-600">Arrange the blocks in the correct order.</p>
            </div>

            <Reorder.Group
                axis="y"
                values={tokens}
                onReorder={setTokens}
                className="flex flex-col gap-2 w-full max-w-md"
            >
                {tokens.map((token) => (
                    <Reorder.Item
                        key={token.id}
                        value={token}
                        whileDrag={{ scale: 1.05 }}
                        className={clsx(
                            "p-4 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing",
                            "flex items-center justify-between font-medium text-slate-700"
                        )}
                    >
                        <span>{token.text}</span>
                        <span className="text-slate-300">≡</span>
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            <Button onClick={handleSubmit} size="lg" className="w-full max-w-xs">
                Check Order
            </Button>
        </div>
    );
}
