"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiLoader, FiPlus, FiSettings, FiAlignLeft, FiVideo, FiCheckSquare, FiList, FiLayout } from "react-icons/fi";
import { MdDragIndicator, MdOutlinePlayLesson } from "react-icons/md";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import { apiFetch } from "@/lib/apiClient";

const getComponentIcon = (type: string) => {
  switch (type) {
    case "MultipleChoice": return <FiCheckSquare />;
    case "ExplainerMedia": return <FiVideo />;
    case "Ordering": return <FiList />;
    case "MatchingPairs": return <FiLayout />;
    case "FeynmanMirror": return <FiSettings />;
    default: return <FiAlignLeft />;
  }
};

export default function CourseEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [units, setUnits] = useState<any[]>([]);

  // Selection State
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (toIndex: number) => {
    if (draggedIndex === null || draggedIndex === toIndex) return;
    
    const newUnits = [...units];
    const components = [...newUnits[activeUnitIndex].nodes[activeNodeIndex].components];
    const [removed] = components.splice(draggedIndex, 1);
    components.splice(toIndex, 0, removed);
    newUnits[activeUnitIndex].nodes[activeNodeIndex].components = components;
    
    setUnits(newUnits);
    setDraggedIndex(null);
  };

  const handleNodeDrop = (uIdx: number, toIndex: number) => {
    if (draggedIndex === null || draggedIndex === toIndex) return;
    
    const newUnits = [...units];
    const nodes = [...newUnits[uIdx].nodes];
    const [removed] = nodes.splice(draggedIndex, 1);
    nodes.splice(toIndex, 0, removed);
    newUnits[uIdx].nodes = nodes;
    
    setUnits(newUnits);
    setDraggedIndex(null);
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const data = await apiFetch<any>(`/custom-courses/${courseId}`);
      setCourseTitle(data.title);
      if (data.syllabus_json && data.syllabus_json.units) {
        setUnits(data.syllabus_json.units);
      } else {
        setUnits([{ unitId: "u1", unitTitle: "Introduction", unitDescription: "First unit", nodes: [] }]);
      }
    } catch (err) {
      console.error(err);
      alert("Course not found");
      router.push("/courses/custom");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const syllabus_json = { courseTitle, units };
      await apiFetch<any>(`/custom-courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({ title: courseTitle, syllabus_json })
      });
      alert("Course saved successfully!");
    } catch (err) {
      alert("Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  const addUnit = () => {
    setUnits([...units, { unitId: `u_${Date.now()}`, unitTitle: "New Unit", unitDescription: "Describe this unit", nodes: [] }]);
  };

  const addNodeToUnit = (unitIndex: number) => {
    const newUnits = [...units];
    const newNode = {
      id: `n_${Date.now()}`,
      title: "New Lesson",
      description: "Description",
      status: "locked",
      components: []
    };
    newUnits[unitIndex].nodes.push(newNode);
    setUnits(newUnits);
    setActiveUnitId(newUnits[unitIndex].unitId);
    setActiveNodeId(newNode.id);
  };

  const addComponentToActiveNode = (type: string) => {
    if (!activeUnitId || !activeNodeId) return;
    const newUnits = [...units];
    const uIdx = newUnits.findIndex(u => u.unitId === activeUnitId);
    if (uIdx === -1) return;
    const nIdx = newUnits[uIdx].nodes.findIndex((n: any) => n.id === activeNodeId);
    if (nIdx === -1) return;

    if (!newUnits[uIdx].nodes[nIdx].components) {
      newUnits[uIdx].nodes[nIdx].components = [];
    }

    const newComponent = {
      id: `c_${Date.now()}`,
      type,
      topic: "Python Basics",
      difficulty: "medium",
      question: type === "ExplainerMedia" ? "" : "New Question",
      content: type === "ExplainerMedia" ? "This is a new media lesson." : undefined,
      options: type === "MultipleChoice" ? ["Option A", "Option B"] : undefined,
      correctOptionId: type === "MultipleChoice" ? "Option A" : undefined,
      steps: type === "Ordering" ? ["First step", "Second step", "Third step"] : undefined,
      pairs: type === "MatchingPairs" ? [
        { id: `p1_${Date.now()}`, left: "Left text A", right: "Right text A" },
        { id: `p2_${Date.now()}`, left: "Left text B", right: "Right text B" }
      ] : undefined,
      sampleAnswer: type === "FeynmanMirror" ? "A simple explanation of the concept." : undefined,
      maxRounds: type === "FeynmanMirror" ? 10 : undefined,
      successFeedback: "Great job! That's correct.",
      errorFeedback: "Oops! Try again."
    };

    newUnits[uIdx].nodes[nIdx].components.push(newComponent);
    setUnits(newUnits);
    setActiveComponentId(newComponent.id);
  };

  // Derived state helpers
  const getActiveUnitIndex = () => units.findIndex(u => u.unitId === activeUnitId);
  const activeUnitIndex = getActiveUnitIndex();
  const getActiveNodeIndex = () => activeUnitIndex >= 0 ? units[activeUnitIndex].nodes.findIndex((n: any) => n.id === activeNodeId) : -1;
  const activeNodeIndex = getActiveNodeIndex();
  const activeNode = activeUnitIndex >= 0 && activeNodeIndex >= 0 ? units[activeUnitIndex].nodes[activeNodeIndex] : null;
  const activeComponent = activeNode?.components?.find((c: any) => c.id === activeComponentId);

  const updateActiveComponentProperty = (prop: string, value: any) => {
    if (activeUnitIndex < 0 || activeNodeIndex < 0) return;
    const newUnits = [...units];
    const comp = newUnits[activeUnitIndex].nodes[activeNodeIndex].components?.find((c: any) => c.id === activeComponentId);
    if (comp) {
      comp[prop] = value;
      setUnits(newUnits);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-shared-bg">
        <FiLoader className="w-10 h-10 animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col app-shared-bg overflow-hidden">
      <TopStatsBar 
        pageTitle="Course Editor" 
        backHref="/courses/custom"
        mascotSrc="/icons/icon.ico"
        mascotAlt="Course Editor mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* LEFT COLUMN: Syllabus Tree */}
        <DeepGlassCard className="w-72 flex flex-col flex-none overflow-hidden p-4 border border-white/60 bg-white/70">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-xs font-extrabold text-brand-gray-500 uppercase tracking-widest flex items-center gap-2"><FiLayout /> Syllabus Tree</h3>
            <button onClick={handleSave} disabled={saving} className="text-xs bg-brand-teal text-white font-bold px-2.5 py-1 rounded-xl shadow-sm hover:bg-brand-teal/90 transition disabled:opacity-50">
              {saving ? "..." : "Save"}
            </button>
          </div>
          
          <div className="mb-4 pb-4 border-b border-white/40">
            <input 
              value={courseTitle} 
              onChange={(e) => setCourseTitle(e.target.value)}
              className="text-lg font-heading font-extrabold text-brand-gray-700 bg-white/50 border border-white/60 rounded-lg px-2 py-1 outline-none w-full shadow-inner focus:border-brand-teal/50 transition"
              placeholder="Course Title"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {units.map((unit, uIdx) => (
              <div key={unit.unitId} className="space-y-1">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-5 h-5 rounded bg-brand-gray-200 text-brand-gray-500 flex items-center justify-center text-[10px] font-bold">{uIdx + 1}</div>
                    <input 
                      value={unit.unitTitle} 
                      onChange={(e) => {
                        const newUnits = [...units];
                        newUnits[uIdx].unitTitle = e.target.value;
                        setUnits(newUnits);
                      }}
                      className="text-sm font-bold text-brand-gray-700 bg-transparent border-none outline-none w-full truncate"
                    />
                  </div>
                  <button onClick={() => addNodeToUnit(uIdx)} className="opacity-0 group-hover:opacity-100 p-1 text-brand-teal hover:bg-brand-teal/10 rounded transition"><FiPlus /></button>
                </div>

                <div className="pl-3 border-l-2 border-brand-gray-100 ml-2.5 space-y-1 mt-1">
                  {unit.nodes?.map((node: any, nIdx: number) => (
                    <div 
                      key={node.id} 
                      draggable
                      onDragStart={() => handleDragStart(nIdx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleNodeDrop(uIdx, nIdx)}
                      onClick={() => { setActiveUnitId(unit.unitId); setActiveNodeId(node.id); setActiveComponentId(null); }}
                      className={`text-xs p-1.5 rounded-lg cursor-pointer flex items-center gap-2 transition ${activeNodeId === node.id ? 'bg-brand-teal/15 text-brand-teal font-bold shadow-sm' : 'text-brand-gray-500 hover:bg-white/60'} ${draggedIndex === nIdx && activeUnitId === unit.unitId ? 'opacity-30' : ''}`}
                    >
                      <MdOutlinePlayLesson className={activeNodeId === node.id ? 'text-brand-teal' : 'text-brand-gray-400'} />
                      <span className="truncate">{node.title || "Untitled Node"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addUnit} className="w-full py-2 border border-dashed border-brand-gray-300 rounded-lg text-xs font-bold text-brand-gray-500 hover:text-brand-teal hover:border-brand-teal hover:bg-brand-teal/5 flex items-center justify-center transition">
              <FiPlus className="mr-1" /> Add Unit
            </button>
          </div>
        </DeepGlassCard>

        {/* MIDDLE COLUMN: Node Editor & Component Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/40 rounded-3xl border border-white/50 shadow-sm backdrop-blur-sm overflow-hidden relative">
          {activeNode ? (
            <div className="flex flex-col h-full absolute inset-0">
              <div className="p-6 border-b border-white/50 bg-white/60">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-teal uppercase tracking-widest mb-2">
                  <FiSettings /> Node Settings
                </div>
                <input 
                  value={activeNode.title}
                  onChange={(e) => {
                    const newUnits = [...units];
                    newUnits[activeUnitIndex].nodes[activeNodeIndex].title = e.target.value;
                    setUnits(newUnits);
                  }}
                  className="text-2xl font-heading font-extrabold text-brand-gray-700 bg-transparent border-none outline-none w-full mb-1"
                  placeholder="Lesson Title"
                />
                <input 
                  value={activeNode.description || ""}
                  onChange={(e) => {
                    const newUnits = [...units];
                    newUnits[activeUnitIndex].nodes[activeNodeIndex].description = e.target.value;
                    setUnits(newUnits);
                  }}
                  className="text-sm font-medium text-brand-gray-500 bg-transparent border-none outline-none w-full"
                  placeholder="Lesson Description..."
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(!activeNode.components || activeNode.components.length === 0) && (
                  <div className="text-center py-16 border-2 border-dashed border-brand-gray-200 rounded-3xl bg-white/30">
                    <FiPlus className="text-4xl text-brand-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-brand-gray-400">Add your first learning component below</p>
                  </div>
                )}
                
                {activeNode.components?.map((comp: any, cIdx: number) => (
                  <DeepGlassCard 
                    key={comp.id} 
                    draggable
                    onDragStart={() => handleDragStart(cIdx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(cIdx)}
                    className={`p-5 border-2 transition-all relative group ${activeComponentId === comp.id ? 'border-brand-teal shadow-xl ring-4 ring-brand-teal/10 translate-x-1' : 'border-white/60 hover:border-brand-teal/30 shadow-sm'} ${draggedIndex === cIdx ? 'opacity-40 scale-95 border-brand-teal/50' : ''}`}
                    onClick={() => setActiveComponentId(comp.id)}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newUnits = [...units];
                        newUnits[activeUnitIndex].nodes[activeNodeIndex].components.splice(cIdx, 1);
                        setUnits(newUnits);
                        if (activeComponentId === comp.id) setActiveComponentId(null);
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                    >
                      <FiPlus className="rotate-45 w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-4">
                      <MdDragIndicator className="text-brand-gray-300 cursor-grab active:cursor-grabbing" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full flex items-center gap-2 border border-brand-teal/20">
                        {getComponentIcon(comp.type)}
                        {comp.type}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-brand-teal/20 to-transparent" />
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                          {comp.type === 'ExplainerMedia' ? 'Instruction / Script' : 'Question / Prompt'}
                        </label>
                        <textarea 
                          value={comp.question || comp.content || ""}
                          onChange={(e) => {
                            const newUnits = [...units];
                            const key = ['ExplainerMedia', 'FeynmanMirror'].includes(comp.type) ? 'content' : 'question';
                            newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx][key] = e.target.value;
                            setUnits(newUnits);
                          }}
                          placeholder={`Enter ${comp.type} main content here...`}
                          className="w-full bg-white/60 border border-brand-gray-100 rounded-2xl p-4 text-sm font-medium text-brand-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all min-h-[100px] shadow-inner"
                        />
                      </div>

                      {comp.type === 'MultipleChoice' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          {comp.options?.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${comp.correctOptionId === opt ? 'bg-brand-teal/5 border-brand-teal/30 ring-1 ring-brand-teal/20' : 'bg-white/40 border-brand-gray-100'}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${comp.correctOptionId === opt ? 'bg-brand-teal text-white' : 'bg-brand-gray-100 text-brand-gray-400'}`}>
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              <input 
                                value={opt}
                                onChange={(e) => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options[optIdx] = e.target.value;
                                  setUnits(newUnits);
                                }}
                                className="bg-transparent border-none outline-none text-xs font-bold text-brand-gray-700 flex-1"
                                placeholder={`Option ${optIdx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {comp.type === 'Ordering' && (
                        <div className="space-y-2 mt-4">
                          {comp.steps?.map((step: string, stepIdx: number) => (
                            <div key={stepIdx} className="flex items-center gap-3 p-3 rounded-xl border border-brand-gray-100 bg-white/40">
                              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center text-[10px] font-black border border-indigo-100">
                                {stepIdx + 1}
                              </div>
                              <input 
                                value={step}
                                onChange={(e) => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps[stepIdx] = e.target.value;
                                  setUnits(newUnits);
                                }}
                                className="bg-transparent border-none outline-none text-xs font-bold text-brand-gray-700 flex-1"
                                placeholder={`Step ${stepIdx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DeepGlassCard>
                ))}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 border-t border-brand-gray-200">
                  {[
                    { type: 'ExplainerMedia', label: 'Explainer', icon: <FiVideo /> },
                    { type: 'MultipleChoice', label: 'Choice', icon: <FiCheckSquare /> },
                    { type: 'Ordering', label: 'Ordering', icon: <FiList /> },
                    { type: 'MatchingPairs', label: 'Matching', icon: <FiLayout /> },
                    { type: 'FeynmanMirror', label: 'Feynman', icon: <FiSettings /> },
                  ].map((btn) => (
                    <button 
                      key={btn.type}
                      onClick={() => addComponentToActiveNode(btn.type)} 
                      className="p-3 border border-white/60 bg-white/80 hover:bg-brand-teal/5 rounded-2xl text-[10px] font-black text-brand-gray-500 flex flex-col items-center gap-2 transition-all shadow-sm hover:text-brand-teal hover:border-brand-teal/40 hover:-translate-y-1 active:scale-95 uppercase tracking-tighter"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-gray-50 flex items-center justify-center text-xl transition-colors group-hover:bg-white">
                        {btn.icon}
                      </div>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-12 max-w-sm">
                <div className="w-24 h-24 bg-brand-teal/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-teal/10">
                  <FiList className="text-4xl text-brand-teal/30" />
                </div>
                <h3 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-2">Select a Lesson</h3>
                <p className="text-sm text-brand-gray-400 font-medium leading-relaxed">Choose a node from the syllabus tree on the left to start building its learning journey.</p>
              </div>
            </div>
          )}
        </div>


        {/* RIGHT COLUMN: Inspector & Preview */}
        <DeepGlassCard className="w-96 flex flex-col flex-none overflow-hidden border border-white/60 bg-white/80 shadow-2xl">
          <div className="p-5 border-b border-white/40 bg-white/40 flex items-center justify-between">
            <h3 className="font-heading text-xs font-black text-brand-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <FiSettings className="animate-spin-slow" /> Component Inspector
            </h3>
            {activeComponent && (
               <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-full">
                 Active
               </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {activeComponent ? (
              <div className="space-y-8">
                {/* Section: Common Settings */}
                <div className="space-y-5">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="h-4 w-1 bg-brand-teal rounded-full" />
                     <h4 className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Base Metadata</h4>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Learning Topic</label>
                        <input 
                          type="text" 
                          placeholder="e.g. loops, logic" 
                          value={activeComponent.topic || ""}
                          onChange={(e) => updateActiveComponentProperty("topic", e.target.value)}
                          className="w-full bg-white border border-brand-gray-100 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Complexity</label>
                        <select 
                          value={activeComponent.difficulty || "medium"}
                          onChange={(e) => updateActiveComponentProperty("difficulty", e.target.value)}
                          className="w-full bg-white border border-brand-gray-100 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all shadow-sm appearance-none"
                        >
                          <option value="low">Low (Foundation)</option>
                          <option value="medium">Medium (Standard)</option>
                          <option value="high">High (Advanced)</option>
                        </select>
                      </div>
                   </div>
                </div>

                {/* Section: Dynamic Content Editors */}
                <div className="space-y-5 pt-5 border-t border-brand-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                    <h4 className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Component Content</h4>
                  </div>

                  {activeComponent.type === 'MultipleChoice' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider mb-2 ml-1">Correct Answer</label>
                        <select
                          value={activeComponent.correctOptionId || activeComponent.options?.[0] || ""}
                          onChange={(e) => updateActiveComponentProperty("correctOptionId", e.target.value)}
                          className="w-full bg-brand-teal text-white border-none rounded-xl p-3 text-xs font-black outline-none shadow-md shadow-brand-teal/20 hover:bg-brand-teal/90 transition-all cursor-pointer"
                        >
                          {activeComponent.options?.map((opt: string, optIdx: number) => (
                            <option key={optIdx} value={opt} className="text-brand-gray-700 bg-white font-bold">{opt || `Option ${optIdx + 1}`}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                         <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider mb-2 ml-1">Manage Options</label>
                         {activeComponent.options?.map((opt: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 group">
                               <input 
                                 value={opt}
                                 onChange={(e) => {
                                   const newOpts = [...activeComponent.options];
                                   newOpts[i] = e.target.value;
                                   updateActiveComponentProperty("options", newOpts);
                                 }}
                                 className="flex-1 bg-white border border-brand-gray-100 rounded-xl p-2.5 text-xs font-medium outline-none focus:border-brand-teal"
                               />
                               <button 
                                 onClick={() => {
                                   const newOpts = activeComponent.options.filter((_: any, idx: number) => idx !== i);
                                   updateActiveComponentProperty("options", newOpts);
                                 }}
                                 className="text-rose-400 hover:text-rose-600 transition"
                               >
                                 <FiPlus className="rotate-45" />
                               </button>
                            </div>
                         ))}
                         <button 
                            onClick={() => updateActiveComponentProperty("options", [...(activeComponent.options || []), "New Option"])}
                            className="w-full py-2 rounded-xl border border-dashed border-brand-teal/30 text-[10px] font-black text-brand-teal hover:bg-brand-teal/5 transition-colors uppercase tracking-widest"
                         >
                            + Add Option
                         </button>
                      </div>
                    </div>
                  )}

                  {activeComponent.type === 'Ordering' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider mb-2 ml-1">Sequence Steps</label>
                         {activeComponent.steps?.map((step: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                               <div className="w-5 h-5 flex-shrink-0 bg-brand-gray-100 text-[10px] font-black flex items-center justify-center rounded text-brand-gray-400">
                                 {i + 1}
                               </div>
                               <input 
                                 value={step}
                                 onChange={(e) => {
                                   const newSteps = [...activeComponent.steps];
                                   newSteps[i] = e.target.value;
                                   updateActiveComponentProperty("steps", newSteps);
                                 }}
                                 className="flex-1 bg-white border border-brand-gray-100 rounded-xl p-2.5 text-xs font-medium outline-none focus:border-brand-teal"
                               />
                               <button 
                                 onClick={() => {
                                   const newSteps = activeComponent.steps.filter((_: any, idx: number) => idx !== i);
                                   updateActiveComponentProperty("steps", newSteps);
                                 }}
                                 className="text-rose-400 hover:text-rose-600 transition"
                               >
                                 <FiPlus className="rotate-45" />
                               </button>
                            </div>
                         ))}
                         <button 
                            onClick={() => updateActiveComponentProperty("steps", [...(activeComponent.steps || []), "New Step"])}
                            className="w-full py-2 rounded-xl border border-dashed border-brand-teal/30 text-[10px] font-black text-brand-teal hover:bg-brand-teal/5 transition-colors uppercase tracking-widest"
                         >
                            + Add Step
                         </button>
                      </div>
                    </div>
                  )}

                  {activeComponent.type === 'MatchingPairs' && (
                    <div className="space-y-4">
                       <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Match Pairs (L ⇆ R)</label>
                       {activeComponent.pairs?.map((pair: any, i: number) => (
                          <div key={pair.id || i} className="p-3 bg-white border border-brand-gray-100 rounded-2xl space-y-2 relative group shadow-sm">
                             <input 
                               value={pair.left || ""}
                               placeholder="Term..."
                               onChange={(e) => {
                                 const newPairs = [...activeComponent.pairs];
                                 newPairs[i].left = e.target.value;
                                 updateActiveComponentProperty("pairs", newPairs);
                               }}
                               className="w-full bg-brand-gray-50 border-none rounded-lg p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-brand-teal/30"
                             />
                             <div className="flex justify-center py-1">
                                <div className="h-px w-8 bg-brand-gray-200 relative">
                                   <div className="absolute inset-0 flex items-center justify-center -top-2 text-[10px]">⇆</div>
                                </div>
                             </div>
                             <input 
                               value={pair.right || ""}
                               placeholder="Definition..."
                               onChange={(e) => {
                                 const newPairs = [...activeComponent.pairs];
                                 newPairs[i].right = e.target.value;
                                 updateActiveComponentProperty("pairs", newPairs);
                               }}
                               className="w-full bg-brand-teal/5 border-none rounded-lg p-2 text-[11px] font-bold text-brand-teal outline-none focus:ring-1 focus:ring-brand-teal/30"
                             />
                             <button 
                               onClick={() => {
                                 const newPairs = activeComponent.pairs.filter((_: any, idx: number) => idx !== i);
                                 updateActiveComponentProperty("pairs", newPairs);
                               }}
                               className="absolute -top-2 -right-2 bg-white shadow-sm border border-brand-gray-100 rounded-full p-1 text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                             >
                               <FiPlus className="rotate-45 w-3 h-3" />
                             </button>
                          </div>
                       ))}
                       <button 
                          onClick={() => updateActiveComponentProperty("pairs", [...(activeComponent.pairs || []), { id: Date.now().toString(), left: "", right: "" }])}
                          className="w-full py-2 rounded-xl border border-dashed border-brand-teal/30 text-[10px] font-black text-brand-teal hover:bg-brand-teal/5 transition-colors uppercase tracking-widest"
                       >
                          + Add New Pair
                       </button>
                    </div>
                  )}

                  {activeComponent.type === 'FeynmanMirror' && (
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Ideal Model Answer</label>
                        <textarea 
                          placeholder="What would a perfect explanation look like?" 
                          value={activeComponent.sampleAnswer || ""}
                          onChange={(e) => updateActiveComponentProperty("sampleAnswer", e.target.value)}
                          className="w-full bg-white border border-brand-gray-100 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all min-h-[120px] shadow-sm leading-relaxed" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Max Dialogue Depth</label>
                        <div className="flex items-center gap-3">
                           <input 
                            type="range"
                            min="1"
                            max="20"
                            step="1"
                            value={activeComponent.maxRounds || 10}
                            onChange={(e) => updateActiveComponentProperty("maxRounds", parseInt(e.target.value))}
                            className="flex-1 accent-brand-teal"
                          />
                          <span className="w-8 text-center text-xs font-black text-brand-teal bg-brand-teal/10 py-1 rounded-lg border border-brand-teal/20">
                            {activeComponent.maxRounds || 10}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Feedback & Results */}
                <div className="space-y-5 pt-5 border-t border-brand-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 bg-amber-500 rounded-full" />
                    <h4 className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">Feedback Messages</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Success Response</label>
                      <textarea 
                        placeholder="Excellent explanation! You've mastered..." 
                        value={activeComponent.successFeedback || ""}
                        onChange={(e) => updateActiveComponentProperty("successFeedback", e.target.value)}
                        className="w-full bg-white border border-brand-gray-100 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-green-500/10 focus:border-green-500/40 transition-all min-h-[60px] shadow-sm" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-brand-gray-500 uppercase tracking-wider ml-1">Error Guidance</label>
                      <textarea 
                        placeholder="Not quite. Try focusing on the concept of..." 
                        value={activeComponent.errorFeedback || ""}
                        onChange={(e) => updateActiveComponentProperty("errorFeedback", e.target.value)}
                        className="w-full bg-white border border-brand-gray-100 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/40 transition-all min-h-[60px] shadow-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 text-center pb-10">
                   <p className="text-[9px] font-black text-brand-gray-300 uppercase tracking-[0.3em]">
                     Auto-saving to cloud...
                   </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-10">
                <div className="w-16 h-16 bg-brand-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-brand-gray-100 rotate-12">
                  <FiSettings className="text-2xl text-brand-gray-200" />
                </div>
                <p className="text-xs font-bold text-brand-gray-400 max-w-[200px]">Select any component in the canvas to adjust its pedagogical properties.</p>
              </div>
            )}
          </div>
        </DeepGlassCard>
      </div>
    </div>
  );
}
