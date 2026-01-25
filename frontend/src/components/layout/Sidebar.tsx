/**
 * 檔案名稱: frontend/src/components/layout/Sidebar.tsx
 * 功能描述: 左側導覽列 (Left Sidebar / Project Navigator)
 * 
 * 此組件是應用程式的主要導覽區域，負責管理 "專案 (Projects)" 的切換與 CRUD 操作。
 * 
 * 主要功能:
 *     1. 專案列表 (Project List):
 *         - 顯示使用者擁有的所有專案。
 *         - 透過點擊切換當前專案 (`onSelectProject`)。
 *         - `useProjectStore` 用於設定全域 Active Project。
 * 
 *     2. 專案管理 (CRUD):
 *         - 新增專案 (Create): 輸入名稱後按 Enter 或點擊 Create。
 *         - 修改名稱 (Rename): 點擊鉛筆圖示進入編輯模式，按 Check 或 Enter 儲存。
 *         - 刪除專案 (Delete): 點擊垃圾桶圖示，需確認刪除 (會連帶刪除檔案與資料)。
 * 
 *     3. 狀態同步:
 *         - `useEffect` 初次載入時呼叫 `apiClient.get('/projects')` 取得列表。
 *         - 操作成功後 (Create/Update/Delete) 會即時更新 `projects` state。
 */
import React, { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, LayoutGrid, Cpu, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useProjectStore } from '@/stores/useProjectStore';

interface Project {
    id: number;
    name: string;
}

interface SidebarProps {
    currentProjectId: number | null;
    onSelectProject: (id: number | null) => void;
}

export default function Sidebar({ currentProjectId, onSelectProject }: SidebarProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const { setCurrentProject } = useProjectStore();

    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await apiClient.get('/projects');
            const userProjects: Project[] = res.data;
            setProjects(userProjects);

            // Validate cached currentProject belongs to this user
            const cachedProject = useProjectStore.getState().currentProject;
            if (cachedProject) {
                const projectStillExists = userProjects.some(p => p.id === cachedProject.id);
                if (!projectStillExists) {
                    // Clear stale cached project (belongs to different user or was deleted)
                    console.log('Clearing stale cached project:', cachedProject.id);
                    setCurrentProject(null);
                    onSelectProject(null as any);  // Reset selection
                }
            }
        } catch (e) {
            console.error("Failed to fetch projects", e);
        }
    };

    const handleCreate = async () => {
        if (!newProjectName.trim()) return;

        try {
            const res = await apiClient.post('/projects', { name: newProjectName });
            setProjects([...projects, res.data]);
            setNewProjectName('');
            setIsCreating(false);

            // Auto switch
            setCurrentProject(res.data);
            onSelectProject(res.data.id);
        } catch (e) {
            console.error(e);
        }
    };

    const handleStartEdit = (p: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProjectId(p.id);
        setEditName(p.name);
    }

    const handleSaveEdit = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!editingProjectId || !editName.trim()) {
            setEditingProjectId(null);
            return;
        }

        try {
            const res = await apiClient.patch(`/projects/${editingProjectId}`, { name: editName });
            setProjects(projects.map(p => p.id === editingProjectId ? res.data : p));
            setEditingProjectId(null);
            setEditName('');
        } catch (e) {
            console.error("Failed to update project", e);
        }
    }

    // Optional: Delete project
    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this project? Files and data will be lost.")) return;

        try {
            await apiClient.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
            if (currentProjectId === id) {
                onSelectProject(null);
                setCurrentProject(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="w-64 bg-slate-50 border-r border-slate-200 h-screen flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-slate-800">Learn8 Spaces</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">


                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    My Projects
                </div>

                {projects.map(p => (
                    <div
                        key={p.id}
                        onClick={() => {
                            onSelectProject(p.id);
                            setCurrentProject(p);
                        }}
                        className={cn(
                            "group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors",
                            currentProjectId === p.id
                                ? "bg-white shadow-sm border border-slate-200 text-blue-600 font-medium"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <Folder className={cn("w-4 h-4", currentProjectId === p.id ? "fill-blue-100" : "")} />

                            {editingProjectId === p.id ? (
                                <div className="flex items-center gap-1 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                                    <Input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="h-6 text-xs px-1 py-0 min-w-0"
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                    />
                                    <Check className="w-4 h-4 text-green-500 cursor-pointer hover:bg-green-100 rounded" onClick={handleSaveEdit} />
                                </div>
                            ) : (
                                <span className="truncate">{p.name}</span>
                            )}
                        </div>

                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            {editingProjectId !== p.id && (
                                <Pencil
                                    className="w-3 h-3 text-slate-400 hover:text-blue-500 mr-1"
                                    onClick={(e) => handleStartEdit(p, e)}
                                />
                            )}
                            <Trash2
                                className="w-3 h-3 text-slate-400 hover:text-red-500"
                                onClick={(e) => handleDelete(p.id, e)}
                            />
                        </div>
                    </div>
                ))}

                {isCreating ? (
                    <div className="flex flex-col gap-2 mt-2 p-2 bg-white rounded border border-slate-200">
                        <Input
                            autoFocus
                            placeholder="Project Name..."
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            className="h-8 text-xs"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleCreate} className="h-6 text-xs flex-1">Create</Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="h-6 text-xs flex-1">Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-slate-400 hover:text-slate-600"
                        onClick={() => setIsCreating(true)}
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </Button>
                )}
            </div>

            <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                Learn8 Beta
            </div>
        </div>
    );
}
