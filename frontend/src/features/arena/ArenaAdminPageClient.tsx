"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiLayout,
  FiBookOpen,
  FiCalendar,
  FiActivity,
  FiSave,
  FiPlus,
  FiTrash2,
  FiArrowRight,
  FiSearch,
  FiTerminal,
  FiVolume2
} from "react-icons/fi";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  fetchArenaAdminMatchReviews,
  fetchArenaAdminPlayerMatches,
  fetchArenaAdminHealthSnapshot,
  createArenaAdminQuestionPool,
  createArenaAdminSeason,
  fetchArenaAdminPublicCourses,
  fetchArenaAdminQuestionPools,
  fetchArenaAdminSeasons,
  updateArenaAdminQuestionPool,
  deleteArenaAdminQuestionPool,
  updateArenaAdminSeason,
  fetchArenaAdminAvailableQuestions,
} from "@/lib/arena/api";
import { ApiError, resolveErrorMessage, apiFetch } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type {
  ArenaAdminHealthSnapshot,
  ArenaAdminMatchReview,
  ArenaAdminPlayerMatchRecord,
  ArenaAdminPublicCourse,
  ArenaAdminQuestionPool,
  ArenaAdminQuestionPoolItemUpsertRequest,
  ArenaAdminQuestionPoolUpsertRequest,
  ArenaAdminSeason,
  ArenaAdminSeasonUpsertRequest,
  ArenaAdminSyllabusQuestion,
} from "@/lib/apiTypes";
import ArenaPoolBuilder from "./components/ArenaPoolBuilder";

/* ═══════════════════ Types ═══════════════════ */

// Course editing removed - YAML only

type PoolOptionFormState = {
  id: string;
  text: string;
};

type PoolItemFormState = {
  questionKey: string;
  questionType: string;
  prompt: string;
  correctOptionId?: string;
  difficulty: string;
  knowledgeTagsText: string;
  explanation: string;
  sourceUnitId: string;
  sourceNodeId: string;
  isActive: boolean;
  options: any[];
};

type PoolFormState = {
  publicCourseId: number | null;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  version: number;
  items: PoolItemFormState[];
};

type SeasonFormState = {
  name: string;
  status: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string;
  leaderboardConfigText: string;
  rewardConfigText: string;
};

/* ═══════════════════ Constants ═══════════════════ */

// EMPTY_COURSE_FORM removed

const EMPTY_POOL_FORM: PoolFormState = {
  publicCourseId: null,
  slug: "",
  title: "",
  description: "",
  isActive: true,
  version: 1,
  items: [],
};

const EMPTY_SEASON_FORM: SeasonFormState = {
  name: "",
  status: "upcoming",
  isActive: false,
  startedAt: "",
  endedAt: "",
  leaderboardConfigText: "{\n  \"type\": \"global\"\n}",
  rewardConfigText: "{}",
};

/* ═══════════════════ Main Component ═══════════════════ */

