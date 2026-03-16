/**
 * 檔案名稱: frontend/src/components/layout/RightSidebar.tsx
 * 功能描述: 右側工具列 (Right Sidebar / Tools Panel)
 *
 * 主要區塊:
 *     1. 專案資訊 Header — 顯示目前專案名稱與點數餘額。
 *     2. 學習組件庫 (Component Lab) — 分類顯示所有可用的 AI 學習模組。
 *     3. 檔案管理 (Project Files) — 已上傳檔案清單、上傳與刪除。
 *     4. 系統管理 (Admin Controls) — 登出、重置資料庫、清除上傳檔案。
 */
import React from 'react';
import { Database, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/useProjectStore';
import { Trash2, BookOpen, FileText, LogOut, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { projectService } from '@/features/dashboard/api/projectService';
import { ComponentType } from '@/types/lesson';

interface RightSidebarProps {
    currentProjectName?: string;
    onOpenProfile?: (initialViewMode?: 'view' | 'top_up') => void;
    onPlayComponentDemo?: (component: ComponentType) => void;
}

export default function RightSidebar({ currentProjectName, onOpenProfile, onPlayComponentDemo }: RightSidebarProps) {

    const { currentProject, files, setFiles, setCurrentProject } = useProjectStore();
    const { logout, user, refreshUser } = useAuthStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Refresh user (credits) on mount
    useEffect(() => {
        refreshUser();
    }, []);

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
        } catch (e: any) {
            console.error("Failed to fetch files", e);
            if (e.response && e.response.status === 404) {
                setCurrentProject(null);
            }
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

    const categories: { title: string; color: string; items: { component: ComponentType; label: string }[] }[] = [
        {
            title: "Selection",
            color: "text-blue-500",
            items: [{ component: 'MultipleChoice', label: 'Multiple Choice' }]
        },
        {
            title: "Practice",
            color: "text-green-500",
            items: [
                { component: 'Ordering', label: 'Ordering' },
                { component: 'MatchingPairs', label: 'Matching Pairs' }
            ]
        },
        {
            title: "Assessment",
            color: "text-orange-500",
            items: [{ component: 'FeynmanMirror', label: 'Feynman Teaching' }]
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
                <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-slate-400">Component Lab & Files</p>

                    <button
                        type="button"
                        onClick={() => onOpenProfile?.('top_up')}
                        className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                        <span className="text-xs font-bold text-blue-600">💎 {user?.credits ?? 0}</span>
                        <Plus className="w-3 h-3 text-blue-500" />
                    </button>
                </div>
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
                                {cat.items.map(({ component, label }) => (
                                    <button
                                        type="button"
                                        key={component}
                                        className="w-full text-left text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                        onClick={() => onPlayComponentDemo?.(component)}
                                    >
                                        {label}
                                    </button>
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

            {/* Profile Entry Point */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2 mt-auto cursor-pointer hover:bg-slate-100 transition-colors relative group" onClick={onOpenProfile}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm truncate">{user?.email?.split('@')[0] || "Learner"}</h4>
                        <p className="text-xs text-slate-500 truncate">Level 5 Scholar</p>
                    </div>
                </div>
                {/* Arrow hint on hover? */}
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
                        if (confirm("DANGER: This will delete all users, projects, uploaded files, and the vector database, then rebuild the system. Are you sure?")) {
                            try {
                                await apiClient.post('/system/reset-db');
                                alert("System reset complete. Please log in again.");
                                window.location.reload();
                            } catch (e: any) { alert("Failed to reset DB: " + e.message); }
                        }
                    }}
                >
                    ⚠️ Factory Reset
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
