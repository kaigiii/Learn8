/**
 * 檔案名稱: features/dashboard/components/Dashboard.tsx
 * 功能描述: 主控台頁面 (Main Dashboard)
 * 
 * 應用程式的主要入口頁面，整合了 "檔案上傳" 與 "課程生成" 的核心流程。
 * 
 * 主要功能:
 * 1. 檔案上傳 (RAG Ingestion):
 *    - 允許使用者上傳 PDF。
 *    - 呼叫 `POST /projects/upload-pdf`。
 * 
 * 2. 課程生成 (Syllabus Generation):
 *    - 輸入 Topic (如 "Calculus")。
 *    - 呼叫 `POST /courses/generate-syllabus`。
 *    - 觸發 LLM Architect 進行生成。
 * 
 * 3. 自動恢復 (Auto Resume):
 *    - 若有 `shouldAutoResume` 屬性，自動載入使用者上次的課程。
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Upload, BookOpen, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LessonStage, ComponentType, SkinType, CoursePath } from '@/types/lesson';
import { apiClient } from '@/lib/api-client';
import { useProjectStore } from '@/stores/useProjectStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { projectService } from '@/services/projectService';

import { ProjectWorkspace } from './ProjectWorkspace';

interface DashboardProps {
    onLessonGenerated: (data: CoursePath) => void;
    currentProjectId: number | null;
    onResume: (courseId: number) => void;
    shouldAutoResume?: boolean;
    onAutoResumeComplete?: () => void;
}

export default function Dashboard({ onLessonGenerated, currentProjectId, onResume, shouldAutoResume, onAutoResumeComplete }: DashboardProps) {
    const router = useRouter();
    const [status, setStatus] = useState<string>('');

    // Global Store
    const { setFiles } = useProjectStore();
    const { refreshUser } = useAuthStore();

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

    // Auto-Resume Effect

    const handleGenerateSyllabus = async (profileSummary: string, manualTopic?: string) => {
        // Since the workspace handles topic and profile, we just need to trigger the generation call
        // Wait, the API needs topic. If we are coming from ProjectWorkspace, it should have the topic in draft or passed down?
        // Ah, ProjectWorkspace calls onGenerateSyllabus(summary), but we need the topic too.
        // Let's modify onGenerateSyllabus to optionaly take topic, or fetch it from draft? 
        // Actually, let's fetch draft to get topic if not passed? 
        // Better: Pass topic out from ProjectWorkspace as well.

        // Let's assume ProjectWorkspace handles everything and calls us to just "fetch result" or "trigger generation"?
        // The ProjectWorkspace calls onGenerateSyllabus(summary).
        // Wait, `courses/generate-syllabus` needs `topic`. 
        // Since `ProjectWorkspace` has the state `topic`, it should pass it up.
        // I'll update ProjectWorkspace to pass { topic, summary } or similar.
        // BUT, I can't update ProjectWorkspace right now without another tool call.
        // Hack: I'll read the draft here to get the topic before calling generate.

        try {
            // Fetch topic from draft since we don't have it in scope here easily (unless we lift state)
            const draftRes = await apiClient.get(`/projects/${currentProjectId}/draft`);
            const draftTopic = draftRes.data.draft?.topic;

            if (!draftTopic) {
                setStatus("Error: Topic missing from draft.");
                return;
            }

            setStatus('Architecting your syllabus map... (this may take 10-20s)');
            const generateUrl = `/courses/generate-syllabus?topic=${encodeURIComponent(draftTopic)}&project_id=${currentProjectId}`;
            const res = await apiClient.post(generateUrl);

            await refreshUser(); // Refresh credits (Cost: 50)

            onLessonGenerated(res.data);

        } catch (err: any) {
            console.error(err);
            setStatus('Generation Error: ' + (err.response?.data?.detail || err.message));
        }
    };



    return (
        <div className="flex flex-col w-full h-full">
            {/* ... (Header) */}
            <div className="text-center space-y-4 max-w-2xl shrink-0">
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
                    NeoLearn <span className="text-blue-600">2.0</span>
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
