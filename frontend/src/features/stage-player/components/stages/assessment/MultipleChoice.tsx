import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LessonStage } from '@/types/lesson';
import { cn } from '@/lib/utils';

interface MultipleChoiceProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface ChoiceOption {
    id: string;
    text: string;
}

export default function MultipleChoice({ stage, onSubmit }: MultipleChoiceProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { question, options, correctOptionId } = useMemo(() => {
        const configData = stage.config.data || {};
        const rawOptions = Array.isArray(configData.options) ? configData.options : [];
        const normalizedOptions: ChoiceOption[] = rawOptions.map((option: unknown, index: number) => {
            if (typeof option === 'string') {
                return { id: `option-${index}`, text: option };
            }

            if (option && typeof option === 'object') {
                const item = option as { id?: string; text?: string; label?: string };
                return {
                    id: item.id || `option-${index}`,
                    text: item.text || item.label || `Option ${index + 1}`
                };
            }

            return { id: `option-${index}`, text: `Option ${index + 1}` };
        });

        return {
            question: configData.question || stage.topic,
            options: normalizedOptions,
            correctOptionId: configData.correctOptionId || stage.validation.condition?.correctOptionId
        };
    }, [stage]);

    const handleSubmit = () => {
        if (!selectedId) return;
        onSubmit(selectedId, selectedId === correctOptionId);
    };

    return (
        <div className="flex h-full flex-col items-center justify-center p-6 space-y-8">
            <div className="max-w-2xl space-y-3 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Multiple Choice
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{question}</h2>
                <p className="text-slate-600">Choose the best answer.</p>
            </div>

            <div className="grid w-full max-w-xl grid-cols-1 gap-3">
                {options.map((option, index) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedId(option.id)}
                        className={cn(
                            'rounded-xl border px-4 py-4 text-left transition-colors shadow-sm',
                            selectedId === option.id
                                ? 'border-blue-500 bg-blue-50 text-blue-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">
                                {String.fromCharCode(65 + index)}
                            </div>
                            <div className="font-medium">{option.text}</div>
                        </div>
                    </button>
                ))}
            </div>

            <Button onClick={handleSubmit} size="lg" className="w-full max-w-xs" disabled={!selectedId}>
                Submit Answer
            </Button>
        </div>
    );
}
