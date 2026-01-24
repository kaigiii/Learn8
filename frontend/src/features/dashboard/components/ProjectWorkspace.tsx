"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, Save, SkipForward, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api-client';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { projectService } from '@/services/projectService';

interface Question {
    id: string;
    text: string;
    type: string;
    options?: string[];
}

interface ProjectWorkspaceProps {
    projectId: number;
    onGenerateSyllabus: (profileSummary: string) => void;
}

export function ProjectWorkspace({ projectId, onGenerateSyllabus }: ProjectWorkspaceProps) {
    const [topic, setTopic] = useState('');
    const [step, setStep] = useState<"idle" | "generating_questions" | "answering" | "submitting">("idle");


    // Upload State
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const { setFiles } = useProjectStore();
    const { user, refreshUser } = useAuthStore();

    // Questionnaire Data
    // ...

    // Handlers
    // ...

    // Questionnaire Data
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [freeText, setFreeText] = useState("");

    // Draft Status
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Load Draft on Mount or Change
    useEffect(() => {
        // Reset State first
        setTopic('');
        setQuestions([]);
        setAnswers({});
        setFreeText('');
        setStep("idle");
        setFilesToUpload([]);

        if (!projectId) return;

        const loadDraft = async () => {
            try {
                const res = await apiClient.get(`/projects/${projectId}/draft`);
                const draft = res.data.draft || {};

                if (draft.topic) setTopic(draft.topic);
                if (draft.questions) setQuestions(draft.questions);
                if (draft.answers) setAnswers(draft.answers);
                if (draft.freeText) setFreeText(draft.freeText);

                // Determine step
                if (draft.questions && draft.questions.length > 0) {
                    setStep("answering");
                }
            } catch (err) {
                console.error("Failed to load draft", err);
            }
        };
        loadDraft();
    }, [projectId]);

    // 2. Auto-Save Draft
    const saveDraft = async () => {
        setIsSaving(true);
        try {
            await apiClient.put(`/projects/${projectId}/draft`, {
                draft: { topic, questions, answers, freeText }
            });
        } catch (err) {
            console.error("Failed to save draft", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Debounced Save on change
    useEffect(() => {
        if (step === "idle") return; // Don't save empty states eagerly

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveDraft();
        }, 2000);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [topic, questions, answers, freeText, step]);

    // Handlers
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFilesToUpload(Array.from(e.target.files));
        }
    };

    const handleFileIngest = async () => {
        if (!projectId || filesToUpload.length === 0) return;

        setIsUploading(true);
        try {
            await projectService.uploadFiles(projectId, filesToUpload);

            // Refresh file list in store
            setFiles([]);
            const files = await projectService.getFiles(projectId);
            setFiles(files);

            setFilesToUpload([]);
            alert("Upload complete!");
        } catch (error: any) {
            console.error(error);
            alert("Upload failed: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleTopicSubmit = async () => {
        if (!topic) return;
        setStep("generating_questions");

        try {
            const res = await apiClient.post<Question[]>(`/projects/${projectId}/questionnaire`, null, {
                params: { topic },
            });
            setQuestions(res.data);
            setStep("answering");

            // Refresh credits (Cost: 5)
            refreshUser();

            // Immediate save to persistence
            await apiClient.put(`/projects/${projectId}/draft`, {
                draft: { topic, questions: res.data, answers: {}, freeText: "" }
            });
        } catch (err) {
            console.error(err);
            // Fallback to answering manually if generation fails
            setStep("answering");
        }
    };

    const handleSubmit = async () => {
        if (!user || user.credits < 5) {
            alert("Insufficient credits! Please top up in the sidebar.");
            return;
        }

        setStep("submitting");

        // combine structured answers + free text
        // We will fake a question ID for free text if needed, or just append it

        const submission = {
            responses: Object.entries(answers)
                .filter(([_, ans]) => ans !== "SKIP") // Filter out skipped questions
                .map(([qid, ans]) => ({
                    question_id: qid,
                    answer: ans.startsWith("OTHER:") ? ans.substring(6) : ans, // Clean up "OTHER:" prefix if you want, or keep it depending on backend preference. Let's keep prefix or clean it? User might just type "foo". "OTHER:foo" distinguishes it. Let's keep it simple or just clean it for AI.
                    // Actually clearer to just send the text. "OTHER:" prefix is internal UI state.
                })).map(resp => ({
                    ...resp,
                    answer: resp.answer.startsWith("OTHER:") ? resp.answer.substring(6) : resp.answer
                })),
        };

        // Append free text as a special note if not empty
        // The backend agent summarizes "submission" + "questions". 
        // We can append a fake question for free text to make the agent see it.
        const augmentedQuestions = [...questions];
        if (freeText.trim()) {
            const freeQId = "free-text-note";
            augmentedQuestions.push({ id: freeQId, text: "Additional User Notes", type: "text" });
            submission.responses.push({ question_id: freeQId, answer: freeText });
        }

        try {
            const res = await apiClient.post(`/projects/${projectId}/questionnaire/submit`, {
                submission,
                topic,
                questions: augmentedQuestions,
            });
            onGenerateSyllabus(res.data.summary);
        } catch (err) {
            console.error("Submit failed", err);
            onGenerateSyllabus("General Learner (Submit Failed)");
        }
    };

    const handleSkip = () => {
        onGenerateSyllabus("General Learner (Skipped Questionnaire)");
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Project Workspace</h2>
                    <p className="text-sm text-slate-500">
                        {step === "answering" ? `Tailoring content for "${topic}"` : "Defining your learning goal"}
                    </p>
                </div>
                {isSaving && <span className="text-xs text-slate-400 flex items-center gap-1"><Save className="w-3 h-3" /> Saving...</span>}
            </div>

            <div className="flex-1 p-8 flex flex-col items-center">

                {/* Step 1: Upload + Topic Input */}
                {step === "idle" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md space-y-8 mt-4"
                    >
                        {/* Upload Section */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <Upload className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 text-sm">Knowledge Base</h3>
                                        <p className="text-xs text-slate-500">Upload PDFs for context (Optional)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    multiple
                                    onChange={handleUpload}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer text-sm font-medium text-blue-600 bg-white border border-blue-200 px-3 py-2 rounded-md hover:bg-blue-50 transition-colors">
                                    {filesToUpload.length > 0 ? `${filesToUpload.length} selected` : "Browse Files"}
                                </label>

                                {filesToUpload.length > 0 && (
                                    <Button
                                        size="sm"
                                        onClick={handleFileIngest}
                                        disabled={isUploading}
                                        variant="default"
                                    >
                                        {isUploading ? 'Uploading...' : 'Upload Now'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Topic Section */}
                        <div className="space-y-4">
                            <Label className="text-lg">What do you want to learn today?</Label>
                            <Input
                                placeholder="e.g. Astrophysics, Digital Marketing, Python"
                                className="h-14 text-lg"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
                            />
                            <p className="text-sm text-slate-500">
                                We'll use AI to generate a personalized questionnaire to understand your background.
                            </p>
                        </div>
                        <Button
                            className="w-full h-12 text-lg"
                            onClick={handleTopicSubmit}
                            disabled={!topic || (user?.credits || 0) < 5}
                            title="Cost: 5 Credits"
                        >
                            Start Planning (5 💎) <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </motion.div>
                )}

                {/* Step 2: Generating */}
                {step === "generating_questions" && (
                    <div className="flex flex-col items-center justify-center space-y-4 mt-20">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="text-slate-600">Analyzing topic and generating questions...</p>
                    </div>
                )}

                {/* Step 3: Questionnaire */}
                {(step === "answering" || step === "submitting") && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="w-full max-w-2xl flex flex-col h-full"
                    >
                        <ScrollArea className="flex-1 h-[500px] pr-6">
                            <div className="space-y-8 pb-10">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="space-y-3 bg-slate-50 p-6 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-start">
                                            <Label className="text-lg font-medium text-slate-800">
                                                {idx + 1}. {q.text}
                                            </Label>
                                            <Button variant="ghost" size="sm" onClick={() => setAnswers(prev => {
                                                const newA = { ...prev };
                                                delete newA[q.id];
                                                return newA;
                                            })} className="text-xs text-slate-400 hover:text-red-500">
                                                Clear
                                            </Button>
                                        </div>

                                        <RadioGroup
                                            value={answers[q.id]?.startsWith("OTHER:") ? "OTHER" : (answers[q.id] || "")}
                                            onValueChange={(val: string) => {
                                                if (val === "OTHER") {
                                                    setAnswers(prev => ({ ...prev, [q.id]: "OTHER:" }));
                                                } else if (val === "SKIP") {
                                                    setAnswers(prev => ({ ...prev, [q.id]: "SKIP" }));
                                                } else {
                                                    setAnswers(prev => ({ ...prev, [q.id]: val }));
                                                }
                                            }}
                                            className="space-y-2 mt-2"
                                        >
                                            {/* Standard Options */}
                                            {(q.options || []).map((opt) => (
                                                <div key={opt} className="flex items-center space-x-2 bg-white p-3 rounded border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}>
                                                    <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                                    <Label htmlFor={`${q.id}-${opt}`} className="font-normal cursor-pointer flex-1">
                                                        {opt}
                                                    </Label>
                                                </div>
                                            ))}

                                            {/* Other Option */}
                                            <div
                                                className="flex items-center space-x-2 bg-white p-3 rounded border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                                                onClick={() => setAnswers(prev => {
                                                    // If already selected, do nothing or focus? Default to selecting radio
                                                    if (!answers[q.id]?.startsWith("OTHER:")) {
                                                        return { ...prev, [q.id]: "OTHER:" };
                                                    }
                                                    return prev;
                                                })}
                                            >
                                                <RadioGroupItem value="OTHER" id={`${q.id}-OTHER`} />
                                                <Label htmlFor={`${q.id}-OTHER`} className="font-normal cursor-pointer flex-1">
                                                    Other
                                                </Label>
                                            </div>
                                            {answers[q.id]?.startsWith("OTHER:") && (
                                                <Input
                                                    placeholder="Please specify..."
                                                    className="mt-2 ml-6 w-[90%]"
                                                    value={answers[q.id].substring(6)}
                                                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: "OTHER:" + e.target.value }))}
                                                    autoFocus
                                                />
                                            )}

                                            {/* Skip Option */}
                                            <div
                                                className="flex items-center space-x-2 bg-white p-3 rounded border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                                                onClick={() => setAnswers(prev => ({ ...prev, [q.id]: "SKIP" }))}
                                            >
                                                <RadioGroupItem value="SKIP" id={`${q.id}-SKIP`} />
                                                <Label htmlFor={`${q.id}-SKIP`} className="font-normal cursor-pointer flex-1 text-slate-500">
                                                    Skip this question
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                ))}

                                {/* Free Text Section */}
                                <div className="space-y-3 bg-blue-50 p-6 rounded-lg border border-blue-100">
                                    <Label className="text-lg font-medium text-slate-800">
                                        Anything else? (Optional)
                                    </Label>
                                    <p className="text-sm text-slate-600 mb-2">
                                        Feel free to write anything here. Unsure about a question? Have a specific learning style? Just let us know.
                                    </p>
                                    <Textarea
                                        value={freeText}
                                        onChange={(e) => setFreeText(e.target.value)}
                                        placeholder="I learn best by analogies... / I want to focus on practical examples..."
                                        className="bg-white min-h-[120px]"
                                    />
                                </div>
                            </div>
                        </ScrollArea>

                        <div className="pt-6 border-t mt-4 flex justify-between items-center bg-white sticky bottom-0">
                            <Button variant="ghost" onClick={handleSkip} className="text-slate-500 hover:text-slate-700">
                                Skip & Generate Standard Path
                            </Button>

                            <Button
                                onClick={handleSubmit}
                                disabled={step === "submitting" || (user?.credits || 0) < 50}
                                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto shadow-lg shadow-blue-200"
                            >
                                {step === "submitting" ? (
                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating...</>
                                ) : (
                                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Path (50 💎)</>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
