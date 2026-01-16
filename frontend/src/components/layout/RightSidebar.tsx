/**
 * 檔案名稱: frontend/src/components/layout/RightSidebar.tsx
 * 功能描述: 右側工具列 (Right Sidebar / Tools Panel)
 * 
 * 此組件位於應用程式右側，提供輔助工具與資源管理功能。
 * 
 * 主要區塊:
 *     1. 專案資訊 Header:
 *         - 顯示目前專案名稱。
 * 
 *     2. 學習組件庫 (Component Lab):
 *         - 分類顯示所有可用的 AI 學習模組 (Instruction, Practice, Assessment, Incentive)。
 *         - 點擊按鈕可載入 Mock Data 進行測試 (開發用途)。
 * 
 *     3. 檔案管理 (Project Files):
 *         - 顯示目前專案已上傳的 PDF 檔案。
 *         - 提供上傳按鈕 (多檔案支援) 與刪除功能。
 * 
 *     4. 系統管理 (Admin Controls):
 *         - Logout: 登出功能。
 *         - Reset Database (Danger): 開發者專用，重置整個資料庫。
 *         - Clear Uploads (Danger): 刪除所有上傳檔案。
 * 
 * 狀態管理:
 *     - 使用 `useProjectStore` 同步全域專案狀態與檔案列表。
 *     - `handleSidebarUpload`: 使用 `projectService` 處理檔案上傳邏輯。
 */
import React from 'react';
import { Play, Database, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_STAGES } from '@/lib/mock-data';
import { ComponentType, LessonStage } from '@/types/lesson';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/useProjectStore';
import { Trash2, BookOpen, FileText, LogOut, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { projectService } from '@/services/projectService';

interface RightSidebarProps {
    onLoadMock: (stage: LessonStage) => void;
    currentProjectName?: string;
}

export default function RightSidebar({ onLoadMock, currentProjectName }: RightSidebarProps) {

    const { currentProject, files, setFiles } = useProjectStore();
    const { logout } = useAuthStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    useEffect(() => {
        if (currentProject) {
            fetchFiles(currentProject.id);
        } else {
            setFiles([]);
        }
    }, [currentProject]);

    const fetchFiles = async (pId: number) => {
        try {
            const res = await apiClient.get(`/projects/${pId}/files`);
            setFiles(res.data);
        } catch (e) {
            console.error("Failed to fetch files", e);
        }
    }

    const handleDeleteFile = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentProject) return;
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            await apiClient.delete(`/projects/${currentProject.id}/files/${filename}`);
            setFiles(files.filter(f => f !== filename));
        } catch (e: any) {
            alert("Delete failed: " + e.message);
        }
    };

    const categories = [
        {
            title: "Instruction",
            color: "text-blue-500",
            items: ['TextToken', 'SpatialAnatomy', 'PatternMatcher']
        },
        {
            title: "Practice",
            color: "text-green-500",
            items: ['VariableBalancer', 'LogicChain', 'Sequencer']
        },
        {
            title: "Assessment",
            color: "text-orange-500",
            items: ['TaxonomyMatrix', 'FeynmanMirror']
        },
        {
            title: "Incentive",
            color: "text-purple-500",
            items: ['DilemmaSolver']
        }
    ];

    const [isUploading, setIsUploading] = React.useState(false);

    const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !currentProject) return;

        try {
            setIsUploading(true);
            const filesToUpload = Array.from(e.target.files);

            await projectService.uploadFiles(currentProject.id, filesToUpload);

            // Refresh
            const newFiles = await projectService.getFiles(currentProject.id);
            setFiles(newFiles);
        } catch (error: any) {
            alert('Upload failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <div className="w-64 h-screen bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
            {/* ... header ... */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-500" />
                    {currentProjectName || "Dev Tools"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">Component Lab & Syllabus</p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-6">
                    {categories.map((cat) => (
                        <div key={cat.title}>
                            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2", cat.color)}>
                                <Box className="w-3 h-3" />
                                {cat.title}
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {cat.items.map(comp => (
                                    <Button
                                        key={comp}
                                        variant="outline"
                                        size="sm"
                                        className="justify-between group hover:border-slate-400 transition-all font-normal text-slate-600"
                                        onClick={() => {
                                            const mock = MOCK_STAGES[comp];
                                            if (mock) onLoadMock({ ...mock, topic: `${comp} Demo` });
                                        }}
                                    >
                                        {comp}
                                        <Play className="w-3 h-3 opacity-0 group-hover:opacity-50 text-blue-500" />
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* File List Area */}
            <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <FileText className="w-3 h-3" />
                        Project Files
                    </div>
                    {currentProject && (
                        <label className={cn("cursor-pointer p-1 rounded hover:bg-slate-100 text-blue-500 transition-colors", isUploading && "opacity-50 pointer-events-none")}>
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf"
                                multiple
                                onChange={handleSidebarUpload}
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <span className="text-[10px] animate-pulse">...</span>
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                        </label>
                    )}
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {currentProject ? (
                        files.length > 0 ? (
                            files.map((f, i) => (
                                <div key={i} className="group flex items-center justify-between text-xs p-1.5 bg-white border border-slate-200 rounded hover:border-blue-300 transition-colors">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <BookOpen className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                        <span className="truncate text-slate-600">{f}</span>
                                    </div>
                                    <Trash2
                                        className="w-3 h-3 text-slate-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100"
                                        onClick={(e) => handleDeleteFile(f, e)}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-slate-400 italic p-2 text-center border border-dashed border-slate-200 rounded">
                                No files uploaded
                            </div>
                        )
                    ) : (
                        <div className="text-xs text-slate-400 italic">Select a project to view files</div>
                    )}
                </div>
            </div>

            {/* Admin Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2 mt-auto">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    System Admin
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-slate-500 hover:text-red-500 hover:bg-slate-100 mb-2"
                    onClick={handleLogout}
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                </Button>
                <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start bg-red-600 hover:bg-red-700 text-white"
                    onClick={async () => {
                        if (confirm("DANGER: This will delete ALL users, projects, and data. Are you sure?")) {
                            try {
                                await apiClient.post('/system/reset-db');
                                alert("Database reset complete. Please reload.");
                                window.location.reload();
                            } catch (e: any) { alert("Failed to reset DB: " + e.message); }
                        }
                    }}
                >
                    ⚠️ Reset Database
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                    onClick={async () => {
                        if (confirm("Delete all uploaded PDF files?")) {
                            try {
                                await apiClient.post('/system/clear-files');
                                alert("Files deleted.");
                            } catch (e: any) { alert("Failed to delete files: " + e.message); }
                        }
                    }}
                >
                    🗑️ Clear Uploads
                </Button>
            </div>
        </div>
    );
}
