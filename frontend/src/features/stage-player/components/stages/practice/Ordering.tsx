/**
 * 檔案名稱: features/stage-player/components/stages/practice/Ordering.tsx
 * 功能描述: 排序器 (Ordering) - 練習組件
 */
import React, { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderingProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface StepItem {
    id: string;
    content: string;
}

export const Ordering: React.FC<OrderingProps> = ({ stage, onSubmit }) => {
    const [items, setItems] = useState<StepItem[]>([]);
    const [submitted, setSubmitted] = useState(false);

    const getLabel = (step: any) => {
        if (typeof step === 'string') return step;
        if (typeof step === 'object' && step) return step.text || step.label || step.content || step.id || JSON.stringify(step);
        return String(step);
    };

    useEffect(() => {
        const rawSteps = (stage.config.data as any)?.steps || [];

        const createItem = (step: any, index: number) => {
            const label = getLabel(step);
            return {
                id: `step-${index}-${label.substring(0, 5).replace(/\s/g, '')}`,
                content: label
            };
        };

        if (stage.config.initialState?.order?.length) {
            const order = stage.config.initialState.order;
            setItems(order.map((step: any, index: number) => createItem(step, index)));
            return;
        }

        const shuffled = [...rawSteps].sort(() => Math.random() - 0.5);
        setItems(shuffled.map((step: any, index: number) => createItem(step, index)));
    }, [stage.config]);

    const handleCheck = () => {
        setSubmitted(true);

        const rawSteps = (stage.config.data as any)?.steps || [];
        const correctOrderLabels = rawSteps.map(getLabel);
        const currentContentOrder = items.map((item) => item.content);
        const isCorrect = JSON.stringify(currentContentOrder) === JSON.stringify(correctOrderLabels);

        onSubmit(currentContentOrder, isCorrect);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-xl mx-auto">
            <div className="mb-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Ordering
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-600">Drag the items into the correct order.</p>
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
