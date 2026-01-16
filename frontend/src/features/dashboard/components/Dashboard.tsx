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
import { projectService } from '@/services/projectService';

interface DashboardProps {
    onLessonGenerated: (data: CoursePath) => void;
    currentProjectId: number | null;
    onResume: (courseId: number) => void;
    shouldAutoResume?: boolean; // [NEW]
    onAutoResumeComplete?: () => void; // [NEW]
}

export default function Dashboard({ onLessonGenerated, currentProjectId, onResume, shouldAutoResume, onAutoResumeComplete }: DashboardProps) {
    const router = useRouter();
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [topic, setTopic] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [myCourses, setMyCourses] = useState<any[]>([]);

    // Global Store
    const { setFiles } = useProjectStore();

    React.useEffect(() => {
        if (currentProjectId) {
            fetchCourses(currentProjectId);
            // Files are now fetched by RightSidebar automatically based on project
            // But we can trigger a fetch here if we want to ensure sync, or just rely on Sidebar
        } else {
            fetchCourses(null);
        }
    }, [currentProjectId]);

    const refreshFiles = async () => {
        if (!currentProjectId) return;
        try {
            const res = await apiClient.get(`/projects/${currentProjectId}/files`);
            setFiles(res.data); // Update global store
        } catch (e) { console.error(e); }
    }

    const fetchCourses = async (pId: number | null) => {
        try {
            const url = `/courses${pId ? `?project_id=${pId}` : ''}`;
            const res = await apiClient.get(url);

            const courses = res.data;
            setMyCourses(courses);

            // [NEW] Auto-Resume Logic
            if (shouldAutoResume && courses.length > 0) {
                console.log("Auto-resuming latest course:", courses[0].id);
                onResume(courses[0].id);
                if (onAutoResumeComplete) onAutoResumeComplete(); // Prevent loop
            }
        } catch (e) {
            console.error("Failed to fetch courses", e);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFilesToUpload(Array.from(e.target.files));
            setStatus(`${e.target.files.length} file(s) selected.`);
        }
    };

    const handleFileIngest = async () => {
        if (filesToUpload.length === 0) return;

        try {
            setIsUploading(true);
            const count = await projectService.uploadFiles(
                currentProjectId!,
                filesToUpload,
                (msg) => setStatus(msg)
            );

            setIsUploading(false);
            setStatus(`Successfully ingested ${count} files.`);
            refreshFiles();
            setFilesToUpload([]); // Clear selection
        } catch (err: any) {
            console.error(err);
            setStatus('Upload Error: ' + (err.response?.data?.detail || err.message));
            setIsUploading(false);
        }
    }

    const handleGenerate = async () => {
        try {
            if (topic) {
                setIsGenerating(true);
                setStatus('Architecting your syllabus map... (this may take 10-20s)');

                const generateUrl = `/courses/generate-syllabus?topic=${encodeURIComponent(topic)}${currentProjectId ? `&project_id=${currentProjectId}` : ''}`;
                const res = await apiClient.post(generateUrl);

                onLessonGenerated(res.data);
            }
        } catch (err: any) {
            console.error(err);
            setStatus('Generation Error: ' + (err.response?.data?.detail || err.message));
        } finally {
            setIsGenerating(false);
        }
    }




    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 p-8">
            <div className="text-center space-y-4 max-w-2xl">
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
                        <h3 className="text-lg font-semibold text-slate-700">No Project Selected</h3>
                        <p className="text-sm">
                            Please create or select a project on the left sidebar to start extracting knowledge and generating learning paths.
                        </p>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100 space-y-6"
                >
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                            1. Upload Material (Optional)
                        </label>
                        <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center cursor-pointer">
                            <input
                                type="file"
                                accept=".pdf"
                                multiple
                                onChange={handleUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center space-y-2 pointer-events-none">
                                <Upload className="w-8 h-8 text-slate-400" />
                                <span className="text-sm text-slate-500">
                                    {filesToUpload.length > 0
                                        ? `${filesToUpload.length} file(s) selected`
                                        : "Drop PDF(s) or Click to Browse"}
                                </span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                            onClick={handleFileIngest}
                            disabled={isUploading || filesToUpload.length === 0}
                        >
                            {isUploading ? "Uploading..." : `Upload ${filesToUpload.length > 0 ? `(${filesToUpload.length})` : ""} File(s)`}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                            2. Choose Topic
                        </label>
                        <Input
                            placeholder="e.g., Calculus, Roman History, Quantum Mechanics"
                            value={topic}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)}
                            className="h-12 text-lg"
                        />
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={!topic || isUploading || isGenerating}
                        className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                        {isGenerating ? 'Architecting...' : (
                            <span className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" /> Generate Path
                            </span>
                        )}
                    </Button>

                    {status && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 text-center"
                        >
                            {status}
                        </motion.div>
                    )}
                </motion.div>
            )}


        </div>
    );
}
