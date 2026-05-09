"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiXCircle, FiLoader, FiGlobe, FiTag, FiSearch, FiEye, FiZap, FiTrash2 } from "react-icons/fi";
import { motion } from "framer-motion";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import { apiFetch } from "@/lib/apiClient";

export default function PublicCourseManagementTab() {
  const [publicCourses, setPublicCourses] = useState<any[]>([]);
  const [pendingCourses, setPendingCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [previewCourse, setPreviewCourse] = useState<any | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pubData, pendData] = await Promise.all([
        apiFetch<any[]>("/arena/admin/public-courses"),
        apiFetch<any[]>("/custom-courses/admin/pending")
      ]);
      setPublicCourses(pubData);
      setPendingCourses(pendData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (courseId: number) => {
    setExportingId(courseId);
    try {
      await apiFetch<any>(`/custom-courses/${courseId}/export-yaml`, {
        method: "POST"
      });
      fetchData();
    } catch (err) {
      alert("Failed to publish course");
    } finally {
      setExportingId(null);
    }
  };

  const toggleStatus = async (courseId: number, currentStatus: boolean) => {
    setUpdatingId(courseId);
    try {
      await apiFetch(`/arena/admin/public-courses/${courseId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !currentStatus })
      });
      fetchData();
    } catch (err) {
      alert("Failed to update course status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredPublic = publicCourses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.topic.toLowerCase().includes(search.toLowerCase())
  );

  const toggleNodeExpansion = (nodeId: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    setExpandedNodes(next);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <FiLoader className="w-10 h-10 animate-spin text-brand-teal" />
      </div>
    );
  }

  // Combine both lists into a unified catalog
  const unifiedCatalog = [
    ...pendingCourses.map(c => ({ ...c, type: 'pending' })),
    ...publicCourses.map(c => ({ ...c, type: 'public' }))
  ].filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    (c.topic && c.topic.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    // Sort: Pending first, then by title
    if (a.type === 'pending' && b.type !== 'pending') return -1;
    if (a.type !== 'pending' && b.type === 'pending') return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="flex flex-col gap-6"
    >
      <DeepGlassCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Unified Course Catalog</h2>
            <p className="mt-1 text-sm text-brand-gray-500 font-medium">Manage approvals, visibility, and catalog content in one place.</p>
          </div>
          
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-400 group-focus-within:text-brand-teal transition-colors" />
            <input 
              type="text" 
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-5 py-2.5 bg-white/60 border border-white/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:bg-white transition-all w-full md:w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {unifiedCatalog.length === 0 ? (
            <div className="text-center py-20 bg-white/40 rounded-[2.5rem] border border-dashed border-brand-teal/10">
              <p className="text-brand-gray-400 font-medium">No courses found in the catalog.</p>
            </div>
          ) : (
            unifiedCatalog.map(course => {
              const isPending = course.type === 'pending';
              const isOfficial = !isPending && !course.sourceCourseId;
              const isCustomPublished = !isPending && course.sourceCourseId;

              return (
                <DeepGlassCard key={`${course.type}-${course.id}`} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 border transition-all hover:shadow-md group ${
                  isPending ? 'border-amber-200 bg-amber-50/30' : 'border-white/45 bg-white/75'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-heading text-lg font-bold text-brand-gray-700 leading-tight">
                        {course.title}
                      </h3>
                      {isPending && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter border border-amber-200 animate-pulse">Pending Review</span>
                      )}
                      {isOfficial && (
                        <span className="bg-brand-teal/10 text-brand-teal text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter border border-brand-teal/20">Official</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-brand-gray-500 font-medium">
                        <FiTag className="text-brand-teal" /> {course.topic || 'General'}
                      </div>
                      {!isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-brand-gray-500 font-medium">
                          <FiGlobe className="text-brand-teal" /> {course.slug}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-0 flex-none flex items-center gap-6">
                    {/* LEFT: Visibility (Only for Published) */}
                    <div className="flex items-center">
                      {!isPending && (
                        <button 
                          onClick={() => toggleStatus(course.id, course.isPublished)} 
                          disabled={updatingId === course.id}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black tracking-widest transition-all border ${
                            course.isPublished 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" 
                              : "bg-brand-gray-50 text-brand-gray-400 border-brand-gray-200"
                          }`}
                        >
                          {course.isPublished ? <FiEye className="w-3.5 h-3.5" /> : <FiXCircle className="w-3.5 h-3.5" />}
                          {course.isPublished ? "VISIBLE" : "HIDDEN"}
                        </button>
                      )}
                    </div>

                    {/* RIGHT: Lifecycle Actions */}
                    <div className="flex items-center gap-3 pl-6 border-l border-brand-gray-100">
                      {isPending ? (
                        <>
                          <button 
                            onClick={() => {
                              setPreviewCourse(course);
                              setExpandedNodes(new Set());
                            }}
                            className="w-11 h-11 flex items-center justify-center text-brand-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-2xl transition-all border border-transparent hover:border-brand-teal/10"
                            title="Preview Content"
                          >
                            <FiSearch size={20} />
                          </button>
                          <button 
                            onClick={() => handlePublish(course.id)} 
                            disabled={exportingId === course.id}
                            className="px-6 py-3 bg-brand-teal text-white text-xs font-black tracking-widest rounded-2xl shadow-xl shadow-brand-teal/20 hover:bg-brand-teal/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                          >
                            {exportingId === course.id ? <FiLoader className="animate-spin" /> : <FiZap className="w-4 h-4" />}
                            APPROVE & PUBLISH
                          </button>
                        </>
                      ) : (
                        isCustomPublished && (
                          <button 
                            onClick={async () => {
                              if (!confirm("Unpublish this course? This will DELETE the YAML file and return it to the creator's drafts. It will no longer appear in this catalog.")) return;
                              setUpdatingId(course.id);
                              try {
                                await apiFetch(`/custom-courses/${course.sourceCourseId}`, {
                                  method: "PUT",
                                  body: JSON.stringify({ is_published: false })
                                });
                                fetchData();
                              } catch (err) {
                                alert("Failed to unpublish");
                              } finally {
                                setUpdatingId(null);
                              }
                            }}
                            disabled={updatingId === course.id}
                            className="px-6 py-3 bg-white text-rose-500 text-xs font-black tracking-widest rounded-2xl border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm flex items-center gap-2"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            UNPUBLISH
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </DeepGlassCard>
              );
            })
          )}
        </div>
      </DeepGlassCard>

      {/* Preview Modal (Copied from CourseReviewTab) */}
      {previewCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-gray-900/40 backdrop-blur-md p-4 overflow-hidden">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white/95 rounded-[3rem] border border-white/80 shadow-2xl overflow-hidden"
          >
            <div className="p-7 border-b border-brand-teal/10 flex items-center justify-between bg-white/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal">Admin Review Mode</span>
                </div>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 leading-none">{previewCourse.title}</h2>
              </div>
              <button 
                onClick={() => setPreviewCourse(null)}
                className="w-12 h-12 rounded-2xl bg-white border border-brand-gray-100 text-brand-gray-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
              >
                <span className="text-2xl font-light">&times;</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-brand-gray-50/20 custom-scrollbar">
              <div className="space-y-10">
                {previewCourse.syllabus_json?.units?.map((unit: any, uIdx: number) => (
                  <div key={unit.unitId || uIdx} className="space-y-5">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-[1.25rem] bg-brand-teal text-white flex items-center justify-center font-heading font-black text-lg shadow-xl shadow-brand-teal/20">
                        {uIdx + 1}
                      </div>
                      <div>
                        <h3 className="font-heading text-xl font-black text-brand-gray-700 leading-none mb-1.5">{unit.unitTitle}</h3>
                        <p className="text-sm text-brand-gray-400 font-medium">{unit.unitDescription}</p>
                      </div>
                    </div>

                    <div className="ml-6 pl-10 border-l-2 border-brand-teal/10 space-y-4">
                      {unit.nodes?.map((node: any, nIdx: number) => {
                        const isExpanded = expandedNodes.has(node.id);
                        return (
                          <div key={node.id || nIdx} className="space-y-3">
                            <div 
                              onClick={() => toggleNodeExpansion(node.id)}
                              className={`p-5 rounded-[1.75rem] border transition-all cursor-pointer flex items-center justify-between group ${isExpanded ? 'bg-white border-brand-teal/30 shadow-lg ring-4 ring-brand-teal/5' : 'bg-white/70 border-white/80 hover:border-brand-teal/40 hover:bg-white shadow-sm'}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full transition-all ${isExpanded ? 'bg-brand-teal scale-125' : 'bg-brand-gray-200'}`} />
                                <div>
                                  <h4 className={`font-heading text-base font-bold transition-colors ${isExpanded ? 'text-brand-teal' : 'text-brand-gray-700'}`}>{node.title}</h4>
                                  <p className="text-xs text-brand-gray-400 mt-0.5 font-medium">{node.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest transition-all ${isExpanded ? 'bg-brand-teal text-white' : 'bg-brand-gray-100 text-brand-gray-500 group-hover:bg-brand-teal/10 group-hover:text-brand-teal'}`}>
                                  {node.components?.length || 0} Elements
                                </span>
                              </div>
                            </div>

                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }} 
                                animate={{ opacity: 1, y: 0 }}
                                className="ml-4 space-y-3 pt-1 pb-4"
                              >
                                {node.components?.map((comp: any, cIdx: number) => (
                                  <div key={comp.id || cIdx} className="p-5 rounded-[1.5rem] bg-white/40 border border-white shadow-inner flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-white pb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-brand-gray-700 text-white flex items-center justify-center text-xs">
                                          {cIdx + 1}
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-brand-gray-500">{comp.type}</span>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      {comp.question && (
                                        <p className="text-sm font-bold text-brand-gray-700">Q: {comp.question}</p>
                                      )}
                                      {comp.type === 'ExplainerMedia' && (
                                        <div className="text-sm text-brand-gray-600 bg-white/50 p-3 rounded-xl border border-white italic">
                                          {comp.content || "Media explanation content..."}
                                        </div>
                                      )}
                                      {comp.type === 'MultipleChoice' && (
                                        <div className="grid gap-2 pl-2">
                                          {comp.options?.map((opt: string, oIdx: number) => (
                                            <div key={oIdx} className={`text-xs p-2 rounded-lg border flex items-center gap-2 ${opt === comp.correctOptionId ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-white/40 border-white/60 text-brand-gray-500'}`}>
                                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] ${opt === comp.correctOptionId ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-brand-gray-300'}`}>
                                                {opt === comp.correctOptionId && "✓"}
                                              </div>
                                              {opt}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {comp.type === 'FeynmanMirror' && (
                                        <div className="space-y-2 pl-2">
                                          <div className="text-[10px] uppercase font-black text-brand-gray-400">Sample Ideal Answer:</div>
                                          <div className="text-xs p-3 rounded-xl bg-sky-50/50 border border-sky-100 text-sky-700 italic">
                                            "{comp.sampleAnswer}"
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-brand-teal/10 bg-white/60 flex justify-end items-center gap-4">
              <button 
                onClick={() => setPreviewCourse(null)}
                className="px-7 py-3 text-sm font-bold text-brand-gray-500 hover:text-brand-gray-800 transition-colors"
              >
                Close Preview
              </button>
              {pendingCourses.some(p => p.id === previewCourse.id) && (
                <button 
                  onClick={() => {
                    const id = previewCourse.id;
                    setPreviewCourse(null);
                    handlePublish(id);
                  }}
                  className="px-10 py-3.5 bg-brand-teal text-white text-sm font-black rounded-2xl shadow-xl shadow-brand-teal/25 hover:bg-brand-teal/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Approve & Export Now
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
