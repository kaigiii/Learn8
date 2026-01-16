"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SyllabusMap } from '@/components/SyllabusMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CoursePath } from '@/types/lesson';
import { Loader2 } from 'lucide-react';

export default function MapPage() {
    const [topic, setTopic] = useState("Calculus");
    const [isLoading, setIsLoading] = useState(false);
    const [coursePath, setCoursePath] = useState<CoursePath | null>(null);

    const generateSyllabus = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:8001/generate-syllabus?topic=${encodeURIComponent(topic)}`, {
                method: 'POST'
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to generate syllabus");
            }

            const data = await res.json();
            setCoursePath(data);
        } catch (e: any) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNodeClick = (nodeId: string) => {
        console.log("Clicked Node:", nodeId);
        alert(`You clicked node: ${nodeId}. In Part 3, this will open the Chat/Lesson view.`);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header / Input Area */}
            <div className="p-6 bg-white shadow-sm z-10 flex items-center gap-4">
                <h1 className="text-xl font-bold text-slate-800">Path Architect</h1>
                <div className="flex-1 max-w-xl flex gap-2">
                    <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter Topic..."
                        disabled={isLoading}
                    />
                    <Button onClick={generateSyllabus} disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                        Generate Map
                    </Button>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                {coursePath ? (
                    <SyllabusMap coursePath={coursePath} onNodeClick={handleNodeClick} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Enter a topic to generate a Learning Path.
                    </div>
                )}
            </div>
        </div>
    );
}
