/**
 * 檔案名稱: features/dashboard/components/Dashboard.tsx
 * 功能描述: 主控台頁面 (Main Dashboard)
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { CoursePath } from '@/types/lesson';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useJobStore } from '@/stores/useJobStore';
import { projectService } from '@/features/dashboard/api/projectService';
import { cn } from '@/lib/utils';

import { ProjectWorkspace } from './ProjectWorkspace';

interface DashboardProps {
    onLessonGenerated: (data: CoursePath) => void;
    currentProjectId: number | null;
    onResume: (courseId: number) => void;
    shouldAutoResume?: boolean;
    onAutoResumeComplete?: () => void;
}

export default function Dashboard({ onLessonGenerated, currentProjectId, onResume, shouldAutoResume, onAutoResumeComplete }: DashboardProps) {
    const [status, setStatus] = useState<string>('');
    const { refreshUser } = useAuthStore();

    const { setActiveJob, updateJobProgress, clearJob } = useJobStore();

    // Auto-Resume Effect
    React.useEffect(() => {
        // Scroll top on project change
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Also try to scroll the main container if it exists
        const main = document.querySelector('main');
        if (main) main.scrollTo({ top: 0, behavior: 'instant' });

        if (shouldAutoResume && currentProjectId) {
            onResume(currentProjectId);
            if (onAutoResumeComplete) {
                onAutoResumeComplete();
            }
        }
    }, [shouldAutoResume, currentProjectId, onResume, onAutoResumeComplete]);

    const handleGenerateSyllabus = async (profileSummary: string, manualTopic?: string) => {
        try {
            // Fetch topic from draft
            const draft = await projectService.getDraft(currentProjectId!);
            const draftTopic = manualTopic || draft.topic;

            if (!draftTopic) {
                setStatus("Error: Topic missing from draft.");
                return;
            }

            setStatus('Architecting your syllabus map... (this may take 10-20s)');

            // Use service to get Job ID
            const res = await projectService.generateSyllabus(currentProjectId!, draftTopic);
            const jobId = res.job_id;

            setActiveJob(jobId);

            // Connect to SSE
            const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/jobs/${jobId}/stream`);

            let isClosedIntentionally = false;

            eventSource.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                updateJobProgress(data.status.toLowerCase(), data.progress, data.message);

                if (data.status === 'COMPLETED') {
                    isClosedIntentionally = true;
                    eventSource.close();
                    await refreshUser(); // Refresh credits

                    let rd = data.result_data;
                    if (typeof rd === 'string') {
                        try { rd = JSON.parse(rd); } catch { }
                    }

                    // fetch the newly generated course based on result_data ID
                    const newCourseId = rd?.course_id;
                    if (newCourseId) {
                        const detailRes = await apiClient.get(`/courses/${newCourseId}`);
                        onLessonGenerated(detailRes.data);
                    }
                    setTimeout(() => clearJob(), 2000); // Clear overlay smoothly
                } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
                    isClosedIntentionally = true;
                    eventSource.close();
                    setStatus('Generation Error: ' + data.message);
                }
            };

            eventSource.onerror = () => {
                if (isClosedIntentionally) return;
                eventSource.close();
                updateJobProgress('failed', 0, 'Connection lost to the server.');
            }

        } catch (err: any) {
            console.error(err);
            setStatus('Generation Error: ' + (err.response?.data?.detail || err.message));
        }
    };

    return (
        <div className={cn("flex flex-col w-full h-full", !currentProjectId && "items-center justify-center")}>
            {/* ... (Header) */}
            <div className="text-center space-y-4 max-w-2xl shrink-0">
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
                    Learn<span className="text-blue-600">8</span>
                </h1>
                <p className="text-xl text-slate-600">
                    Turn any textbook into an addictive, gamified learning path.
                </p>
            </div>

            {!currentProjectId ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center max-w-md w-full"
                >
                    <div className="flex flex-col items-center gap-4 text-slate-500">
                        <AlertCircle className="w-12 h-12 text-blue-500 opacity-80" />
                        <h3 className="text-lg font-semibold text-slate-700">Get Started</h3>
                        <p className="text-sm">
                            Create a new project in the sidebar to begin your learning journey.
                        </p>
                    </div>
                </motion.div>
            ) : (
                <div className="w-full h-full flex-1 flex flex-col">
                    {/* Workspace (Handles Upload + Questionnaire) */}
                    <ProjectWorkspace
                        key={currentProjectId} // Force remount on project switch
                        projectId={currentProjectId}
                        onGenerateSyllabus={(summary) => handleGenerateSyllabus(summary)}
                    />

                    {status && (
                        <div className="text-center text-slate-500 text-sm animate-pulse">
                            {status}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
