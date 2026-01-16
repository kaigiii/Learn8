import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DilemmaSolverProps {
    stage: LessonStage;
    onSubmit: (input: any, isCorrect: boolean) => void;
}

interface Option {
    id: string;
    text: string;
    feedback?: string;
}

interface DilemmaData {
    scenario: string;
    options: Option[];
}

export const DilemmaSolver: React.FC<DilemmaSolverProps> = ({ stage, onSubmit }) => {
    const data = stage.config.data as DilemmaData;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<boolean | null>(null);
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

    const handleCheck = () => {
        if (!selectedId) return;
        setSubmitted(true);

        // Validation logic
        // Expect validation.condition to be { "choice": "correctId" } OR validation.type="exact" checking against known correct ID
        // Often simpler: Config might have "correctId". 
        // Let's rely on stage.validation.condition.choice being the correct ID string.

        let correctId = "";
        if (stage.validation.condition && stage.validation.condition.choice) {
            correctId = stage.validation.condition.choice;
        } else {
            // Fallback: maybe first option is correct? Unsafe. 
            // Assume architect puts correct answer in validation.
        }

        const isCorrect = selectedId === correctId;
        setResult(isCorrect);

        // Find specific feedback for this option
        const selectedOption = data.options.find(o => o.id === selectedId);
        if (selectedOption?.feedback) {
            setFeedbackMsg(selectedOption.feedback);
        } else {
            setFeedbackMsg(stage.feedback[isCorrect ? 'success' : 'error']);
        }

        // Delay submission to show feedback UI, or submit immediately?
        // Let's submit after a delay so user sees the result card effect
        setTimeout(() => {
            onSubmit(selectedId, isCorrect);
        }, 2000);
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-3xl mx-auto">
            <div className="mb-8">
                <span className="text-xs font-bold text-violet-500 tracking-wider uppercase mb-2 block">Dilemma / Decision</span>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{stage.topic}</h2>
                <div className="bg-violet-50 border border-violet-100 p-6 rounded-xl text-lg text-slate-700 leading-relaxed shadow-sm">
                    {data.scenario}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.options.map((option) => (
                    <motion.div
                        key={option.id}
                        whileHover={!submitted ? { scale: 1.02 } : {}}
                        whileTap={!submitted ? { scale: 0.98 } : {}}
                        onClick={() => !submitted && setSelectedId(option.id)}
                        className={cn(
                            "cursor-pointer p-6 rounded-xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden",
                            selectedId === option.id
                                ? "border-violet-500 bg-violet-50 shadow-md"
                                : "border-slate-200 bg-white hover:border-violet-200",
                            submitted && selectedId === option.id && result === true ? "border-green-500 bg-green-50" : "",
                            submitted && selectedId === option.id && result === false ? "border-red-500 bg-red-50" : "",
                            submitted && selectedId !== option.id ? "opacity-50" : ""
                        )}
                    >
                        <div className="flex justify-between items-start">
                            <span className="font-semibold text-lg">{option.text}</span>
                            {submitted && selectedId === option.id && result === true && <CheckCircle className="text-green-500" />}
                            {submitted && selectedId === option.id && result === false && <XCircle className="text-red-500" />}
                        </div>

                        {/* Feedback overlay */}
                        {submitted && selectedId === option.id && feedbackMsg && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-2 text-sm font-medium"
                            >
                                <span className={result ? "text-green-700" : "text-red-700"}>
                                    {feedbackMsg}
                                </span>
                            </motion.div>
                        )}
                    </motion.div>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <Button
                    size="lg"
                    onClick={handleCheck}
                    disabled={!selectedId || submitted}
                    className="bg-violet-600 hover:bg-violet-700"
                >
                    {submitted ? (result ? "Success" : "Reviewing...") : "Make Choice"}
                </Button>
            </div>
        </div>
    );
};
