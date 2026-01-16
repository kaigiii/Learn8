import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { Check, X, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for what the LLM generates in config.data
interface TaxonomyData {
    buckets: string[]; // e.g., ["Metal", "Non-Metal"]
    items: {
        id: string;
        content: string;
        correctBucket: string; // Validation logic needs this, or we check config separately
    }[];
}

interface TaxonomyMatrixProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

export const TaxonomyMatrix: React.FC<TaxonomyMatrixProps> = ({ stage, onSubmit }) => {
    // Robust data access using useMemo to prevent infinite render loops
    const data = React.useMemo(() => {
        const rawData = stage.config.data || {};
        const buckets = rawData.buckets || rawData.categories || rawData.groups || [];
        let items = rawData.items || rawData.elements || [];

        // Ensure items have unique IDs
        items = items.map((item: any, i: number) => ({
            ...item,
            id: item.id || `item-${i}`,
            content: item.content || item.value || item.text || "Unknown"
        }));

        // Deduplicate IDs
        const seen = new Set();
        items = items.map((item: any, i: number) => {
            if (seen.has(item.id)) {
                return { ...item, id: `${item.id}-${i}` };
            }
            seen.add(item.id);
            return item;
        });

        return { buckets, items } as TaxonomyData;
    }, [stage.config.data]);

    // Map itemId -> bucketName (or null if unassigned)
    const [assignments, setAssignments] = useState<Record<string, string | null>>({});
    const [checked, setChecked] = useState(false);
    const [results, setResults] = useState<Record<string, boolean>>({}); // itemId -> wasCorrect

    // Initialize state
    useEffect(() => {
        const initial: Record<string, string | null> = {};
        data.items.forEach((item: any) => {
            initial[item.id] = null;
        });
        // Load initial state if exists (e.g. from DB save)
        if (stage.config.initialState && stage.config.initialState.assignments) {
            setAssignments({ ...initial, ...stage.config.initialState.assignments });
        } else {
            setAssignments(initial);
        }
    }, [data, stage.config.initialState]);

    const handleDrop = (itemId: string, bucket: string) => {
        if (checked) return; // Locked after check
        setAssignments(prev => ({
            ...prev,
            [itemId]: bucket
        }));
    };

    const handleUnassign = (itemId: string) => {
        if (checked) return;
        setAssignments(prev => ({
            ...prev,
            [itemId]: null
        }));
    };

    const handleCheck = () => {
        const newResults: Record<string, boolean> = {};
        let isAllCorrect = true;

        data.items.forEach((item: any) => {
            const assigned = assignments[item.id];
            // Flexible validation: Check against item's internal correctBucket field if present,
            // or pass detailed validation logic. For MVP, we assume item has `correctBucket`.

            // If the LLM didn't put correctBucket in items (it might put it in validation.condition),
            // we'd need to parse that. But let's assume the Architect puts it in items for this component.
            // Fallback: Check if validation.condition has a mapping.

            let correctBucket = item.correctBucket;

            // Fallback config check
            if (!correctBucket && stage.validation.type === 'exact') {
                // assume validation.condition is { "itemId": "BucketName" }
                correctBucket = stage.validation.condition[item.id];
            }

            const isCorrect = assigned === correctBucket;
            newResults[item.id] = isCorrect;
            if (!isCorrect) isAllCorrect = false;
        });

        setResults(newResults);
        setChecked(true);

        // Wait a bit before submitting to show visual feedback? Or submit immediately?
        // Let's submit immediately so the system handles logic
        if (isAllCorrect) {
            setTimeout(() => onSubmit(assignments, true), 800);
        } else {
            // Allow retry?
            // onSubmit(assignments, false); // If we want to trigger remedial immediately
        }
    };

    const handleReset = () => {
        setChecked(false);
        setResults({});
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-slate-600">Drag each item into the correct category.</p>
            </div>

            {/* Buckets Area */}
            <div className="flex gap-4 mb-8 min-h-[200px]">
                {data.buckets.map((bucket: string) => (
                    <div
                        key={bucket}
                        className="flex-1 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 p-4 flex flex-col gap-2 relative transition-colors hover:bg-slate-50 hover:border-blue-300"
                    >
                        <h3 className="font-bold text-center text-slate-700 mb-2 uppercase tracking-wide text-sm">{bucket}</h3>

                        {/* Render items assigned to this bucket */}
                        <AnimatePresence>
                            {data.items.filter((item: any) => assignments[item.id] === bucket).map((item: any) => (
                                <BucketItem
                                    key={item.id}
                                    item={item}
                                    result={checked ? results[item.id] : undefined}
                                    onClick={() => handleUnassign(item.id)}
                                />
                            ))}
                        </AnimatePresence>

                        {/* Hit Area Overlay (Simulated drop zone logic handled by item drag end usually, 
                            but for simple drag in Framer, we often rely on visually moving items or explicit state buttons.
                            
                            BETTER APPROACH for simplicity:
                            Click item -> Select -> Click bucket?
                            OR Drag?
                            Let's do: Render UNASSIGNED items at bottom. 
                            Users drag them to buckets.
                            This requires `layout` prop for smooth animation.
                        */}
                    </div>
                ))}
            </div>

            {/* Unassigned Items Pool */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[150px]">
                <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase">Unassigned Items</h4>
                <div className="flex flex-wrap gap-3">
                    {data.items.filter((item: any) => !assignments[item.id]).map((item: any) => (
                        <DraggableItem
                            key={item.id}
                            item={item}
                            buckets={data.buckets}
                            onDrop={handleDrop}
                        />
                    ))}
                    {data.items.every((i: any) => assignments[i.id]) && (
                        <div className="text-slate-400 text-sm italic w-full text-center py-4">
                            All items placed. Ready to check!
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-end gap-4">
                {checked && !Object.values(results).every(r => r) && (
                    <Button variant="outline" onClick={handleReset}>Try Again</Button>
                )}
                <Button
                    onClick={handleCheck}
                    disabled={Object.values(assignments).some(v => v === null) || (checked && Object.values(results).every(r => r))}
                    className="w-40"
                >
                    {checked ? (Object.values(results).every(r => r) ? "Perfect!" : "Check Again") : "Check Answers"}
                </Button>
            </div>
        </div>
    );
};

// Sub-components

// Helper to safely extract text from varied LLM outputs
const getLabel = (item: any) => {
    if (!item) return "";
    if (typeof item === 'string') return item;
    return item.content || item.value || item.text || item.label || item.id || "???";
};

const BucketItem = ({ item, result, onClick }: { item: any, result?: boolean, onClick: () => void }) => {
    return (
        <motion.div
            layoutId={item.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
                "p-3 rounded-lg shadow-sm font-medium text-sm flex justify-between items-center cursor-pointer hover:bg-opacity-80 transition-all",
                result === true ? "bg-green-100 text-green-800 border-green-200" :
                    result === false ? "bg-red-100 text-red-800 border-red-200" :
                        "bg-white text-slate-700 border border-slate-200"
            )}
            onClick={onClick}
        >
            <span>{getLabel(item)}</span>
            {result === true && <Check className="w-4 h-4 ml-2" />}
            {result === false && <X className="w-4 h-4 ml-2" />}
        </motion.div>
    )
}

const DraggableItem = ({ item, buckets, onDrop }: { item: any, buckets: string[], onDrop: (id: string, b: string) => void }) => {
    // For MVP, instead of complex collision detection, allow Click-to-Choose-Bucket or simple Drag
    // Let's implement a simple Popover or "Click item, then buttons appear"
    // OR simpler: Drag in Framer is tricky without collision. 
    // Let's use "Click to assign" for maximum reliability on mobile/desktop without dnd libs.

    // Better UX: Dropdown/Select? No.
    // Let's do: Render small buttons *below* the item when hovered/clicked?

    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.div
            layoutId={item.id}
            className="relative group"
        >
            <div
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-2 rounded-full border border-blue-200 cursor-pointer shadow-sm transition-all active:scale-95"
                onClick={() => setIsOpen(!isOpen)}
            >
                {getLabel(item)}
            </div>

            {/* Quick Assign Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 p-2 z-20 min-w-[150px] flex flex-col gap-1">
                    <div className="text-xs font-semibold text-slate-400 px-2 py-1">Move to...</div>
                    {buckets.map(b => (
                        <button
                            key={b}
                            className="text-left px-2 py-1.5 text-sm hover:bg-slate-50 rounded text-slate-700 transition-colors"
                            onClick={() => {
                                onDrop(item.id, b);
                                setIsOpen(false);
                            }}
                        >
                            {b}
                        </button>
                    ))}
                </div>
            )}

            {/* Click outside closer would be nice but handled by click-toggle for now */}
        </motion.div>
    );
};
