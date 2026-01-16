import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { COMPONENT_REGISTRY, FallbackComponent } from './ComponentRegistry';

interface StageRendererProps {
    stages: LessonStage[];
    onExit: () => void;
    onComplete?: () => void;
}

export default function StageRenderer({ stages: initialStages, onExit, onComplete }: StageRendererProps) {
    const [stages, setStages] = useState<LessonStage[]>(initialStages);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const currentStage = stages[currentIndex];
    if (!currentStage) return null;

    const progress = ((currentIndex + 1) / stages.length) * 100;

    const handleNext = () => {
        setMessage(null);
        if (currentIndex < stages.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            if (onComplete) onComplete();
            else onExit();
        }
    };

    const handleSubmit = async (userInput: any, isCorrect: boolean) => {
        setIsSubmitting(true);
        try {
            const response = await apiClient.post('/submit-answer', {
                stageId: currentStage.stageId,
                userInput: userInput,
                isCorrect: isCorrect,
                context_topic: currentStage.topic,
                component: currentStage.component
            });

            const data = response.data;
            setMessage(data.message || (isCorrect ? "Correct!" : "Incorrect"));

            if (data.nextAction === 'remedial' && data.remedialStage) {
                const newStages = [...stages];
                newStages.splice(currentIndex + 1, 0, data.remedialStage);
                setStages(newStages);
            }
        } catch (e) {
            console.error("Submission error", e);
            setMessage("Error connecting to Game Master.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderComponent = () => {
        const Component = COMPONENT_REGISTRY[currentStage.component];

        if (!Component) {
            return <FallbackComponent stage={currentStage} onSkip={() => handleSubmit("skipped", true)} />;
        }

        return <Component stage={currentStage} onSubmit={handleSubmit} />;
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
                <Button variant="ghost" size="icon" onClick={onExit}>
                    <Home className="w-5 h-5 text-slate-500" />
                </Button>
                <span className="font-semibold text-slate-700">
                    Stage {currentIndex + 1} of {stages.length}
                </span>
                <div className="w-10" />
            </div>

            <Progress value={progress} className="h-1 bg-slate-200 shrink-0" indicatorClassName="bg-blue-600 transition-all duration-500" />

            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStage.stageId}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="h-full w-full overflow-y-auto"
                    >
                        {renderComponent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex flex-col items-center gap-4 shrink-0">
                {message && (
                    <div className="text-center font-medium text-slate-800 animate-in fade-in slide-in-from-bottom-2">
                        {message}
                    </div>
                )}

                <div className="flex gap-4 w-full max-w-md justify-between">
                    <Button variant="outline" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    <Button onClick={handleNext} disabled={isSubmitting}>
                        {currentIndex === stages.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
