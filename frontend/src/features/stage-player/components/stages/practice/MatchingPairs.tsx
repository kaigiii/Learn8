import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MatchingPairsProps {
    stage: LessonStage;
    onSubmit: (input: unknown, isCorrect: boolean) => void;
}

interface MatchingPair {
    id: string;
    left: string;
    right: string;
}

interface LinePoint {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    id: string;
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
    const [rightOptions] = useState<string[]>(() => shuffle(pairs.map((pair) => pair.right)));
    const [linePoints, setLinePoints] = useState<LinePoint[]>([]);

    const boardRef = useRef<HTMLDivElement | null>(null);
    const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const rightOwnerByValue = useMemo(() => {
        const ownerMap: Record<string, string> = {};
        Object.entries(matches).forEach(([leftId, rightValue]) => {
            ownerMap[rightValue] = leftId;
        });
        return ownerMap;
    }, [matches]);

    useEffect(() => {
        const updateLines = () => {
            if (!boardRef.current) {
                setLinePoints([]);
                return;
            }

            const boardRect = boardRef.current.getBoundingClientRect();
            const nextLines = Object.entries(matches)
                .map(([leftId, rightValue]) => {
                    const leftEl = leftRefs.current[leftId];
                    const rightEl = rightRefs.current[rightValue];

                    if (!leftEl || !rightEl) return null;

                    const leftRect = leftEl.getBoundingClientRect();
                    const rightRect = rightEl.getBoundingClientRect();

                    return {
                        id: `${leftId}-${rightValue}`,
                        x1: leftRect.right - boardRect.left,
                        y1: leftRect.top + (leftRect.height / 2) - boardRect.top,
                        x2: rightRect.left - boardRect.left,
                        y2: rightRect.top + (rightRect.height / 2) - boardRect.top,
                    };
                })
                .filter((line): line is LinePoint => Boolean(line));

            setLinePoints(nextLines);
        };

        updateLines();
        window.addEventListener('resize', updateLines);

        const observer = new ResizeObserver(updateLines);
        if (boardRef.current) {
            observer.observe(boardRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateLines);
            observer.disconnect();
        };
    }, [matches, rightOptions]);

    const handleRightClick = (rightValue: string) => {
        if (!selectedLeftId) return;

        setMatches((prev) => {
            const nextMatches = { ...prev };

            const existingOwner = Object.entries(nextMatches).find(
                ([, value]) => value === rightValue
            )?.[0];

            if (existingOwner) {
                delete nextMatches[existingOwner];
            }

            nextMatches[selectedLeftId] = rightValue;
            return nextMatches;
        });

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
        <div className="h-full flex flex-col p-6 max-w-6xl mx-auto">
            <div className="mb-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Matching Pairs
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-600">
                    Select a card on the left, then assign it to the matching card on the right.
                </p>
            </div>

            <div ref={boardRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_120px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-slate-500">Concepts</div>
                    <div className="space-y-3">
                        {pairs.map((pair) => (
                            <div key={pair.id} className="space-y-2">
                                <button
                                    ref={(el) => { leftRefs.current[pair.id] = el; }}
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
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative hidden lg:block">
                    <svg className="absolute inset-0 h-full w-full overflow-visible pointer-events-none">
                        {linePoints.map((line) => (
                            <g key={line.id}>
                                <line
                                    x1={line.x1}
                                    y1={line.y1}
                                    x2={line.x2}
                                    y2={line.y2}
                                    stroke="#2563eb"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                                <circle cx={line.x1} cy={line.y1} r="4" fill="#2563eb" />
                                <circle cx={line.x2} cy={line.y2} r="4" fill="#2563eb" />
                            </g>
                        ))}
                    </svg>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-slate-500">Matches</div>
                    <div className="space-y-3">
                        {rightOptions.map((rightValue) => {
                            const owner = rightOwnerByValue[rightValue];
                            return (
                                <button
                                    key={rightValue}
                                    ref={(el) => { rightRefs.current[rightValue] = el; }}
                                    type="button"
                                    onClick={() => handleRightClick(rightValue)}
                                    disabled={!selectedLeftId && !owner}
                                    className={cn(
                                        'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                                        owner
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                            : selectedLeftId
                                                ? 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                                : 'border-slate-200 bg-slate-50 text-slate-400'
                                    )}
                                >
                                    <div className="font-medium">{rightValue}</div>
                                </button>
                            );
                        })}
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
