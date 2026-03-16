/**
 * 檔案名稱: features/stage-player/components/stages/practice/Sequencer.tsx
 * 功能描述: 排序器 (Sequencer) - 練習組件
 * 
 * 簡單的線性排序練習。
 * 
 * 互動邏輯:
 * 1. 亂序列出歷史事件、實驗步驟或程式碼行。
 * 2. 使用者拖曳排序至正確的時間軸或順序。
 */
import React, { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SequencerProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface StepItem {
    id: string;
    content: string;
}

export const Sequencer: React.FC<SequencerProps> = ({ stage, onSubmit }) => {
    // Config expects: data: { steps: ["Step 1", "Step 2"] }
    // We transform strings to objects with IDs for Reorder key stability
    const [items, setItems] = useState<StepItem[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // Helper to get text from step
    const getLabel = (step: any) => {
        if (typeof step === 'string') return step;
        if (typeof step === 'object' && step) return step.text || step.label || step.content || step.id || JSON.stringify(step);
        return String(step);
    };

    useEffect(() => {
        const rawSteps = (stage.config.data as any)?.steps || [];

        const createItem = (s: any, i: number) => {
            const label = getLabel(s);
            return {
                id: `step-${i}-${label.substring(0, 5).replace(/\s/g, '')}`,
                content: label
            };
        };

        // Use initial state order if available, else shuffle
        if (stage.config.initialState && stage.config.initialState.order && stage.config.initialState.order.length > 0) {
            const order = stage.config.initialState.order;
            setItems(order.map((s: any, i: number) => createItem(s, i)));
        } else {
            // Shuffle initially to make it a puzzle
            const shuffled = [...rawSteps].sort(() => Math.random() - 0.5);
            setItems(shuffled.map((s: any, i: number) => createItem(s, i)));
        }
    }, [stage.config]);

    const handleCheck = () => {
        setSubmitted(true);
        // Compare current order with original "correct" order from config.data.steps
        // We assume config.data.steps is the truth. 
        // We need to compare specific extracted labels because users sorted labels.

        const rawSteps = (stage.config.data as any)?.steps || [];
        const correctOrderLabels = rawSteps.map(getLabel);
        const currentContentOrder = items.map(i => i.content);

        const isCorrect = JSON.stringify(currentContentOrder) === JSON.stringify(correctOrderLabels);

        onSubmit(currentContentOrder, isCorrect);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-xl mx-auto">
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-600">Drag the steps into the correct logical order.</p>
            </div>

            <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex flex-col gap-3 flex-1">
                {items.map((item) => (
                    <Reorder.Item key={item.id} value={item} className="relative">
                        <div className={cn(
                            "bg-white border rounded-lg p-4 shadow-sm flex items-center gap-4 cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors select-none",
                            submitted ? "border-slate-200 cursor-default" : "border-slate-200"
                        )}>
                            <div className="text-slate-400 shrink-0">
                                <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="font-medium text-slate-700">
                                {item.content}
                            </div>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            <div className="mt-8 flex justify-end">
                <Button onClick={handleCheck} disabled={submitted} className="w-full sm:w-auto">
                    Check Order
                </Button>
            </div>
        </div>
    );
};
