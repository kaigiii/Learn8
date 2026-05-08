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
                      onClick={() => { setActiveUnitId(unit.unitId); setActiveNodeId(node.id); setActiveComponentId(null); }}
                      className={`text-xs p-1.5 rounded-lg cursor-pointer flex items-center gap-2 transition ${activeNodeId === node.id ? 'bg-brand-teal/15 text-brand-teal font-bold shadow-sm' : 'text-brand-gray-500 hover:bg-white/60'}`}
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

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(!activeNode.components || activeNode.components.length === 0) && (
                  <div className="text-center py-10 border-2 border-dashed border-brand-gray-200 rounded-2xl">
                    <p className="text-sm font-bold text-brand-gray-400">No components in this node yet.</p>
                  </div>
                )}
                
                {activeNode.components?.map((comp: any, cIdx: number) => (
                  <DeepGlassCard 
                    key={comp.id} 
                    className={`p-4 border-2 transition-all cursor-pointer ${activeComponentId === comp.id ? 'border-brand-teal shadow-md ring-2 ring-brand-teal/20' : 'border-transparent hover:border-brand-teal/30 shadow-sm'}`}
                    onClick={() => setActiveComponentId(comp.id)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <MdDragIndicator className="text-brand-gray-300" />
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded flex items-center gap-1.5">
                        {getComponentIcon(comp.type)}
                        {comp.type}
                      </span>
                    </div>
                    
                    <textarea 
                      value={comp.question || comp.content || ""}
                      onChange={(e) => {
                        const newUnits = [...units];
                        newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx][['ExplainerMedia', 'FeynmanMirror'].includes(comp.type) ? 'content' : 'question'] = e.target.value;
                        setUnits(newUnits);
                      }}
                      placeholder={`Enter ${comp.type} content/question here...`}
                      className="w-full bg-white/50 border border-brand-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-brand-teal min-h-[80px]"
                    />

                    {comp.type === 'MultipleChoice' && (
                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-brand-teal/20">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider block mb-1">Answer Options</label>
                        {comp.options?.map((opt: string, optIdx: number) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-brand-teal/50">{String.fromCharCode(65 + optIdx)}.</span>
                            <input 
                              value={opt}
                              onChange={(e) => {
                                const newUnits = [...units];
                                newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options[optIdx] = e.target.value;
                                setUnits(newUnits);
                              }}
                              className="text-sm bg-white/50 border border-brand-gray-200 rounded p-1.5 outline-none focus:border-brand-teal flex-1"
                              placeholder={`Option ${optIdx + 1}`}
                            />
                            {comp.options.length > 2 && (
                              <button 
                                onClick={() => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options.splice(optIdx, 1);
                                  setUnits(newUnits);
                                }}
                                className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded px-2 py-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newUnits = [...units];
                            if (!newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options) {
                              newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options = [];
                            }
                            newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].options.push(`New Option`);
                            setUnits(newUnits);
                          }}
                          className="text-xs font-bold bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded px-3 py-1.5 mt-2 inline-flex items-center gap-1"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}

                    {comp.type === 'Ordering' && (
                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-brand-teal/20">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider block mb-1">Steps in Correct Order</label>
                        {comp.steps?.map((step: string, stepIdx: number) => (
                          <div key={stepIdx} className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-brand-teal/50">{stepIdx + 1}.</span>
                            <input 
                              value={step}
                              onChange={(e) => {
                                const newUnits = [...units];
                                newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps[stepIdx] = e.target.value;
                                setUnits(newUnits);
                              }}
                              className="text-sm bg-white/50 border border-brand-gray-200 rounded p-1.5 outline-none focus:border-brand-teal flex-1"
                              placeholder={`Step ${stepIdx + 1}`}
                            />
                            {comp.steps.length > 2 && (
                              <button 
                                onClick={() => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps.splice(stepIdx, 1);
                                  setUnits(newUnits);
                                }}
                                className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded px-2 py-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newUnits = [...units];
                            if (!newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps) {
                              newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps = [];
                            }
                            newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].steps.push(`New Step`);
                            setUnits(newUnits);
                          }}
                          className="text-xs font-bold bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded px-3 py-1.5 mt-2 inline-flex items-center gap-1"
                        >
                          + Add Step
                        </button>
                      </div>
                    )}

                    {comp.type === 'MatchingPairs' && (
                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-brand-teal/20">
                        <label className="text-xs font-bold text-brand-gray-500 uppercase tracking-wider block mb-1">Left & Right Match Pairs</label>
                        {comp.pairs?.map((pair: any, pairIdx: number) => (
                          <div key={pairIdx} className="space-y-1 bg-white/30 border border-brand-gray-100 p-2 rounded-lg relative">
                            <div className="flex gap-2 items-center">
                              <input 
                                value={pair.left || ""}
                                onChange={(e) => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs[pairIdx].left = e.target.value;
                                  setUnits(newUnits);
                                }}
                                className="text-xs bg-white/50 border border-brand-gray-200 rounded p-1.5 outline-none focus:border-brand-teal flex-1"
                                placeholder="Left side..."
                              />
                              <span className="text-xs font-bold text-brand-gray-400">⇆</span>
                              <input 
                                value={pair.right || ""}
                                onChange={(e) => {
                                  const newUnits = [...units];
                                  newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs[pairIdx].right = e.target.value;
                                  setUnits(newUnits);
                                }}
                                className="text-xs bg-white/50 border border-brand-gray-200 rounded p-1.5 outline-none focus:border-brand-teal flex-1"
                                placeholder="Right side..."
                              />
                              {comp.pairs.length > 1 && (
                                <button 
                                  onClick={() => {
                                    const newUnits = [...units];
                                    newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs.splice(pairIdx, 1);
                                    setUnits(newUnits);
                                  }}
                                  className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded px-2 py-1 shrink-0"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newUnits = [...units];
                            if (!newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs) {
                              newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs = [];
                            }
                            newUnits[activeUnitIndex].nodes[activeNodeIndex].components[cIdx].pairs.push({
                              id: `p_${Date.now()}`,
                              left: "Left text",
                              right: "Right text"
                            });
                            setUnits(newUnits);
                          }}
                          className="text-xs font-bold bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded px-3 py-1.5 mt-2 inline-flex items-center gap-1"
                        >
                          + Add Pair
                        </button>
                      </div>
                    )}
                  </DeepGlassCard>
                ))}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-brand-gray-200">
                  <button onClick={() => addComponentToActiveNode('ExplainerMedia')} className="p-3 border border-white/60 bg-white/70 hover:bg-brand-teal/5 rounded-xl text-xs font-bold text-brand-gray-600 flex flex-col items-center gap-2 transition shadow-sm hover:text-brand-teal hover:border-brand-teal/30">
                    <FiVideo className="text-xl" /> Explainer
                  </button>
                  <button onClick={() => addComponentToActiveNode('MultipleChoice')} className="p-3 border border-white/60 bg-white/70 hover:bg-brand-teal/5 rounded-xl text-xs font-bold text-brand-gray-600 flex flex-col items-center gap-2 transition shadow-sm hover:text-brand-teal hover:border-brand-teal/30">
                    <FiCheckSquare className="text-xl" /> Choice
                  </button>
                  <button onClick={() => addComponentToActiveNode('Ordering')} className="p-3 border border-white/60 bg-white/70 hover:bg-brand-teal/5 rounded-xl text-xs font-bold text-brand-gray-600 flex flex-col items-center gap-2 transition shadow-sm hover:text-brand-teal hover:border-brand-teal/30">
                    <FiList className="text-xl" /> Ordering
                  </button>
                  <button onClick={() => addComponentToActiveNode('MatchingPairs')} className="p-3 border border-white/60 bg-white/70 hover:bg-brand-teal/5 rounded-xl text-xs font-bold text-brand-gray-600 flex flex-col items-center gap-2 transition shadow-sm hover:text-brand-teal hover:border-brand-teal/30">
                    <FiLayout className="text-xl" /> Matching
                  </button>
                  <button onClick={() => addComponentToActiveNode('FeynmanMirror')} className="p-3 border border-white/60 bg-white/70 hover:bg-brand-teal/5 rounded-xl text-xs font-bold text-brand-gray-600 flex flex-col items-center gap-2 transition shadow-sm hover:text-brand-teal hover:border-brand-teal/30">
                    <FiSettings className="text-xl" /> Feynman
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FiList className="text-6xl text-brand-gray-300 mx-auto mb-4" />
                <h3 className="font-heading text-xl font-extrabold text-brand-gray-500">Select a Node</h3>
                <p className="text-sm text-brand-gray-400 mt-2">Choose a node from the syllabus tree to edit its components.</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Inspector & Preview */}
        <DeepGlassCard className="w-80 flex flex-col flex-none overflow-hidden border border-white/60 bg-white/70">
          <div className="p-4 border-b border-white/40 bg-white/40">
            <h3 className="font-heading text-xs font-extrabold text-brand-gray-500 uppercase tracking-widest flex items-center gap-2"><FiSettings /> Inspector</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeComponent ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Topic / Tags</label>
                  <input 
                    type="text" 
                    placeholder="e.g. loops, logic" 
                    value={activeComponent.topic || ""}
                    onChange={(e) => updateActiveComponentProperty("topic", e.target.value)}
                    className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Difficulty</label>
                  <select 
                    value={activeComponent.difficulty || "medium"}
                    onChange={(e) => updateActiveComponentProperty("difficulty", e.target.value)}
                    className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Success Feedback</label>
                  <textarea 
                    placeholder="Great job! The reason is..." 
                    value={activeComponent.successFeedback || ""}
                    onChange={(e) => updateActiveComponentProperty("successFeedback", e.target.value)}
                    className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal min-h-[60px]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Error Feedback</label>
                  <textarea 
                    placeholder="Try again! Remember that..." 
                    value={activeComponent.errorFeedback || ""}
                    onChange={(e) => updateActiveComponentProperty("errorFeedback", e.target.value)}
                    className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal min-h-[60px]" 
                  />
                </div>
                
                {activeComponent.type === 'MultipleChoice' && (
                  <div>
                    <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Correct Option</label>
                    <select
                      value={activeComponent.correctOptionId || activeComponent.options?.[0] || ""}
                      onChange={(e) => updateActiveComponentProperty("correctOptionId", e.target.value)}
                      className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal"
                    >
                      {activeComponent.options?.map((opt: string, optIdx: number) => (
                        <option key={optIdx} value={opt}>{opt || `Option ${optIdx + 1}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {activeComponent.type === 'FeynmanMirror' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Sample Model Answer</label>
                      <textarea 
                        placeholder="The ideal explanation..." 
                        value={activeComponent.sampleAnswer || ""}
                        onChange={(e) => updateActiveComponentProperty("sampleAnswer", e.target.value)}
                        className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal min-h-[100px]" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Max Dialog Rounds</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={activeComponent.maxRounds || 10}
                        onChange={(e) => updateActiveComponentProperty("maxRounds", parseInt(e.target.value))}
                        className="w-full bg-white/80 border border-brand-gray-200 rounded-lg p-2 text-sm outline-none focus:border-brand-teal"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-brand-gray-200">
                  <label className="block text-xs font-bold text-brand-gray-500 uppercase tracking-wider mb-2">Live Preview</label>
                  <div className="rounded-xl border border-brand-gray-200 bg-white p-4 shadow-inner min-h-[150px] flex items-center justify-center relative overflow-hidden">
                     {activeComponent.type === 'MultipleChoice' && (
                       <div className="w-full">
                         <p className="text-sm font-bold text-brand-gray-700 mb-3">{activeComponent.question || "Empty Question"}</p>
                         <div className="space-y-2">
                           {activeComponent.options?.map((opt: string, i: number) => (
                             <div key={i} className="px-3 py-2 border rounded-lg text-xs text-brand-gray-600 bg-gray-50">{opt || "Empty Option"}</div>
                           ))}
                         </div>
                       </div>
                     )}
                     {activeComponent.type === 'ExplainerMedia' && (
                       <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                         <FiVideo className="text-2xl mb-1 block mx-auto" /> Media Player Placeholder
                       </div>
                     )}
                     {false && (
                       <div className="w-full">
                         <p className="text-sm font-bold text-brand-gray-700 mb-3">{activeComponent.question || "Question Text"}</p>
                         <div className="h-8 border-b-2 border-brand-gray-300 w-full"></div>
                       </div>
                     )}
                     {['Ordering', 'MatchingPairs', 'FeynmanMirror'].includes(activeComponent.type) && (
                       <p className="text-sm text-brand-gray-600 italic">[{activeComponent.type} Preview Placeholder]</p>
                     )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-sm text-brand-gray-400">Select a component to inspect properties.</p>
              </div>
            )}
          </div>
        </DeepGlassCard>
      </div>
    </div>
  );
}
