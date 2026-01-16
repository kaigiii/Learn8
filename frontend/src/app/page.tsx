
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { apiClient } from '@/lib/api-client';

import StageRenderer from '@/features/stage-player/components/StageRenderer';
import Dashboard from '@/features/dashboard/components/Dashboard';
import { SyllabusMap } from '@/features/course-map/components/SyllabusMap';
import { NodeDrawer } from '@/features/course-map/components/NodeDrawer';
import { ChatSidebar, ChatMessage } from '@/features/chat/components/ChatSidebar';
import Sidebar from '@/components/layout/Sidebar';
import RightSidebar from '@/components/layout/RightSidebar';

import { LessonStage, CoursePath, LessonNode } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { token, logout } = useAuthStore();
  const { currentProject, setCurrentProject } = useProjectStore(); // Use global project store if possible, local state in original

  // Local state for specific page logic
  const [coursePath, setCoursePath] = useState<CoursePath | null>(null);
  const [activeStage, setActiveStage] = useState<LessonStage | null>(null);

  // Drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<LessonNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGeneratingNode, setIsGeneratingNode] = useState(false);

  // Autoresume
  const [shouldAutoResume, setShouldAutoResume] = useState(false);
  const [currentProjectId_Local, setCurrentProjectId_Local] = useState<number | null>(null);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  if (!token) return null; // Prevent flash

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Handlers
  const handleSyllabusGenerated = (path: CoursePath) => {
    setCoursePath(path);
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    let foundNode: LessonNode | null = null;
    coursePath?.units.forEach(u => {
      u.nodes.forEach(n => {
        if (n.id === nodeId) foundNode = n;
      })
    });
    setSelectedNode(foundNode);
    setIsDrawerOpen(true);
  };

  // Chat


  const handleRefineSyllabus = async (message: string) => {
    if (!coursePath) return;
    const newHistory = [...chatMessages, { role: 'user', content: message } as ChatMessage];
    setChatMessages(newHistory);
    setIsRefining(true);

    try {
      const res = await apiClient.post('/refine-syllabus', {
        topic: coursePath.courseTitle,
        currentSyllabus: coursePath,
        userFeedback: message,
        history: newHistory.filter(m => m.content),
        projectId: currentProjectId_Local
      });

      const newPath = res.data;
      setCoursePath(newPath);
      setChatMessages(prev => [...prev, { role: 'model', content: "I've updated the syllabus map based on your feedback." }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'model', content: "Error refining map: " + (e.response?.data?.detail || e.message) }]);
    } finally {
      setIsRefining(false);
    }
  };

  const handleStartLesson = async (node?: LessonNode) => {
    const targetNode = node || selectedNode;
    if (!targetNode || !coursePath) return;

    setIsGeneratingNode(true);
    try {
      const res = await apiClient.post(`/lessons/generate-lesson-from-node?topic=${encodeURIComponent(coursePath.courseTitle)}${currentProjectId_Local ? `&project_id=${currentProjectId_Local}` : ''}`,
        targetNode
      );

      setActiveStage(res.data);
      setIsDrawerOpen(false);
    } catch (e: any) {
      alert("Error generating lesson: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsGeneratingNode(false);
    }
  };

  const handleExitLesson = () => {
    setActiveStage(null);
  };

  const handleLessonComplete = async () => {
    if (!selectedNodeId || !coursePath) {
      handleExitLesson();
      return;
    }

    try {
      const res = await apiClient.patch(`/courses/${coursePath.id}/node/${selectedNodeId}/status`, {
        status: 'completed'
      });
      setCoursePath(res.data);
    } catch (e) {
      console.error("Failed to update progress", e);
    } finally {
      handleExitLesson();
    }
  };

  const handleBackToDashboard = () => {
    setCoursePath(null);
    setActiveStage(null);
    setSelectedNode(null);
  };

  const handleResumeCourse = async (courseId: number) => {
    try {
      const res = await apiClient.get(`/courses/${courseId}`);
      setCoursePath(res.data);
    } catch (e: any) {
      alert("Failed to load course: " + e.message);
    }
  };



  // ... (in page.tsx component)

  const handleMockLoad = (stage: LessonStage) => {
    setActiveStage(stage);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-[family-name:var(--font-geist-sans)]">
      {/* Sidebar */}
      {!activeStage && (
        <Sidebar
          currentProjectId={currentProjectId_Local}
          onSelectProject={(id) => {
            setCurrentProjectId_Local(id);
            setShouldAutoResume(true);
            // Reset view to Dashboard so it can auto-resume the new project
            setCoursePath(null);
            setActiveStage(null);
          }}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-y-auto w-full">
        {/* ... existing main content ... */}
        {!activeStage && (
          <div className="absolute top-4 right-4 z-50">
            <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-red-500">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        )}

        {activeStage ? (
          <StageRenderer
            stages={[activeStage]}
            onExit={handleExitLesson}
            onComplete={handleLessonComplete}
          />
        ) : coursePath ? (
          <div className="relative h-screen flex flex-col">
            {/* ... existing map view ... */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBackToDashboard}>
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">{coursePath.courseTitle}</h1>
                  <p className="text-sm text-slate-500">{coursePath.units.length} Units • Learning Path</p>
                </div>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <SyllabusMap coursePath={coursePath} onNodeClick={handleNodeClick} />
              <ChatSidebar
                isOpen={isChatOpen}
                onToggle={() => setIsChatOpen(!isChatOpen)}
                messages={chatMessages}
                onSendMessage={handleRefineSyllabus}
                isRefining={isRefining}
              />
            </div>

            <NodeDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              node={selectedNode}
              onStartLesson={(node) => handleStartLesson(node)}
              isGenerating={isGeneratingNode}
            />
          </div>
        ) : (
          <div className="flex flex-col min-h-screen">
            <Dashboard
              onLessonGenerated={handleSyllabusGenerated}
              currentProjectId={currentProjectId_Local}
              onResume={handleResumeCourse}
              shouldAutoResume={shouldAutoResume}
              onAutoResumeComplete={() => setShouldAutoResume(false)}
            />
            <div className="bg-slate-50 py-12 px-6 border-t border-slate-200" />
          </div>
        )}
      </main>

      {/* Right Sidebar (Always visible unless playing stage) */}
      {!activeStage && (
        <RightSidebar
          currentProjectName={currentProjectId_Local ? "Current Project" : "Global Scope"}
          onLoadMock={handleMockLoad}
        />
      )}
    </div>
  );
}