export default function ArenaAdminPageClient() {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const [courses, setCourses] = useState<ArenaAdminPublicCourse[]>([]);
  const [pools, setPools] = useState<ArenaAdminQuestionPool[]>([]);
  const [seasons, setSeasons] = useState<ArenaAdminSeason[]>([]);
  const [playerMatches, setPlayerMatches] = useState<ArenaAdminPlayerMatchRecord[]>([]);
  const [matchReviews, setMatchReviews] = useState<ArenaAdminMatchReview[]>([]);
  const [healthSnapshot, setHealthSnapshot] = useState<ArenaAdminHealthSnapshot | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [poolForm, setPoolForm] = useState<PoolFormState>(EMPTY_POOL_FORM);
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(EMPTY_SEASON_FORM);
  const [loading, setLoading] = useState(true);
  const [savingPool, setSavingPool] = useState(false);
  const [poolToDeleteId, setPoolToDeleteId] = useState<number | null>(null);
  const [savingSeason, setSavingSeason] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [playerMatchSearch, setPlayerMatchSearch] = useState("");

  // UI Tabs State
  const [activeTab, setActiveTab] = useState<"builder" | "topics" | "seasons" | "operations" | "voice">("builder");
  const [availableQuestions, setAvailableQuestions] = useState<ArenaAdminSyllabusQuestion[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setAccessDenied(false);

    void (async () => {
      try {
        const [
          nextCourses,
          nextPools,
          nextSeasons,
          nextPlayerMatches,
          nextMatchReviews,
          nextHealthSnapshot,
        ] = await Promise.all([
          fetchArenaAdminPublicCourses(),
          fetchArenaAdminQuestionPools(),
          fetchArenaAdminSeasons(),
          fetchArenaAdminPlayerMatches(undefined, 12),
          fetchArenaAdminMatchReviews(12),
          fetchArenaAdminHealthSnapshot(),
        ]);

        if (cancelled) return;

        setCourses(nextCourses);
        setPools(nextPools);
        setSeasons(nextSeasons);
        setPlayerMatches(nextPlayerMatches);
        setMatchReviews(nextMatchReviews);
        setHealthSnapshot(nextHealthSnapshot);
        setSelectedCourseId((current) => current ?? nextCourses[0]?.id ?? null);
        setSelectedSeasonId((current) => current ?? nextSeasons[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
          setError("This account is signed in, but it does not have Arena admin access. Redirecting...");
          setTimeout(() => {
            router.push("/home");
          }, 3000);
        } else {
          setError(resolveErrorMessage(err, "Unable to load Arena admin right now."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  // Sync Syllabus Questions
  useEffect(() => {
    if (!selectedCourseId) {
      setAvailableQuestions([]);
      return;
    }

    void (async () => {
      setLoadingAvailable(true);
      try {
        const next = await fetchArenaAdminAvailableQuestions(selectedCourseId);
        setAvailableQuestions(next);
      } catch (err) {
        console.error("Failed to fetch available questions:", err);
      } finally {
        setLoadingAvailable(false);
      }
    })();
  }, [selectedCourseId]);

  const filteredPools = useMemo(() => {
    if (!selectedCourseId) return pools;
    return pools.filter((pool) => pool.publicCourseId === selectedCourseId);
  }, [pools, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [pools, selectedPoolId]
  );

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId) ?? null,
    [seasons, selectedSeasonId]
  );

  // Sync Forms with Selections
  // Course form sync removed

  useEffect(() => {
    if (!selectedPool) {
      setPoolForm({
        ...EMPTY_POOL_FORM,
        publicCourseId: selectedCourseId,
        items: [],
      });
      return;
    }
    setPoolForm({
      publicCourseId: selectedPool.publicCourseId,
      slug: selectedPool.slug,
      title: selectedPool.title,
      description: selectedPool.description ?? "",
      isActive: selectedPool.isActive,
      version: selectedPool.version,
      items: selectedPool.items.map((item) => ({
        questionKey: item.questionKey,
        questionType: item.questionType,
        prompt: item.prompt,
        correctOptionId: item.correctOptionId,
        difficulty: item.difficulty,
        knowledgeTagsText: item.knowledgeTags.join(", "),
        explanation: item.explanation ?? "",
        sourceUnitId: item.sourceUnitId ?? "",
        sourceNodeId: item.sourceNodeId ?? "",
        isActive: item.isActive,
        options: [...item.options],
      })),
    });
  }, [selectedCourseId, selectedPool]);

  useEffect(() => {
    if (!selectedSeason) {
      setSeasonForm(EMPTY_SEASON_FORM);
      return;
    }
    setSeasonForm({
      name: selectedSeason.name,
      status: selectedSeason.status,
      isActive: selectedSeason.isActive,
      startedAt: toDateTimeLocalValue(selectedSeason.startedAt),
      endedAt: toDateTimeLocalValue(selectedSeason.endedAt),
      leaderboardConfigText: JSON.stringify(selectedSeason.leaderboardConfig ?? {}, null, 2),
      rewardConfigText: JSON.stringify(selectedSeason.rewardConfig ?? {}, null, 2),
    });
  }, [selectedSeason]);

  // Handlers
  const handleNewPool = () => {
    setSelectedPoolId(null);
    setPoolForm({
      ...EMPTY_POOL_FORM,
      publicCourseId: selectedCourseId,
      items: [],
    });
    setNotice("Creating a new question pool.");
    setError(null);
  };

  const handleNewSeason = () => {
    setSelectedSeasonId(null);
    setSeasonForm(EMPTY_SEASON_FORM);
    setNotice("Creating a new Arena season.");
    setError(null);
    setActiveTab("seasons");
  };



  const handleSavePool = async () => {
    setSavingPool(true);
    setError(null);
    try {
      const resolvedId = poolForm.publicCourseId || selectedCourseId;
      if (!resolvedId) throw new Error("Please select a topic first.");
      const payload: ArenaAdminQuestionPoolUpsertRequest = {
        publicCourseId: resolvedId,
        slug: poolForm.slug.trim(),
        title: poolForm.title.trim(),
        description: poolForm.description.trim() || null,
        isActive: poolForm.isActive,
        version: poolForm.version,
        items: poolForm.items.map((item, idx) => serializePoolItem(item, idx)),
      };
      const saved = selectedPool
        ? await updateArenaAdminQuestionPool(selectedPool.id, payload)
        : await createArenaAdminQuestionPool(payload);
      setPools(current => upsertById(current, saved));
      setSelectedPoolId(saved.id);
      setNotice("Pool saved successfully.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to save pool."));
    } finally {
      setSavingPool(false);
    }
  };

  const handleDeletePool = async () => {
    if (!poolToDeleteId) return;
    setSavingPool(true);
    setError(null);
    try {
      await deleteArenaAdminQuestionPool(poolToDeleteId);
      setPools(current => current.filter(p => p.id !== poolToDeleteId));
      if (selectedPoolId === poolToDeleteId) {
        setSelectedPoolId(null);
      }
      setNotice("Pool deleted successfully.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to delete pool."));
    } finally {
      setSavingPool(false);
      setPoolToDeleteId(null);
    }
  };

  const handleSaveSeason = async () => {
    setSavingSeason(true);
    setError(null);
    try {
      const payload: ArenaAdminSeasonUpsertRequest = {
        name: seasonForm.name.trim(),
        status: seasonForm.status.trim() || "upcoming",
        isActive: seasonForm.isActive,
        startedAt: seasonForm.startedAt ? new Date(seasonForm.startedAt).toISOString() : null,
        endedAt: seasonForm.endedAt ? new Date(seasonForm.endedAt).toISOString() : null,
        leaderboardConfig: JSON.parse(seasonForm.leaderboardConfigText || "{}"),
        rewardConfig: JSON.parse(seasonForm.rewardConfigText || "{}"),
      };
      const saved = selectedSeason
        ? await updateArenaAdminSeason(selectedSeason.id, payload)
        : await createArenaAdminSeason(payload);
      setSeasons(current => upsertById(current, saved));
      setSelectedSeasonId(saved.id);
      setNotice("Season saved successfully.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to save season."));
    } finally {
      setSavingSeason(false);
    }
  };

  const handleRefreshOps = async () => {
    setLoadingOps(true);
    try {
      const [nextPlayerMatches, nextMatchReviews, nextHealthSnapshot] = await Promise.all([
        fetchArenaAdminPlayerMatches(playerMatchSearch || undefined, 12),
        fetchArenaAdminMatchReviews(12),
        fetchArenaAdminHealthSnapshot(),
      ]);
      setPlayerMatches(nextPlayerMatches);
      setMatchReviews(nextMatchReviews);
      setHealthSnapshot(nextHealthSnapshot);
      setNotice("Operations data refreshed.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to refresh operations data."));
    } finally {
      setLoadingOps(false);
    }
  };

  const handleBatchPregenerate = async () => {
    try {
      setLoadingOps(true);
      const res = await apiFetch<{ status: string; message: string }>("/audio/batch-pregenerate", { method: "POST" });
      setNotice(res.message || "Batch pre-generation started successfully.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to start batch pre-generation."));
    } finally {
      setLoadingOps(false);
    }
  };

  const handleClearAudioCache = async () => {
    try {
      setLoadingOps(true);
      const res = await apiFetch<{ status: string; message: string }>("/audio/clear-cache", { method: "POST" });
      setNotice(res.message || "Cache cleared successfully.");
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to clear audio cache."));
    } finally {
      setLoadingOps(false);
    }
  };

  if (!isReady) return null;

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Admin"
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
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">

        {/* Header Dashboard Card */}
        <DeepGlassCard className="relative overflow-hidden px-6 py-6 transition-all md:px-8 md:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="z-10">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-teal">
                  Content Management
                </p>
                {loading && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="h-3 w-3 border-2 border-brand-teal border-t-transparent rounded-full" />
                )}
              </div>
              <h1 className="mt-2 font-heading text-4xl font-extrabold text-brand-gray-700">
                Admin <span className="text-brand-teal">Console</span>
              </h1>
            </div>

            <div className="z-10 flex flex-wrap gap-2">
              <NavButton active={activeTab === "builder"} onClick={() => setActiveTab("builder")} icon={<FiLayout />} label="Arena Builder" />
              <NavButton active={activeTab === "seasons"} onClick={() => setActiveTab("seasons")} icon={<FiCalendar />} label="Seasons" />
              <NavButton active={activeTab === "operations"} onClick={() => setActiveTab("operations")} icon={<FiActivity />} label="Operations" />
              <NavButton active={activeTab === "voice"} onClick={() => setActiveTab("voice")} icon={<FiVolume2 />} label="Voice Assistant" />
              <Link href="/admin/course-reviews" className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold bg-white/60 text-brand-gray-500 hover:bg-white/80 hover:text-brand-teal hover:scale-105 transition-all">
                <span className="text-brand-teal"><FiBookOpen /></span>
                Course Reviews
              </Link>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden">
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              </motion.div>
            )}
            {notice && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
                  {notice}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DeepGlassCard>

        {accessDenied && (
          <DeepGlassCard className="p-6 text-sm text-brand-gray-600 flex items-center gap-3">
            <FiTerminal className="text-rose-500 shrink-0" />
            Backend access denied. Grant Arena admin permissions on the API side, then reload this page.
          </DeepGlassCard>
        )}

        {!accessDenied && (
          <div className="relative">
            {activeTab === "builder" && (
              <motion.div key="builder" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 xl:grid-cols-[300px_1fr]">

                {/* Left Sidebar Menu */}
                <DeepGlassCard className="p-5 flex flex-col max-h-[85vh]">
                  <h2 className="font-heading text-lg font-bold text-brand-gray-700 mb-4">Content Directory</h2>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {courses.map(course => {
                      const coursePools = pools.filter(p => p.publicCourseId === course.id);
                      return (
                        <div key={course.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-gray-400 truncate pr-2" title={course.title}>
                              {course.title}
                            </p>
                            <button
                              onClick={() => {
                                setSelectedCourseId(course.id);
                                handleNewPool();
                              }}
                              className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-teal/10 text-brand-teal hover:bg-brand-teal hover:text-white transition-colors"
                              title="New Pool for this Topc"
                            >
                              <FiPlus size={12} strokeWidth={3} />
                            </button>
                          </div>
                          <div className="space-y-1">
                            {coursePools.length === 0 ? (
                              <p className="text-[10px] text-brand-gray-300 italic px-2">No active pools.</p>
                            ) : (
                              coursePools.map(pool => (
                                <button
                                  key={pool.id}
                                  onClick={() => {
                                    setSelectedCourseId(course.id);
                                    setSelectedPoolId(pool.id);
                                  }}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${selectedPoolId === pool.id ? "bg-brand-teal/15 text-brand-teal shadow-sm border border-brand-teal/20" : "text-brand-gray-600 hover:bg-white/60 border border-transparent"}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{pool.title}</span>
                                    {!pool.isActive && <span className="w-2 h-2 rounded-full bg-brand-gray-300"></span>}
                                    {pool.isActive && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DeepGlassCard>

                {/* Right Workspace Panel */}
                <DeepGlassCard className="p-6 flex flex-col">
                  {(!selectedCourseId && !selectedPoolId) ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-brand-gray-400">
                      <FiLayout className="w-16 h-16 mb-6 opacity-20" />
                      <h3 className="font-heading text-xl font-bold text-brand-gray-600 mb-2">Select a Topic or Pool</h3>
                      <p className="text-sm max-w-sm">Use the left sidebar to select an existing question pool, or create a fresh one to start dragging questions in.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h2 className="font-heading text-xl font-bold text-brand-gray-700">
                            {selectedPool ? `Editing Pool: ${selectedPool.title}` : (selectedCourseId ? `Topic: ${selectedCourse?.title}` : "New Question Pool")}
                          </h2>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-brand-gray-500">
                              Manage question pools for this topic.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-5 mb-8 bg-white/50 backdrop-blur-md p-6 rounded-[2rem] border border-brand-teal/20 shadow-[0_8px_30px_rgba(95,179,175,0.06)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-teal/40"></div>

                        <div className="w-full">
                          <Field label="Pool Title" hint="This defines the public name displayed to players.">
                            <input
                              className={`${inputClassName} text-base py-3`}
                              value={poolForm.title}
                              onChange={e => {
                                const title = e.target.value;
                                const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                                setPoolForm(prev => ({ ...prev, title, slug }));
                              }}
                              placeholder="E.g. The Ultimate Python Fundamentals"
                            />
                          </Field>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-5 border-t border-brand-teal/10">
                          <div>
                            <ToggleRow label="Enable Pool" checked={poolForm.isActive} onChange={checked => setPoolForm(prev => ({ ...prev, isActive: checked }))} />
                          </div>
                          <div className="flex gap-3">
                            {selectedPoolId && (
                              <button onClick={() => setPoolToDeleteId(selectedPoolId)} disabled={savingPool} title="Delete Pool" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white/80 px-6 py-3 text-sm font-bold text-rose-500 transition hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 shadow-sm">
                                <FiTrash2 /> Delete
                              </button>
                            )}
                            <GameButton onClick={() => void handleSavePool()} disabled={savingPool || !selectedCourseId} className="min-w-[160px] shadow-lg shadow-brand-teal/20">
                              {savingPool ? "Saving..." : <span className="flex items-center gap-2 font-bold text-sm"><FiSave /> Save Changes</span>}
                            </GameButton>
                          </div>
                        </div>
                      </div>

                      <ArenaPoolBuilder availableQuestions={availableQuestions} currentPoolItems={poolForm.items} onUpdatePool={(items) => setPoolForm(prev => ({ ...prev, items }))} isLoading={loadingAvailable} />
                    </>
                  )}
                </DeepGlassCard>
              </motion.div>
            )}

            {activeTab === "seasons" && (
              <motion.div key="seasons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <DeepGlassCard className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Seasons</h2>
                    <button onClick={handleNewSeason} className="rounded-full bg-brand-teal p-2 text-white hover:scale-110 transition shadow-md"><FiPlus /></button>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                    {seasons.map(s => (
                      <button key={s.id} onClick={() => setSelectedSeasonId(s.id)} className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${s.id === selectedSeasonId ? "border-brand-teal/45 bg-brand-teal/10 shadow-lg" : "border-white/70 bg-white/68"}`}>
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-bold text-brand-gray-700">{s.name}</p>
                          <StatusChip label={s.isActive ? "Active" : s.status} tone={s.isActive ? "success" : "neutral"} />
                        </div>
                        <p className="text-[10px] text-brand-teal font-bold uppercase mt-1">
                          {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "TBD"} &mdash; {s.endedAt ? new Date(s.endedAt).toLocaleDateString() : "TBD"}
                        </p>
                      </button>
                    ))}
                  </div>
                </DeepGlassCard>
                <DeepGlassCard className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-heading text-xl font-bold text-brand-gray-700">Config</h3>
                    <GameButton onClick={() => void handleSaveSeason()} disabled={savingSeason}>{savingSeason ? "..." : <FiSave />}</GameButton>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Name"><input className={inputClassName} value={seasonForm.name} onChange={e => setSeasonForm(s => ({ ...s, name: e.target.value }))} /></Field>
                      <Field label="Status"><input className={inputClassName} value={seasonForm.status} onChange={e => setSeasonForm(s => ({ ...s, status: e.target.value }))} /></Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Start"><input type="datetime-local" className={inputClassName} value={seasonForm.startedAt} onChange={e => setSeasonForm(s => ({ ...s, startedAt: e.target.value }))} /></Field>
                      <Field label="End"><input type="datetime-local" className={inputClassName} value={seasonForm.endedAt} onChange={e => setSeasonForm(s => ({ ...s, endedAt: e.target.value }))} /></Field>
                    </div>
                    <ToggleRow label="Is Active" checked={seasonForm.isActive} onChange={checked => setSeasonForm(s => ({ ...s, isActive: checked }))} />
                    <Field label="Leaderboard Config JSON"><textarea className={`${inputClassName} font-mono text-xs min-h-[100px]`} value={seasonForm.leaderboardConfigText} onChange={e => setSeasonForm(s => ({ ...s, leaderboardConfigText: e.target.value }))} /></Field>
                    <Field label="Reward Config JSON"><textarea className={`${inputClassName} font-mono text-xs min-h-[100px]`} value={seasonForm.rewardConfigText} onChange={e => setSeasonForm(s => ({ ...s, rewardConfigText: e.target.value }))} /></Field>
                  </div>
                </DeepGlassCard>
              </motion.div>
            )}

            {activeTab === "operations" && (
              <motion.div key="operations" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                <DeepGlassCard className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Arena Health</h2>
                    <InfoChip label={healthSnapshot ? new Date(healthSnapshot.generatedAt).toLocaleTimeString() : "No data"} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="Waiting Queue" value={String(healthSnapshot?.waitingQueueCount ?? 0)} />
                    <MetricCard label="Live Matches" value={String(healthSnapshot?.inProgressMatchCount ?? 0)} />
                    <MetricCard label="Abandonments" value={String(healthSnapshot?.abandonmentCount ?? 0)} />
                    <MetricCard label="Alert Flags" value={String(healthSnapshot?.alertFlags.length ?? 0)} />
                  </div>
                </DeepGlassCard>

                <DeepGlassCard className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Operations</h2>
                      <p className="mt-2 text-sm text-brand-gray-500">Match logs and anomaly review.</p>
                    </div>
                    <div className="flex gap-2">
                      <input className={inputClassName} value={playerMatchSearch} onChange={e => setPlayerMatchSearch(e.target.value)} placeholder="Search players..." />
                      <GameButton onClick={() => void handleRefreshOps()} disabled={loadingOps}>{loadingOps ? "Refreshing..." : "Refresh"}</GameButton>
                    </div>
                  </div>
                  <div className="grid gap-8 xl:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="font-heading font-bold text-brand-gray-700 text-lg border-b pb-2">Recent Player Activity</h3>
                      {playerMatches.map(r => (
                        <div key={`${r.matchId}-${r.userId}`} className="rounded-2xl border border-white/70 bg-white/68 p-4 hover:shadow-sm transition">
                          <p className="font-heading font-bold text-brand-gray-700">{r.displayName}</p>
                          <p className="text-[10px] text-brand-gray-500 uppercase tracking-wider font-bold">Match #{r.matchId} &bull; {r.publicCourseTitle}</p>
                          <p className="text-[10px] mt-1 text-brand-teal font-bold">{r.status.toUpperCase()} &bull; SCORE: {r.score}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-heading font-bold text-brand-gray-700 text-lg border-b pb-2">Match Review Alerts</h3>
                      {matchReviews.map(r => (
                        <div key={r.matchId} className="rounded-2xl border border-white/70 bg-white/68 p-4 hover:shadow-sm transition">
                          <div className="flex items-center justify-between">
                            <p className="font-heading font-bold text-brand-gray-700">Match #{r.matchId}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.anomalyFlags.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {r.anomalyFlags.length > 0 ? 'Flagged' : 'Healthy'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.anomalyFlags.map(f => <span key={f} className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold uppercase">{f.replaceAll('_', ' ')}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </DeepGlassCard>
              </motion.div>
            )}

            {activeTab === "voice" && (
              <motion.div key="voice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                <DeepGlassCard className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-5">
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-brand-gray-700">AI Voice Assistant Operations</h2>
                      <p className="mt-2 text-sm text-brand-gray-500">
                        補建歷史關卡導讀音檔與管理音檔快取
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/70 bg-white/68 p-4 hover:shadow-sm transition flex flex-col justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-brand-gray-700 text-base mb-1">批次補建歷史關卡音檔</h4>
                        <p className="text-xs text-brand-gray-500 mb-4 leading-relaxed">
                          掃描全站所有產出的單元節點，補齊尚未生成或快取的導讀語音音檔，給使用者最流暢的音訊體驗。
                        </p>
                      </div>
                      <GameButton onClick={() => void handleBatchPregenerate()} disabled={loadingOps} className="w-full">
                        {loadingOps ? "執行中..." : "開始批次補建"}
                      </GameButton>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/68 p-4 hover:shadow-sm transition flex flex-col justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-brand-gray-700 text-base mb-1">清除音檔快取目錄</h4>
                        <p className="text-xs text-brand-gray-500 mb-4 leading-relaxed">
                          清除 Learn8 本地所有快取的 `.wav` 音檔，這會強制微服務在下一次造訪該題目時重新生成最新的音訊。
                        </p>
                      </div>
                      <button onClick={() => void handleClearAudioCache()} disabled={loadingOps} className="w-full rounded-2xl bg-rose-50 border border-rose-200/60 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50">
                        {loadingOps ? "執行中..." : "清除音檔快取"}
                      </button>
                    </div>
                  </div>
                </DeepGlassCard>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Glass Confirmation Modal */}
      <AnimatePresence>
        {poolToDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-gray-900/30 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm rounded-[2.5rem] border border-rose-200/50 bg-white/90 backdrop-blur-xl p-8 shadow-[0_32px_80px_rgba(225,29,72,0.15)]"
            >
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-rose-100/50 to-transparent -z-10 rounded-t-[2.5rem]"></div>

              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-500 shadow-inner">
                <FiTrash2 className="h-7 w-7" />
              </div>

              <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-2">Delete this Pool?</h2>
              <p className="text-sm font-medium text-brand-gray-500 mb-8 leading-relaxed">
                This action is permanent and cannot be undone. Are you absolutely certain you want to destroy this question pool?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => void handleDeletePool()}
                  className="w-full rounded-2xl bg-rose-500 py-3.5 px-6 font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-600 active:scale-95"
                >
                  Yes, destroy it
                </button>
                <button
                  onClick={() => setPoolToDeleteId(null)}
                  className="w-full rounded-2xl bg-brand-gray-100 py-3.5 px-6 font-bold text-brand-gray-600 transition-all hover:bg-brand-gray-200 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Helper Components ═══════════════════ */

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${active ? "bg-brand-teal text-white shadow-xl shadow-brand-teal/20" : "bg-white/60 text-brand-gray-500 hover:bg-white/80 hover:text-brand-teal hover:scale-105"}`}>
      <span className={active ? "text-white" : "text-brand-teal"}>{icon}</span>
      {label}
    </button>
  );
}

function Field({ children, className = "", hint, label }: { children: React.ReactNode; className?: string; hint?: string; label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal">{label}</span>
      {hint && <p className="mt-1 text-xs text-brand-gray-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ToggleRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (n: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/75 bg-white/72 px-4 py-3 cursor-pointer hover:bg-white/90 transition">
      <span className="text-sm font-semibold text-brand-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-brand-teal cursor-pointer" />
    </label>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "success" | "info" | "neutral" }) {
  const cn = tone === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : tone === "info" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${cn}`}>{label}</span>;
}

function InfoChip({ label }: { label: string }) {
  return <span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal border border-brand-teal/10 shadow-sm">{label}</span>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/68 px-4 py-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}

/* ═══════════════════ Utility Helpers ═══════════════════ */

function serializePoolItem(item: PoolItemFormState, idx: number): ArenaAdminQuestionPoolItemUpsertRequest {
  if (!item.questionKey.trim()) throw new Error(`Q#${idx + 1} has no key.`);
  if (!item.prompt.trim()) throw new Error(`Q#${idx + 1} has no prompt.`);
  if (!item.questionType) throw new Error(`Q#${idx + 1} has no question type.`);
  return {
    questionKey: item.questionKey.trim(),
    questionType: item.questionType,
    prompt: item.prompt.trim(),
    options: item.options.map(o => {
      if (typeof o === "string") return o;
      // Preserve all keys (especially for MatchingPairs left/right/term/definition)
      if (o && typeof o === "object") {
        return { ...o };
      }
      return o;
    }),
    correctOptionId: item.correctOptionId ? item.correctOptionId.trim() : undefined,
    difficulty: item.difficulty || "normal",
    knowledgeTags: uniqueValues(splitCommaSeparated(item.knowledgeTagsText)),
    explanation: item.explanation ? item.explanation.trim() : null,
    sourceUnitId: item.sourceUnitId ? item.sourceUnitId.trim() : null,
    sourceNodeId: item.sourceNodeId ? item.sourceNodeId.trim() : null,
    isActive: Boolean(item.isActive),
  };
}

function toDateTimeLocalValue(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function splitCommaSeparated(v: string) { return v.split(",").map(p => p.trim()).filter(Boolean); }
function uniqueValues(v: string[]) { return Array.from(new Set(v)); }
function upsertById<T extends { id: number }>(items: T[], next: T) {
  const i = items.findIndex(x => x.id === next.id);
  if (i === -1) return [next, ...items];
  const n = [...items]; n[i] = next; return n;
}

const inputClassName = "w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10";
