import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { projectService, Question } from '@/features/dashboard/api/projectService';

interface QuestionnaireDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: number;
    topic: string;
    onComplete: (summary: string) => void;
}

export function QuestionnaireDialog({
    isOpen,
    onOpenChange,
    projectId,
    topic,
    onComplete,
}: QuestionnaireDialogProps) {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [step, setStep] = useState<"loading" | "answering" | "submitting">("loading");

    // Fetch questions when opened
    useEffect(() => {
        if (isOpen && projectId && topic) {
            setStep("loading");
            setLoading(true);
            projectService.generateQuestionnaire(projectId, topic)
                .then((questions) => {
                    setQuestions(questions);
                    setStep("answering");
                })
                .catch((err) => {
                    console.error("Failed to load questionnaire", err);
                    // If fail, just skip
                    onComplete("General Audience");
                    onOpenChange(false);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, projectId, topic]);

    const handleAnswer = (qId: string, val: string) => {
        setAnswers((prev) => ({ ...prev, [qId]: val }));
    };

    const handleSubmit = async () => {
        setStep("submitting");
        try {
            const submission = {
                responses: Object.entries(answers).map(([qid, ans]) => ({
                    question_id: qid,
                    answer: ans,
                })),
            };

            // Use projectService
            const res = await projectService.submitQuestionnaire(projectId, submission, topic, questions);

            onComplete(res.summary);
            onOpenChange(false);
        } catch (err) {
            console.error("Failed to submit questionnaire", err);
            // Fallback
            onComplete("General Audience (Failed to analyze)");
            onOpenChange(false);
        }
    };

    const allAnswered = questions.every((q) => !!answers[q.id]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Tailoring Your Learning Path</DialogTitle>
                    <DialogDescription>
                        We've prepared a few questions about <b>{topic}</b> to customize the curriculum for you.
                    </DialogDescription>
                </DialogHeader>

                {step === "loading" && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Generating questions...</p>
                    </div>
                )}

                {step === "submitting" && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Analyzing your profile...</p>
                    </div>
                )}

                {step === "answering" && (
                    <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-6 py-4">
                            {questions.map((q, idx) => (
                                <div key={q.id} className="space-y-3">
                                    <Label className="text-base font-semibold">
                                        {idx + 1}. {q.text}
                                    </Label>

                                    {q.type === "choice" && q.options && (
                                        <RadioGroup
                                            value={answers[q.id] || ""}
                                            onValueChange={(val: string) => handleAnswer(q.id, val)}
                                        >
                                            {q.options.map((opt) => (
                                                <div key={opt} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                                    <Label htmlFor={`${q.id}-${opt}`} className="font-normal">
                                                        {opt}
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    )}

                                    {(q.type === "text" || !q.options) && (
                                        <Textarea
                                            placeholder="Type your answer here..."
                                            value={answers[q.id] || ""}
                                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <DialogFooter className="pt-4">
                            <Button onClick={() => onOpenChange(false)} variant="ghost">
                                Skip
                            </Button>
                            <Button onClick={handleSubmit} disabled={!allAnswered}>
                                Generate Personalized Syllabus
                            </Button>
                        </DialogFooter>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
