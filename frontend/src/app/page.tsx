/**
 * 檔案名稱: app/page.tsx
 * 功能描述: 首頁 (Home Page)
 * 
 * 應用程式的主要 View Controller。
 * 負責協調大多數的全域狀態與組件切換。
 * 
 * 核心狀態 (State):
 * - `coursePath`: 存放目前生成的課程大綱。若有值則顯示地圖，否則顯示 Dashboard。
 * - `activeStages`: 存放目前正在進行的課程單元 (StagePlayer)。
 * - `isDrawerOpen`: 控制側邊欄顯示。
 * - `shouldAutoResume`: 處理專案切換時的自動載入邏輯。
 * 
 * 主要邏輯:
 * - `handleStartLesson`: 呼叫後端生成 Stage 並進入播放模式。
 * - `handleRefineSyllabus`: 呼叫後端修改大綱。
 * - Auth Guard: 檢查 Token，未登入則導向 `/login`。
 */
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useJobStore } from '@/stores/useJobStore';
import { apiClient } from '@/lib/api-client';

import StageRenderer from '@/features/stage-player/components/StageRenderer';
import Dashboard from '@/features/dashboard/components/Dashboard';
import { SyllabusMap } from '@/features/course-map/components/SyllabusMap';
import { NodeDrawer } from '@/features/course-map/components/NodeDrawer';
import { ProfileView } from '@/features/profile/components/ProfileView';
import { ChatSidebar, ChatMessage } from '@/features/chat/components/ChatSidebar';
import Sidebar from '@/components/layout/Sidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import { getComponentLabStages } from '@/lib/component-lab';

import { LessonStage, CoursePath, LessonNode, FailedStageRecord } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { RegenerateDialog } from '@/components/ui/RegenerateDialog';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';

