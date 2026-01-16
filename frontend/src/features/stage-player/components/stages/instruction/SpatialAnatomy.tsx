import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { cn } from '@/lib/utils';
import { MousePointer2 } from 'lucide-react';

interface SpatialAnatomyProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface Region {
    id: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    label?: string; // Optional label to show on hover or reveal
}

interface SpatialData {
    modelType?: string; // e.g. "cell", "graph", "anatomy"
    question: string; // "Find the Mitochondria"
    regions: Region[];
}

export const SpatialAnatomy: React.FC<SpatialAnatomyProps> = ({ stage, onSubmit }) => {
    const rawData = stage.config.data || {};

    // Normalize data structure
    // Ensure regions is ALWAYS an array, even if LLM returns garbage or an object
    const regions = Array.isArray(rawData.regions) ? rawData.regions
        : Array.isArray(rawData.labels) ? rawData.labels
            : Array.isArray(rawData.points) ? rawData.points
                : [];

    const data: SpatialData = {
        modelType: rawData.model || rawData.modelType || 'diagram',
        question: rawData.question || rawData.task || rawData.instruction || "Identify the correct region",
        regions: regions
    };

    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [revealed, setRevealed] = useState(false);

    const handleRegionClick = (id: string) => {
        if (revealed) return;
        setSelectedRegion(id);

        // Immediate check logic or wait for button?
        // Immediate feels more like a game.
        setRevealed(true);

        // Validate
        // Expect validation.condition to be { "selectedId": "correctId" }
        // OR simply: The question implies one correct target.
        // Let's assume validation.condition passes the correct ID as { "target": "id" }
        const targetId = (stage.validation.condition as any)?.target;
        const isCorrect = id === targetId;

        setTimeout(() => {
            onSubmit(id, isCorrect);
        }, 1500);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            <div className="mb-6 text-center">
                <span className="text-xs font-bold text-teal-500 tracking-wider uppercase mb-2 block">Spatial / Visual</span>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{stage.topic}</h2>
                <p className="text-lg text-slate-600 font-medium bg-teal-50 inline-block px-4 py-1 rounded-full border border-teal-100">
                    {data.question}
                </p>
            </div>

            {/* Canvas Area - Using a dark bg to simulate an X-ray or specific view */}
            <div className="flex-1 bg-slate-900 rounded-2xl relative overflow-hidden shadow-inner border border-slate-700 min-h-[400px]">

                {/* Simulated Diagram Background (Abstract Grid or SVG pattern) */}
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                </div>

                {/* Regions / Hotspots */}
                {data.regions.map((region) => (
                    <motion.button
                        key={region.id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.2 }}
                        onClick={() => handleRegionClick(region.id)}
                        className={cn(
                            "absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 flex items-center justify-center transition-colors z-10",
                            revealed && region.id === (stage.validation.condition as any)?.target ? "bg-green-500 border-green-300" :
                                revealed && region.id === selectedRegion && region.id !== (stage.validation.condition as any)?.target ? "bg-red-500 border-red-300" :
                                    "bg-white/10 border-white/50 hover:bg-white/30 backdrop-blur-sm"
                        )}
                        style={{ left: `${region.x}%`, top: `${region.y}%` }}
                        disabled={revealed}
                    >
                        {revealed ? (
                            // Show ID or Icon on reveal
                            <span className="text-white font-bold text-xs">{region.id}</span>
                        ) : (
                            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                        )}

                        {/* Hover Tooltip (if not revealed, maybe hide to verify memory?) */}
                    </motion.button>
                ))}

                {/* Central overlay for instruction if needed */}
                {!revealed && (
                    <div className="absolute top-4 right-4 text-white/50 text-xs flex items-center gap-1">
                        <MousePointer2 className="w-3 h-3" /> Click a node to identify
                    </div>
                )}
            </div>

            {/* Legend / Key if needed */}
            <div className="mt-4 flex gap-4 justify-center text-sm text-slate-500">
                {/* Could list items here */}
            </div>
        </div>
    );
};
