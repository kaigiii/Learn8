import React, { useMemo, useState } from 'react';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MatchingPairsProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface MatchingPair {
    id: string;
    left: string;
    right: string;
}

function shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
}

export const MatchingPairs: React.FC<MatchingPairsProps> = ({ stage, onSubmit }) => {
    const pairs = useMemo<MatchingPair[]>(() => {
        const rawPairs = Array.isArray(stage.config.data?.pairs) ? stage.config.data.pairs : [];
        return rawPairs.map((pair: unknown, index: number) => {
            if (pair && typeof pair === 'object') {
                const item = pair as { id?: string; left?: string; right?: string };
                return {
                    id: item.id || `pair-${index}`,
                    left: item.left || `Left ${index + 1}`,
                    right: item.right || `Right ${index + 1}`
                };
            }

            return {
                id: `pair-${index}`,
                left: `Left ${index + 1}`,
                right: `Right ${index + 1}`
            };
        });
    }, [stage.config.data]);

    const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
    const [matches, setMatches] = useState<Record<string, string>>({});
    const [rightOptions, setRightOptions] = useState<string[]>(() => shuffle(pairs.map((pair) => pair.right)));

    React.useEffect(() => {
        setSelectedLeftId(null);
        setMatches({});
        setRightOptions(shuffle(pairs.map((pair) => pair.right)));
    }, [pairs]);

    const remainingRightOptions = rightOptions.filter((option) => !Object.values(matches).includes(option));

    const handleRightClick = (rightValue: string) => {
        if (!selectedLeftId) return;
        setMatches((prev) => ({ ...prev, [selectedLeftId]: rightValue }));
        setSelectedLeftId(null);
    };

    const handleReset = () => {
        setSelectedLeftId(null);
        setMatches({});
        setRightOptions(shuffle(pairs.map((pair) => pair.right)));
    };

    const handleSubmit = () => {
        const isCorrect = pairs.every((pair) => matches[pair.id] === pair.right);
        onSubmit(matches, isCorrect);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto">
            <div className="mb-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Matching Pairs
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-600">Pick one item on the left, then choose its matching item on the right.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-slate-500">Left Side</div>
                    <div className="space-y-3">
                        {pairs.map((pair) => (
                            <button
                                key={pair.id}
                                type="button"
                                onClick={() => setSelectedLeftId(pair.id)}
                                className={cn(
                                    'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                                    selectedLeftId === pair.id
                                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50',
                                    matches[pair.id] && 'border-emerald-300 bg-emerald-50'
                                )}
                            >
                                <div className="font-medium">{pair.left}</div>
                                {matches[pair.id] && (
                                    <div className="mt-2 text-xs text-slate-500">
                                        Matched: {matches[pair.id]}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-slate-500">Right Side</div>
                    <div className="space-y-3">
                        {remainingRightOptions.map((rightValue) => (
                            <button
                                key={rightValue}
                                type="button"
                                onClick={() => handleRightClick(rightValue)}
                                disabled={!selectedLeftId}
                                className={cn(
                                    'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                                    selectedLeftId
                                        ? 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                        : 'border-slate-200 bg-slate-50 text-slate-400'
                                )}
                            >
                                {rightValue}
                            </button>
                        ))}
                        {remainingRightOptions.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                                All pairs matched. Review and submit when ready.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end gap-4">
                <Button variant="outline" onClick={handleReset}>
                    Reset
                </Button>
                <Button onClick={handleSubmit} disabled={Object.keys(matches).length !== pairs.length}>
                    Check Matches
                </Button>
            </div>
        </div>
    );
};
