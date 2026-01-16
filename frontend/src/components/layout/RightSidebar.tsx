import React from 'react';
import { Play, Database, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_STAGES } from '@/lib/mock-data';
import { ComponentType, LessonStage } from '@/types/lesson';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface RightSidebarProps {
    onLoadMock: (stage: LessonStage) => void;
    currentProjectName?: string;
}

export default function RightSidebar({ onLoadMock, currentProjectName }: RightSidebarProps) {

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

    return (
        <div className="w-80 h-screen bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
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

            {/* Admin Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2 mt-auto">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    System Admin
                </h3>
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
