import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LessonStage } from '@/types/lesson';

interface LogicChainProps {
    stage: LessonStage;
    onSubmit: (userInput: any, isCorrect: boolean) => void;
}

export const LogicChain: React.FC<LogicChainProps> = ({ stage, onSubmit }) => {
    // Config: { data: { nodes: ["A", "B"], connections: [...] } }
    // Ideally this is a node-graph editor. For MVP, let's treat it as a "Reorder Steps" value chain.

    // Check if we have valid data
    // Check if we have valid data, with fallbacks for common LLM hallucinations
    const rawData = stage.config.data || {};
    const nodes = rawData.nodes || rawData.steps || rawData.items || [];

    // State for the current order of nodes
    const [currentOrder, setCurrentOrder] = useState<string[]>(nodes);

    // Simple drag-and-drop simulation (click to move up/down could be easier for MVP without dnd-kit)
    // Or just "Select the next step".

    // Let's go with: "Click steps in the correct order" which builds a chain.
    const [chain, setChain] = useState<string[]>([]);
    const [options, setOptions] = useState<string[]>(nodes);

    // Helper to extract text from a node (string or object)
    const getLabel = (node: any) => {
        if (typeof node === 'string') return node;
        if (typeof node === 'object' && node) return node.text || node.label || node.id || JSON.stringify(node);
        return String(node);
    };

    const handleSelect = (option: any) => {
        setChain([...chain, option]);
        setOptions(options.filter(o => o !== option));
    };

    const handleReset = () => {
        setChain([]);
        setOptions(nodes);
    };

    const handleCheck = () => {
        // ... calculation ...
        onSubmit(chain, true);
    };

    return (
        <div className="flex flex-col items-center max-w-2xl mx-auto p-6 space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">{stage.topic}</h2>
                <p className="text-slate-600">Reconstruct the logical flow.</p>
            </div>

            {/* The Chain being built */}
            <div className="w-full space-y-4">
                {chain.map((step, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative flex flex-col items-center"
                    >
                        <div className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-900 font-medium text-center shadow-sm">
                            {getLabel(step)}
                        </div>
                        {idx < chain.length + options.length - 1 && (
                            <ArrowDown className="w-6 h-6 text-slate-300 my-1" />
                        )}
                    </motion.div>
                ))}

                {/* Placeholder */}
                {options.length > 0 && (
                    <div className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 bg-slate-50">
                        Select next step below...
                    </div>
                )}
            </div>

            {/* Options Pool */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {options.map((option, idx) => (
                    <Button
                        key={idx}
                        variant="outline"
                        onClick={() => handleSelect(option)}
                        className="h-auto py-3 text-wrap text-left justify-start hover:border-blue-400 hover:bg-blue-50"
                    >
                        {getLabel(option)}
                    </Button>
                ))}
            </div>

            <div className="flex gap-4">
                <Button variant="ghost" onClick={handleReset} disabled={chain.length === 0}>
                    Reset
                </Button>
                <Button onClick={handleCheck} disabled={options.length > 0} className="w-32">
                    Check
                </Button>
            </div>
        </div>
    );
};
