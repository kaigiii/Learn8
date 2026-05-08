"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
  FiArrowRight, 
  FiArrowLeft, 
  FiSearch,
  FiZap,
  FiMenu,
  FiGrid,
  FiLayers,
  FiMessageSquare,
  FiBookOpen,
  FiCheckCircle,
  FiTrash2,
  FiFilter
} from "react-icons/fi";
import ArenaQuestionPreview from "./ArenaQuestionPreview";
import type { ArenaAdminSyllabusQuestion } from "@/lib/apiTypes";

interface ArenaPoolBuilderProps {
  availableQuestions: ArenaAdminSyllabusQuestion[];
  currentPoolItems: any[]; 
  onUpdatePool: (items: any[]) => void;
  isLoading?: boolean;
}

const QUESTION_TYPES = [
  { id: "all", label: "All Types", icon: <FiGrid /> },
  { id: "MultipleChoice", label: "Multiple Choice", icon: <FiMenu /> },
  { id: "MatchingPairs", label: "Matching", icon: <FiLayers /> },
  { id: "Ordering", label: "Ordering", icon: <FiLayers /> },
  { id: "FeynmanMirror", label: "Feynman", icon: <FiMessageSquare /> },
  { id: "ExplainerMedia", label: "Instructional", icon: <FiBookOpen /> },
];

export default function ArenaPoolBuilder({
  availableQuestions,
  currentPoolItems,
  onUpdatePool,
  isLoading = false,
}: ArenaPoolBuilderProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter available questions (Repository)
  const filteredAvailable = useMemo(() => {
    return availableQuestions.filter(q => {
      const matchesSearch = q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           q.nodeTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDifficulty = difficultyFilter === "all" || q.difficulty === difficultyFilter;
      const matchesType = typeFilter === "all" || q.questionType === typeFilter;
      
      // Hide what's already in the pool
      const alreadyInPool = currentPoolItems.some(item => item.questionKey === q.questionKey);
      
      return matchesSearch && matchesDifficulty && matchesType && !alreadyInPool;
    });
  }, [availableQuestions, searchQuery, difficultyFilter, typeFilter, currentPoolItems]);

  const handleAdd = (q: ArenaAdminSyllabusQuestion) => {
    const newItem = {
      questionKey: q.questionKey,
      questionType: q.questionType,
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.correctOptionId,
      difficulty: q.difficulty,
      knowledgeTags: [],
      knowledgeTagsText: "",
      explanation: q.explanation || "",
      sampleAnswer: (q as any).sampleAnswer,
      maxRounds: (q as any).maxRounds,
      sourceUnitId: q.unitId,
      sourceNodeId: q.nodeId,
      isActive: true,
    };
    onUpdatePool([...currentPoolItems, newItem]);
  };

  const handleRemove = (index: number) => {
    const next = [...currentPoolItems];
    next.splice(index, 1);
    onUpdatePool(next);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/60 bg-white/40 p-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3 pl-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-lg shadow-brand-teal/20">
            <FiFilter className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-gray-700">Builder Toolbox</h3>
            <p className="text-[10px] text-brand-gray-400">Manage your arena challenge set</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-400" />
            <input 
              type="text"
              placeholder="Search concepts..."
              className="h-10 w-48 rounded-2xl border border-white/70 bg-white/60 pl-9 pr-4 text-xs transition-all focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-teal/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            className="h-10 rounded-2xl border border-white/70 bg-white/60 px-3 text-xs focus:border-brand-teal focus:outline-none focus:ring-4 focus:ring-brand-teal/10"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {QUESTION_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          <select 
            className="h-10 rounded-2xl border border-white/70 bg-white/60 px-3 text-xs focus:border-brand-teal focus:outline-none focus:ring-4 focus:ring-brand-teal/10"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
          >
            <option value="all">Any Difficulty</option>
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="intermediate">Intermediate</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column: Repository (Syllabus) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <h4 className="font-heading text-lg font-bold text-brand-gray-700">Course Repository</h4>
              <span className="rounded-full bg-slate-200/50 px-2 py-0.5 text-[10px] font-bold text-brand-gray-500">
                {filteredAvailable.length} available
              </span>
            </div>
          </div>

          <div className="max-h-[650px] space-y-4 overflow-y-auto pr-3 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredAvailable.map((q) => (
                <motion.div
                  key={q.questionKey}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group relative"
                >
                  <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/50 p-5 transition-all hover:border-brand-teal/30 hover:bg-white/80 hover:shadow-[0_20px_40px_-12px_rgba(95,179,175,0.12)]">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400 truncate">
                            {q.unitTitle} &middot; {q.nodeTitle}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleAdd(q)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-white shadow-lg shadow-brand-teal/20 transition-all hover:scale-110 active:scale-95"
                          title="Move to Pool"
                        >
                          <FiArrowRight strokeWidth={3} />
                        </button>
                      </div>
                      <ArenaQuestionPreview 
                        prompt={q.prompt} 
                        questionType={q.questionType}
                        options={q.options} 
                        correctOptionId={q.correctOptionId}
                        difficulty={q.difficulty}
                      />
                  </div>
                </motion.div>
              ))}
              {filteredAvailable.length === 0 && (
                <div className="flex h-48 flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-brand-gray-200 bg-white/20 p-8 text-center text-sm text-brand-gray-400">
                  <FiSearch className="mb-3 h-8 w-8 opacity-20" />
                  <p className="font-medium">No matches found in your syllabus.</p>
                  <p className="text-[10px]">Try adjusting your search or filters.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Active Pool */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2">
              <h4 className="font-heading text-lg font-bold text-brand-teal">Match Pool</h4>
              <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                {currentPoolItems.length} active
              </span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400 flex items-center gap-1">
              <FiLayers className="h-3 w-3" />
              Stack View
            </div>
          </div>

          <div className="max-h-[650px] overflow-y-auto pr-3 custom-scrollbar">
            <Reorder.Group 
              axis="y" 
              values={currentPoolItems} 
              onReorder={onUpdatePool}
              className="space-y-4"
            >
              {currentPoolItems.map((item, index) => (
                <Reorder.Item
                  key={item.questionKey}
                  value={item}
                  className="group relative"
                >
                  <div className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-white/90 p-5 shadow-[0_8px_30px_rgba(95,179,175,0.04)] transition-all hover:border-brand-teal/40">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 cursor-grab items-center justify-center rounded-lg bg-brand-teal/5 text-xs font-black text-brand-teal active:cursor-grabbing">
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-300">Reorder</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleRemove(index)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-500 shadow-sm transition-all hover:bg-orange-100 hover:text-orange-600 active:scale-95"
                          title="Move back to Repository"
                        >
                          <FiArrowLeft strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                    
                    <ArenaQuestionPreview 
                      prompt={item.prompt} 
                      questionType={item.questionType}
                      options={item.options} 
                      correctOptionId={item.correctOptionId}
                      difficulty={item.difficulty}
                      isCompact
                    />
                  </div>
                </Reorder.Item>
              ))}
              {currentPoolItems.length === 0 && (
                <div className="flex h-48 flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-brand-teal/20 bg-brand-teal/5 p-8 text-center text-sm text-brand-teal/40">
                  <FiLayers className="mb-3 h-8 w-8 opacity-20" />
                  <p className="font-medium">The match pool is empty.</p>
                  <p className="text-[10px]">Add some challenges from the left repository.</p>
                </div>
              )}
            </Reorder.Group>
          </div>
          

        </div>
      </div>
    </div>
  );
}