export default function Home() {
  const router = useRouter();
  const { token, refreshUser } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { setActiveJob, updateJobProgress, clearJob, jobStatus } = useJobStore();

  // Local state for specific page logic
  const [coursePath, setCoursePath] = useState<CoursePath | null>(null);
  const [activeStages, setActiveStages] = useState<LessonStage[] | null>(null);
  const [isInRemedialFlow, setIsInRemedialFlow] = useState(false);

  // Drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<LessonNode | null>(null);
  const [profileInitialView, setProfileInitialView] = useState<'view' | 'top_up'>('view');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGeneratingNode, setIsGeneratingNode] = useState(false);

  // Regenerate
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Autoresume
  const [shouldAutoResume, setShouldAutoResume] = useState(false);
  const [currentProjectId_Local, setCurrentProjectId_Local] = useState<number | null>(null);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);

  // Profile
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  // Sync Global Project State
  useEffect(() => {
    if (currentProject) {
      setCurrentProjectId_Local(currentProject.id);
      setShouldAutoResume(true);
    } else {
      setCurrentProjectId_Local(null);
    }
  }, [currentProject]);

  // Page Reload Auto-Recovery for Active Jobs
  useEffect(() => {
    if (!token) return;

    const checkActiveJobs = async () => {
      try {
        const res = await apiClient.get('/jobs/active');
        if (res.data.job_id) {
          const jobId = res.data.job_id;
          setActiveJob(jobId);

          // Reconnect EventSource
          const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/jobs/${jobId}/stream`);

          let isClosedIntentionally = false;

          eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            updateJobProgress(data.status.toLowerCase(), data.progress, data.message);

            if (data.status === 'COMPLETED') {
              isClosedIntentionally = true;
              eventSource.close();
              await refreshUser();

              let rd = data.result_data;
              if (typeof rd === 'string') {
                try { rd = JSON.parse(rd); } catch { }
              }

              if (rd?.course_id) {
                const detailRes = await apiClient.get(`/courses/${rd.course_id}`);
                setCoursePath(detailRes.data);
              } else if (rd?.stages) {
                setActiveStages(rd.stages);
              }
              setTimeout(() => clearJob(), 2000);
            } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
              isClosedIntentionally = true;
              eventSource.close();
            }
          };

          eventSource.onerror = () => {
            if (isClosedIntentionally) return;
            eventSource.close();
            clearJob();
          };
        }
      } catch (err) {
        console.error("Failed to recover active job", err);
      }
    };

    // Only run this if we are not currently tracking a job in Zustand
    // Use this to pick up unfinished jobs after F5
    if (jobStatus === 'idle') {
      checkActiveJobs();
    }
  }, [token, jobStatus]);

  if (!token) return null; // Prevent flash



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
      const res = await apiClient.post('/courses/refine-syllabus', {
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
    setIsDrawerOpen(false);
    setIsInRemedialFlow(false);

    try {
      const res = await apiClient.post(`/lessons/generate-lesson-from-node?topic=${encodeURIComponent(coursePath.courseTitle)}${currentProjectId_Local ? `&project_id=${currentProjectId_Local}` : ''}`,
        targetNode
      );

      const data = res.data;

      if (data.status === 'COMPLETED' && data.result_data?.stages) {
        // Server had this cached and returned it immediately
        setActiveStages(data.result_data.stages);
        setIsGeneratingNode(false);
      } else if (data.job_id) {
        // SSE Generation Flow
        const jobId = data.job_id;
        setActiveJob(jobId);
        setIsGeneratingNode(false); // The JobOverlay takes over

        const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/jobs/${jobId}/stream`);
        let isClosedIntentionally = false;

        eventSource.onmessage = async (event) => {
          const streamData = JSON.parse(event.data);
          updateJobProgress(streamData.status.toLowerCase(), streamData.progress, streamData.message);

          if (streamData.status === 'COMPLETED') {
            isClosedIntentionally = true;
            eventSource.close();
            await refreshUser();

            let rd = streamData.result_data;
            if (typeof rd === 'string') {
              try { rd = JSON.parse(rd); } catch { }
            }

            if (rd?.stages) {
              setActiveStages(rd.stages);
            }
            setTimeout(() => clearJob(), 2000);
          } else if (streamData.status === 'FAILED' || streamData.status === 'CANCELLED') {
            isClosedIntentionally = true;
            eventSource.close();
            alert("Generation Failed: " + streamData.message);
          }
        };

        eventSource.onerror = () => {
          if (isClosedIntentionally) return;
          eventSource.close();
          alert("Connection lost during generation.");
          clearJob();
        };
      } else if (Array.isArray(data)) {
        // Fallback legacy support
        setActiveStages(data);
        setIsGeneratingNode(false);
      }
    } catch (e: any) {
      alert("Error generating lesson: " + (e.response?.data?.detail || e.message));
      setIsGeneratingNode(false);
    }
  };

  const handleExitLesson = () => {
    setActiveStages(null);
    setIsInRemedialFlow(false);
  };

  const handlePlayComponentDemo = (component: 'TextToken' | 'Sequencer' | 'TaxonomyMatrix' | 'FeynmanMirror') => {
    setSelectedNodeId(null);
    setSelectedNode(null);
    setIsDrawerOpen(false);
    setIsProfileOpen(false);
    setCoursePath(null);
    setIsInRemedialFlow(false);
    setActiveStages(getComponentLabStages(component));
  };

  const handleLessonComplete = async (failedStages: FailedStageRecord[] = []) => {
    if (!selectedNodeId || !coursePath) {
      handleExitLesson();
      return;
    }

    try {
      if (!isInRemedialFlow && failedStages.length > 0) {
        const remedialStages = await apiClient.post('/lessons/generate-remedial-stages', {
          topic: coursePath.courseTitle,
          failedStages,
        });

        if (Array.isArray(remedialStages.data) && remedialStages.data.length > 0) {
          setActiveStages(remedialStages.data);
          setIsInRemedialFlow(true);
          return;
        }
      }

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

  const handleRegenerate = async (newTopic: string) => {
    if (!currentProjectId_Local) return;
    try {
      setIsRegenerating(true);
      const res = await apiClient.post(`/courses/generate-syllabus?topic=${encodeURIComponent(newTopic)}&project_id=${currentProjectId_Local}&regenerate=true`);
      setCoursePath(res.data);
      setIsRegenerateOpen(false);
    } catch (e: any) {
      alert("Regeneration failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleResumeCourse = async (projectId: number) => {
    try {
      // 1. Fetch courses for this project
      const listRes = await apiClient.get<any[]>(`/courses?project_id=${projectId}`);
      const courses = listRes.data;

      if (courses.length > 0) {
        // Pick the latest one
        const latestCourse = courses[0];
        const detailRes = await apiClient.get(`/courses/${latestCourse.id}`);
        setCoursePath(detailRes.data);
      } else {
        // No course found, stay on dashboard
        setCoursePath(null);
      }
    } catch (e: any) {
      console.error("Failed to load course for project", projectId, e);
    }
  };



  const handleOpenProfile = (initialViewMode: 'view' | 'top_up' = 'view') => {
    setIsProfileOpen(true);
    setProfileInitialView(initialViewMode);
    setCoursePath(null); // Clear dashboard/map view to show profile
    setActiveStages(null);
  };

  const handleCloseProfile = () => {
    setIsProfileOpen(false);
    setProfileInitialView('view');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-[family-name:var(--font-geist-sans)]">
      <ProgressOverlay />
      {/* Sidebar - Always visible unless playing stage */}
      {!activeStages && (
        <Sidebar
          currentProjectId={currentProjectId_Local}
          onSelectProject={(id) => {
            setCurrentProjectId_Local(id);
            setShouldAutoResume(true);
            setCoursePath(null);
            setActiveStages(null);
            setIsProfileOpen(false); // Close profile on project switch
          }}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-y-auto w-full">

        {activeStages ? (
          <StageRenderer
            stages={activeStages}
            onExit={handleExitLesson}
            onComplete={handleLessonComplete}
            allowDeferredRemedial={!isInRemedialFlow}
          />
        ) : isProfileOpen ? (
          <ProfileView onClose={handleCloseProfile} initialViewMode={profileInitialView} />
        ) : coursePath ? (
          <div className="relative h-screen flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4">

                <div>
                  <h1 className="text-xl font-bold text-slate-800">{coursePath.courseTitle}</h1>
                  <p className="text-sm text-slate-500">{coursePath.units.length} Units • Learning Path</p>
                </div>
              </div>

              {/* Regenerate Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRegenerateOpen(true)}
                className="flex items-center gap-2 text-slate-600 hover:text-blue-600"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </Button>

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

            <RegenerateDialog
              isOpen={isRegenerateOpen}
              onClose={() => setIsRegenerateOpen(false)}
              currentTopic={coursePath.topic || coursePath.courseTitle}
              onConfirm={handleRegenerate}
              isRegenerating={isRegenerating}
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

          </div>
        )}
      </main>

      {/* Right Sidebar (Always visible unless playing stage) */}
      {!activeStages && (
        <RightSidebar
          currentProjectName={currentProjectId_Local ? "Current Project" : "Global Scope"}
          onOpenProfile={handleOpenProfile}
          onPlayComponentDemo={handlePlayComponentDemo}
        />
      )}
    </div>
  );
}
