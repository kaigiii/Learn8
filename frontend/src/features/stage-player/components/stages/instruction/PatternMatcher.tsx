/**
 * 檔案名稱: features/stage-player/components/stages/instruction/PatternMatcher.tsx
 * 功能描述: 模式匹配器 (Pattern Matcher) - 教學組件
 * 
 * 訓練使用者識別視覺或數據模式的組件。
 * 
 * 互動邏輯:
 * 1. 顯示一組隱含特定模式的圖像或數據。
 * 2. 使用者需找出規律或下一個序列。
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Ensure utils is imported

interface PatternMatcherProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface Card {
    id: string;
    content: string;
    pairId: string; // ID of the OTHER card this matches with
}

export const PatternMatcher: React.FC<PatternMatcherProps> = ({ stage, onSubmit }) => {
    // Config: { pairs: [ {id, left, right} ] } OR { items: [...] }
    const configData = stage.config.data || {};

    const [cards, setCards] = useState<Card[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        let items: Card[] = [];

        // Handle PAIRS structure (Mock Gallery uses this)
        if (configData.pairs) {
            configData.pairs.forEach((pair: any) => {
                const leftId = `${pair.id}-L`;
                const rightId = `${pair.id}-R`;

                items.push({
                    id: leftId,
                    content: pair.left,
                    pairId: rightId
                });
                items.push({
                    id: rightId,
                    content: pair.right,
                    pairId: leftId
                });
            });
        }
        // Handle explicit ITEMS structure (Fallback)
        else if (configData.items) {
            items = configData.items;
        }

        // Initialize and shuffle
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        setCards(shuffled);
    }, [stage.config]);

    const handleCardClick = (id: string) => {
        if (isProcessing || matchedIds.has(id) || selectedId === id) return;

        if (!selectedId) {
            // First pick
            setSelectedId(id);
        } else {
            // Second pick
            const firstCard = cards.find(c => c.id === selectedId);
            const secondCard = cards.find(c => c.id === id);

            if (!firstCard || !secondCard) return;

            setIsProcessing(true);

            // Check match
            // We assume 'pairId' structure or a 'groupId'. 
            // If the data structure has 'pairId' pointing to the other card's ID:
            const isMatch = firstCard.pairId === secondCard.id && secondCard.pairId === firstCard.id;
            // Or simpler: they share a 'groupId'. Let's check matching logic.

            if (isMatch) {
                // Success
                const newMatched = new Set(matchedIds);
                newMatched.add(firstCard.id);
                newMatched.add(secondCard.id);
                setMatchedIds(newMatched);
                setSelectedId(null);
                setIsProcessing(false);

                // Check Win
                if (newMatched.size === cards.length) {
                    setTimeout(() => onSubmit(newMatched, true), 1000);
                }
            } else {
                // Fail
                setTimeout(() => {
                    setSelectedId(null);
                    setIsProcessing(false);
                }, 1000); // Delay to show wrong state
            }
        }
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            <div className="mb-6 text-center">
                <span className="text-xs font-bold text-pink-500 tracking-wider uppercase mb-2 block">Pattern Recognition</span>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-500">Find the matching pairs.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
                {cards.map((card) => {
                    const isSelected = selectedId === card.id;
                    const isMatched = matchedIds.has(card.id);
                    const isWrong = isSelected && isProcessing && !isMatched; // simplistic wrong state logic

                    return (
                        <motion.button
                            key={card.id}
                            layout
                            onClick={() => handleCardClick(card.id)}
                            whileHover={!isMatched && !isProcessing ? { scale: 1.05 } : {}}
                            whileTap={!isMatched && !isProcessing ? { scale: 0.95 } : {}}
                            className={cn(
                                "rounded-xl p-4 flex items-center justify-center text-center font-medium shadow-sm border-2 transition-all min-h-[120px] text-lg",
                                isMatched
                                    ? "bg-green-100 border-green-400 text-green-800 opacity-50 cursor-default"
                                    : isSelected
                                        ? "bg-pink-50 border-pink-400 text-pink-700 ring-2 ring-pink-200"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-pink-200"
                            )}
                        >
                            {card.content}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
