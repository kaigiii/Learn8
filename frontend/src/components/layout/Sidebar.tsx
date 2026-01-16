import React, { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, LayoutGrid, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

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

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await apiClient.get('/projects');
            setProjects(res.data);
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
            onSelectProject(res.data.id); // Auto switch
        } catch (e) {
            console.error(e);
        }
    };

    // Optional: Delete project
    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this project? Files and data will be lost.")) return;

        try {
            await apiClient.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
            if (currentProjectId === id) onSelectProject(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="w-64 bg-slate-50 border-r border-slate-200 h-screen flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-slate-800">Learna Spaces</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="mb-4">
                    <Button
                        variant={currentProjectId === null ? "default" : "ghost"}
                        className="w-full justify-start gap-2"
                        onClick={() => onSelectProject(null)}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Global / No Project
                    </Button>
                </div>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    My Projects
                </div>

                {projects.map(p => (
                    <div
                        key={p.id}
                        onClick={() => onSelectProject(p.id)}
                        className={cn(
                            "group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors",
                            currentProjectId === p.id
                                ? "bg-white shadow-sm border border-slate-200 text-blue-600 font-medium"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Folder className={cn("w-4 h-4", currentProjectId === p.id ? "fill-blue-100" : "")} />
                            <span className="truncate">{p.name}</span>
                        </div>
                        <Trash2
                            className="w-3 h-3 opacity-0 group-hover:opacity-50 hover:!opacity-100"
                            onClick={(e) => handleDelete(p.id, e)}
                        />
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
                Learna V2 Alpha
            </div>
        </div>
    );
}
