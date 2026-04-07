"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  fetchArenaAdminMatchReviews,
  fetchArenaAdminPlayerMatches,
  fetchArenaAdminHealthSnapshot,
  createArenaAdminPublicCourse,
  createArenaAdminQuestionPool,
  createArenaAdminSeason,
  fetchArenaAdminPublicCourses,
  fetchArenaAdminQuestionPools,
  fetchArenaAdminSeasons,
  updateArenaAdminPublicCourse,
  updateArenaAdminQuestionPool,
  updateArenaAdminSeason,
} from "@/lib/arena/api";
import { ApiError } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type {
  ArenaAdminHealthSnapshot,
  ArenaAdminMatchReview,
  ArenaAdminPlayerMatchRecord,
  ArenaAdminPublicCourse,
  ArenaAdminPublicCourseUpsertRequest,
  ArenaAdminQuestionPool,
  ArenaAdminQuestionPoolItemUpsertRequest,
  ArenaAdminQuestionPoolUpsertRequest,
  ArenaAdminSeason,
  ArenaAdminSeasonUpsertRequest,
} from "@/lib/apiTypes";

type CourseFormState = {
  slug: string;
  title: string;
  topic: string;
  description: string;
  difficulty: string;
  tagsText: string;
  isPublished: boolean;
  isArenaEnabled: boolean;
};

type PoolOptionFormState = {
  id: string;
  text: string;
};

type PoolItemFormState = {
  questionKey: string;
  prompt: string;
  correctOptionId: string;
  difficulty: string;
  knowledgeTagsText: string;
  explanation: string;
  sourceUnitId: string;
  sourceNodeId: string;
  isActive: boolean;
  options: PoolOptionFormState[];
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

const EMPTY_COURSE_FORM: CourseFormState = {
  slug: "",
  title: "",
  topic: "",
  description: "",
  difficulty: "intermediate",
  tagsText: "",
  isPublished: false,
  isArenaEnabled: false,
};

const EMPTY_POOL_FORM: PoolFormState = {
  publicCourseId: null,
  slug: "",
  title: "",
  description: "",
  isActive: true,
  version: 1,
  items: [createEmptyPoolItem(1)],
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

export default function ArenaAdminPageClient() {
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
  const [courseForm, setCourseForm] = useState<CourseFormState>(EMPTY_COURSE_FORM);
  const [poolForm, setPoolForm] = useState<PoolFormState>(EMPTY_POOL_FORM);
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(EMPTY_SEASON_FORM);
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingPool, setSavingPool] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [playerMatchSearch, setPlayerMatchSearch] = useState("");

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
          setError("This account is signed in, but it does not have Arena admin access.");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load Arena admin.");
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

  const poolItemCount = poolForm.items.length;
  const totalOptionCount = poolForm.items.reduce((sum, item) => sum + item.options.length, 0);

  useEffect(() => {
    if (!selectedCourse) {
      setCourseForm(EMPTY_COURSE_FORM);
      return;
    }

    setCourseForm({
      slug: selectedCourse.slug,
      title: selectedCourse.title,
      topic: selectedCourse.topic,
      description: selectedCourse.description ?? "",
      difficulty: selectedCourse.difficulty,
      tagsText: selectedCourse.tags.join(", "),
      isPublished: selectedCourse.isPublished,
      isArenaEnabled: selectedCourse.isArenaEnabled,
    });
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedPool) {
      setPoolForm({
        ...EMPTY_POOL_FORM,
        publicCourseId: selectedCourseId,
        items: [createEmptyPoolItem(1)],
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
      items: selectedPool.items.map((item, index) => ({
        questionKey: item.questionKey,
        prompt: item.prompt,
        correctOptionId: item.correctOptionId,
        difficulty: item.difficulty,
        knowledgeTagsText: item.knowledgeTags.join(", "),
        explanation: item.explanation ?? "",
        sourceUnitId: item.sourceUnitId ?? "",
        sourceNodeId: item.sourceNodeId ?? "",
        isActive: item.isActive,
        options:
          item.options.length > 0
            ? item.options.map((option, optionIndex) => ({
                id: String(option.id ?? String.fromCharCode(97 + optionIndex)),
                text: String(option.text ?? ""),
              }))
            : createEmptyOptions(),
      })),
    });
  }, [selectedCourseId, selectedPool]);

  useEffect(() => {
    if (selectedPoolId && !filteredPools.some((pool) => pool.id === selectedPoolId)) {
      setSelectedPoolId(filteredPools[0]?.id ?? null);
    }
  }, [filteredPools, selectedPoolId]);

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

  const handleNewCourse = () => {
    setSelectedCourseId(null);
    setCourseForm(EMPTY_COURSE_FORM);
    setNotice("Creating a new official topic.");
    setError(null);
  };

  const handleNewPool = () => {
    setSelectedPoolId(null);
    setPoolForm({
      ...EMPTY_POOL_FORM,
      publicCourseId: selectedCourseId,
      items: [createEmptyPoolItem(1)],
    });
    setNotice("Creating a new question pool.");
    setError(null);
  };

  const handleNewSeason = () => {
    setSelectedSeasonId(null);
    setSeasonForm(EMPTY_SEASON_FORM);
    setNotice("Creating a new Arena season.");
    setError(null);
  };

  const handleSaveCourse = async () => {
    setSavingCourse(true);
    setError(null);
    setNotice(null);

    try {
      const payload: ArenaAdminPublicCourseUpsertRequest = {
        slug: courseForm.slug.trim(),
        title: courseForm.title.trim(),
        topic: courseForm.topic.trim(),
        description: courseForm.description.trim() || null,
        difficulty: courseForm.difficulty.trim() || "intermediate",
        isPublished: courseForm.isPublished,
        isArenaEnabled: courseForm.isArenaEnabled,
        tags: uniqueValues(splitCommaSeparated(courseForm.tagsText)),
      };

      validateCoursePayload(payload);

      const saved = selectedCourse
        ? await updateArenaAdminPublicCourse(selectedCourse.id, payload)
        : await createArenaAdminPublicCourse(payload);

      setCourses((current) => upsertById(current, saved));
      setSelectedCourseId(saved.id);
      setNotice(selectedCourse ? "Official topic updated." : "Official topic created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save official topic.");
    } finally {
      setSavingCourse(false);
    }
  };

  const handleSavePool = async () => {
    setSavingPool(true);
    setError(null);
    setNotice(null);

    try {
      const resolvedPublicCourseId = poolForm.publicCourseId ?? selectedCourseId;
      if (!resolvedPublicCourseId) {
        throw new Error("Select or create an official topic before saving a question pool.");
      }

      const payload: ArenaAdminQuestionPoolUpsertRequest = {
        publicCourseId: resolvedPublicCourseId,
        slug: poolForm.slug.trim(),
        title: poolForm.title.trim(),
        description: poolForm.description.trim() || null,
        isActive: poolForm.isActive,
        version: Math.max(1, Math.trunc(poolForm.version || 1)),
        items: poolForm.items.map((item, index) => serializePoolItem(item, index)),
      };

      validatePoolPayload(payload);

      const saved = selectedPool
        ? await updateArenaAdminQuestionPool(selectedPool.id, payload)
        : await createArenaAdminQuestionPool(payload);

      setPools((current) => upsertById(current, saved));
      setSelectedCourseId(saved.publicCourseId);
      setSelectedPoolId(saved.id);
      setNotice(selectedPool ? "Question pool updated." : "Question pool created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save question pool.");
    } finally {
      setSavingPool(false);
    }
  };

  const handleSaveSeason = async () => {
    setSavingSeason(true);
    setError(null);
    setNotice(null);

    try {
      const payload: ArenaAdminSeasonUpsertRequest = {
        name: seasonForm.name.trim(),
        status: seasonForm.status.trim() || "upcoming",
        isActive: seasonForm.isActive,
        startedAt: seasonForm.startedAt ? new Date(seasonForm.startedAt).toISOString() : null,
        endedAt: seasonForm.endedAt ? new Date(seasonForm.endedAt).toISOString() : null,
        leaderboardConfig: parseJsonConfig(
          seasonForm.leaderboardConfigText,
          "Leaderboard config"
        ),
        rewardConfig: parseJsonConfig(seasonForm.rewardConfigText, "Reward config"),
      };

      validateSeasonPayload(payload);

      const saved = selectedSeason
        ? await updateArenaAdminSeason(selectedSeason.id, payload)
        : await createArenaAdminSeason(payload);

      setSeasons((current) => upsertById(current, saved));
      setSelectedSeasonId(saved.id);
      setNotice(selectedSeason ? "Arena season updated." : "Arena season created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Arena season.");
    } finally {
      setSavingSeason(false);
    }
  };

  const setPoolItem = (
    itemIndex: number,
    updater: (current: PoolItemFormState) => PoolItemFormState
  ) => {
    setPoolForm((current) => ({
      ...current,
      items: current.items.map((item, index) => (index === itemIndex ? updater(item) : item)),
    }));
  };

  const addPoolItem = () => {
    setPoolForm((current) => ({
      ...current,
      items: [...current.items, createEmptyPoolItem(current.items.length + 1)],
    }));
  };

  const removePoolItem = (itemIndex: number) => {
    setPoolForm((current) => {
      if (current.items.length === 1) {
        return current;
      }
      return {
        ...current,
        items: current.items.filter((_, index) => index !== itemIndex),
      };
    });
  };

  const addOption = (itemIndex: number) => {
    setPoolItem(itemIndex, (item) => ({
      ...item,
      options: [...item.options, createEmptyOption(item.options.length)],
    }));
  };

  const removeOption = (itemIndex: number, optionIndex: number) => {
    setPoolItem(itemIndex, (item) => {
      if (item.options.length === 1) {
        return item;
      }

      const nextOptions = item.options.filter((_, index) => index !== optionIndex);
      const hasSelectedCorrect = nextOptions.some(
        (option) => option.id.trim() === item.correctOptionId.trim()
      );

      return {
        ...item,
        options: nextOptions,
        correctOptionId: hasSelectedCorrect ? item.correctOptionId : nextOptions[0]?.id ?? "",
      };
    });
  };

  const poolPreview = useMemo(() => {
    try {
      const items = poolForm.items.map((item, index) => serializePoolItem(item, index));
      return JSON.stringify(items, null, 2);
    } catch {
      return "Pool preview becomes available after required question fields are filled.";
    }
  }, [poolForm.items]);

  const handleRefreshOps = async () => {
    setLoadingOps(true);
    setError(null);

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
      setError(err instanceof Error ? err.message : "Failed to load Arena operations data.");
    } finally {
      setLoadingOps(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <TopStatsBar backHref="/home" pageTitle="Arena Admin" />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="overflow-hidden px-6 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-teal">
                Internal Operations
              </p>
              <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-gray-700">
                Arena content admin
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-gray-500 md:text-base">
                Manage official topics and the question pools that power multiplayer Arena rooms.
                This console now supports structured question editing, so content ops can manage
                real pools without hand-writing JSON.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/home"
                className="rounded-2xl border border-white/70 bg-white/65 px-4 py-3 text-sm font-semibold text-brand-gray-700 transition hover:bg-white/80"
              >
                Open Home
              </Link>
              <button
                type="button"
                onClick={handleNewCourse}
                className="rounded-2xl border border-brand-teal/25 bg-brand-teal/10 px-4 py-3 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/15"
              >
                New topic
              </button>
              <button
                type="button"
                onClick={handleNewPool}
                className="rounded-2xl border border-brand-teal/25 bg-brand-teal/10 px-4 py-3 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/15"
              >
                New pool
              </button>
              <button
                type="button"
                onClick={handleNewSeason}
                className="rounded-2xl border border-brand-teal/25 bg-brand-teal/10 px-4 py-3 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/15"
              >
                New season
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}
        </DeepGlassCard>

        {accessDenied ? (
          <DeepGlassCard className="px-6 py-6 text-sm text-brand-gray-600">
            Backend auth is working and denied this account. Grant Arena admin permissions on the
            API side, then reload this page.
          </DeepGlassCard>
        ) : null}

        {!accessDenied ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <DeepGlassCard className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
                    Official topics
                  </h2>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    Choose the public course metadata exposed to Arena.
                  </p>
                </div>
                <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                  {courses.length} total
                </span>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
                  {courses.map((course) => {
                    const active = course.id === selectedCourseId;
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setSelectedPoolId(null);
                          setError(null);
                          setNotice(null);
                        }}
                        className={`w-full rounded-[26px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-brand-teal/45 bg-brand-teal/10 shadow-[0_16px_30px_rgba(95,179,175,0.16)]"
                            : "border-white/70 bg-white/68"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-xl font-bold text-brand-gray-700">
                            {course.title}
                          </p>
                          <StatusChip
                            label={course.isPublished ? "Published" : "Draft"}
                            tone={course.isPublished ? "success" : "neutral"}
                          />
                          <StatusChip
                            label={course.isArenaEnabled ? "Arena On" : "Arena Off"}
                            tone={course.isArenaEnabled ? "info" : "neutral"}
                          />
                        </div>
                        <p className="mt-2 text-sm text-brand-gray-500">
                          {course.description || course.topic}
                        </p>
                      </button>
                    );
                  })}
                  {courses.length === 0 && !loading ? (
                    <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                      No official topics yet. Create the first one from this panel.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Slug">
                      <input
                        className={inputClassName}
                        value={courseForm.slug}
                        onChange={(event) =>
                          setCourseForm((current) => ({ ...current, slug: event.target.value }))
                        }
                        placeholder="intro-to-calculus"
                      />
                    </Field>
                    <Field label="Difficulty">
                      <input
                        className={inputClassName}
                        value={courseForm.difficulty}
                        onChange={(event) =>
                          setCourseForm((current) => ({
                            ...current,
                            difficulty: event.target.value,
                          }))
                        }
                        placeholder="intermediate"
                      />
                    </Field>
                  </div>

                  <Field className="mt-4" label="Title">
                    <input
                      className={inputClassName}
                      value={courseForm.title}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Calculus Sprint"
                    />
                  </Field>

                  <Field className="mt-4" label="Topic">
                    <input
                      className={inputClassName}
                      value={courseForm.topic}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, topic: event.target.value }))
                      }
                      placeholder="Derivatives and limits"
                    />
                  </Field>

                  <Field className="mt-4" label="Description">
                    <textarea
                      className={`${inputClassName} min-h-[96px] resize-y`}
                      value={courseForm.description}
                      onChange={(event) =>
                        setCourseForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Short summary for the official Arena topic."
                    />
                  </Field>

                  <Field className="mt-4" label="Tags">
                    <input
                      className={inputClassName}
                      value={courseForm.tagsText}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, tagsText: event.target.value }))
                      }
                      placeholder="limits, derivatives, speed"
                    />
                  </Field>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ToggleRow
                      label="Published"
                      checked={courseForm.isPublished}
                      onChange={(checked) =>
                        setCourseForm((current) => ({ ...current, isPublished: checked }))
                      }
                    />
                    <ToggleRow
                      label="Arena enabled"
                      checked={courseForm.isArenaEnabled}
                      onChange={(checked) =>
                        setCourseForm((current) => ({ ...current, isArenaEnabled: checked }))
                      }
                    />
                  </div>

                  <GameButton
                    className="mt-5 w-full"
                    onClick={() => void handleSaveCourse()}
                    disabled={loading || savingCourse}
                  >
                    {savingCourse
                      ? "Saving topic..."
                      : selectedCourse
                        ? "Update topic"
                        : "Create topic"}
                  </GameButton>
                </div>
              </div>
              </DeepGlassCard>

              <DeepGlassCard className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
                    Question pools
                  </h2>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    Manage the question set consumed by Arena rooms for each official topic.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InfoChip label={`${filteredPools.length} pools`} />
                  <InfoChip label={`${poolItemCount} questions`} />
                  <InfoChip label={`${totalOptionCount} options`} />
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-[26px] border border-white/70 bg-white/68 p-4">
                  <Field label="Pool topic binding">
                    <select
                      className={inputClassName}
                      value={poolForm.publicCourseId ?? ""}
                      onChange={(event) =>
                        setPoolForm((current) => ({
                          ...current,
                          publicCourseId: Number(event.target.value),
                        }))
                      }
                    >
                      <option value="" disabled>
                        Select official topic
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="max-h-[240px] space-y-3 overflow-y-auto pr-1">
                  {filteredPools.map((pool) => {
                    const active = pool.id === selectedPoolId;
                    return (
                      <button
                        key={pool.id}
                        type="button"
                        onClick={() => {
                          setSelectedPoolId(pool.id);
                          setError(null);
                          setNotice(null);
                        }}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-brand-teal/45 bg-brand-teal/10 shadow-[0_16px_30px_rgba(95,179,175,0.16)]"
                            : "border-white/70 bg-white/68"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-heading text-lg font-bold text-brand-gray-700">
                              {pool.title}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-teal">
                              v{pool.version} • {pool.items.length} items
                            </p>
                          </div>
                          <StatusChip
                            label={pool.isActive ? "Active" : "Inactive"}
                            tone={pool.isActive ? "success" : "neutral"}
                          />
                        </div>
                      </button>
                    );
                  })}
                  {filteredPools.length === 0 && !loading ? (
                    <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                      No pools found for the current topic yet.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_140px]">
                    <Field label="Slug">
                      <input
                        className={inputClassName}
                        value={poolForm.slug}
                        onChange={(event) =>
                          setPoolForm((current) => ({ ...current, slug: event.target.value }))
                        }
                        placeholder="calculus-sprint-v1"
                      />
                    </Field>
                    <Field label="Title">
                      <input
                        className={inputClassName}
                        value={poolForm.title}
                        onChange={(event) =>
                          setPoolForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Calculus Sprint Pool"
                      />
                    </Field>
                    <Field label="Version">
                      <input
                        className={inputClassName}
                        type="number"
                        min={1}
                        value={poolForm.version}
                        onChange={(event) =>
                          setPoolForm((current) => ({
                            ...current,
                            version: Number(event.target.value) || 1,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <Field className="mt-4" label="Description">
                    <textarea
                      className={`${inputClassName} min-h-[82px] resize-y`}
                      value={poolForm.description}
                      onChange={(event) =>
                        setPoolForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="What this pool is for, release notes, or scope."
                    />
                  </Field>

                  <div className="mt-4">
                    <ToggleRow
                      label="Pool active"
                      checked={poolForm.isActive}
                      onChange={(checked) =>
                        setPoolForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">
                        Questions
                      </p>
                      <p className="mt-1 text-sm text-brand-gray-500">
                        Add, reorder mentally, and edit each Arena question directly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addPoolItem}
                      className="rounded-2xl border border-brand-teal/25 bg-brand-teal/10 px-4 py-2 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/15"
                    >
                      Add question
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {poolForm.items.map((item, itemIndex) => (
                      <div
                        key={`${item.questionKey}-${itemIndex}`}
                        className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_14px_30px_rgba(97,163,184,0.08)]"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                              Question {itemIndex + 1}
                            </p>
                            <p className="mt-1 text-sm text-brand-gray-500">
                              {item.options.length} options configured
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusChip
                              label={item.isActive ? "Active" : "Inactive"}
                              tone={item.isActive ? "success" : "neutral"}
                            />
                            <button
                              type="button"
                              onClick={() => removePoolItem(itemIndex)}
                              disabled={poolForm.items.length === 1}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                          <Field label="Question key">
                            <input
                              className={inputClassName}
                              value={item.questionKey}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  questionKey: event.target.value,
                                }))
                              }
                              placeholder={`question-${itemIndex + 1}`}
                            />
                          </Field>
                          <Field label="Difficulty">
                            <input
                              className={inputClassName}
                              value={item.difficulty}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  difficulty: event.target.value,
                                }))
                              }
                              placeholder="normal"
                            />
                          </Field>
                        </div>

                        <Field className="mt-4" label="Prompt">
                          <textarea
                            className={`${inputClassName} min-h-[96px] resize-y`}
                            value={item.prompt}
                            onChange={(event) =>
                              setPoolItem(itemIndex, (current) => ({
                                ...current,
                                prompt: event.target.value,
                              }))
                            }
                            placeholder="What should the player answer?"
                          />
                        </Field>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                              Options
                            </p>
                            <p className="mt-1 text-sm text-brand-gray-500">
                              The correct option id must match one of the options below.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addOption(itemIndex)}
                            className="rounded-2xl border border-brand-teal/25 bg-brand-teal/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-teal transition hover:bg-brand-teal/15"
                          >
                            Add option
                          </button>
                        </div>

                        <div className="mt-4 space-y-3">
                          {item.options.map((option, optionIndex) => (
                            <div
                              key={`${option.id}-${optionIndex}`}
                              className="grid gap-3 rounded-2xl border border-brand-gray-100 bg-white px-4 py-3 md:grid-cols-[120px_1fr_auto]"
                            >
                              <input
                                className={inputClassName}
                                value={option.id}
                                onChange={(event) =>
                                  setPoolItem(itemIndex, (current) => {
                                    const nextId = event.target.value;
                                    const nextOptions = current.options.map((entry, entryIndex) =>
                                      entryIndex === optionIndex ? { ...entry, id: nextId } : entry
                                    );
                                    return {
                                      ...current,
                                      options: nextOptions,
                                      correctOptionId:
                                        current.correctOptionId === option.id
                                          ? nextId
                                          : current.correctOptionId,
                                    };
                                  })
                                }
                                placeholder="a"
                              />
                              <input
                                className={inputClassName}
                                value={option.text}
                                onChange={(event) =>
                                  setPoolItem(itemIndex, (current) => ({
                                    ...current,
                                    options: current.options.map((entry, entryIndex) =>
                                      entryIndex === optionIndex
                                        ? { ...entry, text: event.target.value }
                                        : entry
                                    ),
                                  }))
                                }
                                placeholder="Option text"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(itemIndex, optionIndex)}
                                disabled={item.options.length === 1}
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
                          <Field label="Correct option id">
                            <input
                              className={inputClassName}
                              value={item.correctOptionId}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  correctOptionId: event.target.value,
                                }))
                              }
                              placeholder="a"
                            />
                          </Field>
                          <Field label="Knowledge tags">
                            <input
                              className={inputClassName}
                              value={item.knowledgeTagsText}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  knowledgeTagsText: event.target.value,
                                }))
                              }
                              placeholder="calculus, derivatives"
                            />
                          </Field>
                        </div>

                        <Field className="mt-4" label="Explanation">
                          <textarea
                            className={`${inputClassName} min-h-[88px] resize-y`}
                            value={item.explanation}
                            onChange={(event) =>
                              setPoolItem(itemIndex, (current) => ({
                                ...current,
                                explanation: event.target.value,
                              }))
                            }
                            placeholder="Why is the answer correct?"
                          />
                        </Field>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <Field label="Source unit id">
                            <input
                              className={inputClassName}
                              value={item.sourceUnitId}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  sourceUnitId: event.target.value,
                                }))
                              }
                              placeholder="unit-1"
                            />
                          </Field>
                          <Field label="Source node id">
                            <input
                              className={inputClassName}
                              value={item.sourceNodeId}
                              onChange={(event) =>
                                setPoolItem(itemIndex, (current) => ({
                                  ...current,
                                  sourceNodeId: event.target.value,
                                }))
                              }
                              placeholder="node-derivatives"
                            />
                          </Field>
                        </div>

                        <div className="mt-4">
                          <ToggleRow
                            label="Question active"
                            checked={item.isActive}
                            onChange={(checked) =>
                              setPoolItem(itemIndex, (current) => ({
                                ...current,
                                isActive: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Field
                    className="mt-5"
                    label="Generated JSON preview"
                    hint="Readonly preview of what will be sent to the API."
                  >
                    <textarea
                      className={`${inputClassName} min-h-[220px] resize-y font-mono text-xs leading-6`}
                      value={poolPreview}
                      readOnly
                      spellCheck={false}
                    />
                  </Field>

                  <GameButton
                    className="mt-5 w-full"
                    variant="secondary"
                    onClick={() => void handleSavePool()}
                    disabled={loading || savingPool}
                  >
                    {savingPool
                      ? "Saving pool..."
                      : selectedPool
                        ? "Update pool"
                        : "Create pool"}
                  </GameButton>
                </div>
              </div>
              </DeepGlassCard>
            </div>

            <DeepGlassCard className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
                    Seasons
                  </h2>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    Control the active Arena season, leaderboard window, and season metadata.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InfoChip label={`${seasons.length} seasons`} />
                  <InfoChip
                    label={`${seasons.filter((season) => season.isActive).length} active`}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {seasons.map((season) => {
                    const active = season.id === selectedSeasonId;
                    return (
                      <button
                        key={season.id}
                        type="button"
                        onClick={() => {
                          setSelectedSeasonId(season.id);
                          setError(null);
                          setNotice(null);
                        }}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-brand-teal/45 bg-brand-teal/10 shadow-[0_16px_30px_rgba(95,179,175,0.16)]"
                            : "border-white/70 bg-white/68"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-xl font-bold text-brand-gray-700">
                            {season.name}
                          </p>
                          <StatusChip
                            label={season.isActive ? "Active" : season.status}
                            tone={season.isActive ? "success" : "neutral"}
                          />
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-teal">
                          {season.startedAt
                            ? `Starts ${new Date(season.startedAt).toLocaleDateString()}`
                            : "No start time"}
                        </p>
                      </button>
                    );
                  })}
                  {seasons.length === 0 && !loading ? (
                    <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                      No Arena seasons yet. Create the first season from this panel.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Season name">
                      <input
                        className={inputClassName}
                        value={seasonForm.name}
                        onChange={(event) =>
                          setSeasonForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Season 2026 Spring"
                      />
                    </Field>
                    <Field label="Status">
                      <input
                        className={inputClassName}
                        value={seasonForm.status}
                        onChange={(event) =>
                          setSeasonForm((current) => ({ ...current, status: event.target.value }))
                        }
                        placeholder="upcoming"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Start time">
                      <input
                        className={inputClassName}
                        type="datetime-local"
                        value={seasonForm.startedAt}
                        onChange={(event) =>
                          setSeasonForm((current) => ({
                            ...current,
                            startedAt: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="End time">
                      <input
                        className={inputClassName}
                        type="datetime-local"
                        value={seasonForm.endedAt}
                        onChange={(event) =>
                          setSeasonForm((current) => ({
                            ...current,
                            endedAt: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <ToggleRow
                      label="Set as active season"
                      checked={seasonForm.isActive}
                      onChange={(checked) =>
                        setSeasonForm((current) => ({ ...current, isActive: checked }))
                      }
                    />
                  </div>

                  <Field className="mt-4" label="Leaderboard config JSON">
                    <textarea
                      className={`${inputClassName} min-h-[120px] resize-y font-mono text-xs`}
                      value={seasonForm.leaderboardConfigText}
                      onChange={(event) =>
                        setSeasonForm((current) => ({
                          ...current,
                          leaderboardConfigText: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field className="mt-4" label="Reward config JSON">
                    <textarea
                      className={`${inputClassName} min-h-[120px] resize-y font-mono text-xs`}
                      value={seasonForm.rewardConfigText}
                      onChange={(event) =>
                        setSeasonForm((current) => ({
                          ...current,
                          rewardConfigText: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <GameButton
                    className="mt-5 w-full"
                    onClick={() => void handleSaveSeason()}
                    disabled={loading || savingSeason}
                  >
                    {savingSeason
                      ? "Saving season..."
                      : selectedSeason
                        ? "Update season"
                        : "Create season"}
                  </GameButton>
                </div>
              </div>
            </DeepGlassCard>

            <DeepGlassCard className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
                    Arena system health
                  </h2>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    Soft telemetry for queue pressure, stale matches, disconnect instability, and suspicious latency activity.
                  </p>
                </div>
                <InfoChip
                  label={
                    healthSnapshot
                      ? new Date(healthSnapshot.generatedAt).toLocaleTimeString()
                      : "No data"
                  }
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Waiting Queue" value={String(healthSnapshot?.waitingQueueCount ?? 0)} />
                <MetricCard label="Matched Queue" value={String(healthSnapshot?.matchedQueueCount ?? 0)} />
                <MetricCard label="Live Matches" value={String(healthSnapshot?.inProgressMatchCount ?? 0)} />
                <MetricCard label="Stale Matches" value={String(healthSnapshot?.staleMatchCount ?? 0)} />
                <MetricCard label="Abandonments" value={String(healthSnapshot?.abandonmentCount ?? 0)} />
                <MetricCard label="Suspicious Latency" value={String(healthSnapshot?.suspiciousLatencyCount ?? 0)} />
                <MetricCard label="Disconnect Instability" value={String(healthSnapshot?.disconnectInstabilityCount ?? 0)} />
                <MetricCard label="Alert Flags" value={String(healthSnapshot?.alertFlags.length ?? 0)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(healthSnapshot?.alertFlags.length ? healthSnapshot.alertFlags : ["healthy"]).map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600"
                  >
                    {flag.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </DeepGlassCard>

            <DeepGlassCard className="px-6 py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
                    Operations review
                  </h2>
                  <p className="mt-2 text-sm text-brand-gray-500">
                    Inspect recent player match records and quickly spot suspicious or degraded Arena matches.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    className={`${inputClassName} min-w-[220px]`}
                    value={playerMatchSearch}
                    onChange={(event) => setPlayerMatchSearch(event.target.value)}
                    placeholder="Search player email or name"
                  />
                  <GameButton onClick={() => void handleRefreshOps()} disabled={loadingOps}>
                    {loadingOps ? "Refreshing..." : "Refresh ops data"}
                  </GameButton>
                </div>
              </div>

              <div className="mt-5 grid gap-6 xl:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl font-bold text-brand-gray-700">
                      Player match records
                    </h3>
                    <InfoChip label={`${playerMatches.length} rows`} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {playerMatches.map((record) => (
                      <div
                        key={`${record.matchId}-${record.userId}`}
                        className="rounded-[24px] border border-white/70 bg-white/68 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-heading text-lg font-bold text-brand-gray-700">
                              {record.displayName}
                            </p>
                            <p className="mt-1 text-xs text-brand-gray-500">{record.email}</p>
                          </div>
                          <StatusChip label={record.status} tone={record.status === "finished" ? "success" : "neutral"} />
                        </div>
                        <p className="mt-3 text-sm text-brand-gray-600">
                          Match #{record.matchId} • {record.publicCourseTitle} • {record.mode}
                        </p>
                        <p className="mt-2 text-xs text-brand-gray-500">
                          Rank {record.finalRank ?? "-"} • Score {record.score} • {record.correctCount} correct • Rating {record.ratingDelta >= 0 ? "+" : ""}{record.ratingDelta}
                        </p>
                      </div>
                    ))}
                    {playerMatches.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                        No player match records found for this search.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl font-bold text-brand-gray-700">
                      Match anomaly review
                    </h3>
                    <InfoChip label={`${matchReviews.length} matches`} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {matchReviews.map((review) => (
                      <div
                        key={review.matchId}
                        className="rounded-[24px] border border-white/70 bg-white/68 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-heading text-lg font-bold text-brand-gray-700">
                              Match #{review.matchId}
                            </p>
                            <p className="mt-1 text-sm text-brand-gray-500">
                              {review.publicCourseTitle} • {review.mode}
                            </p>
                          </div>
                          <StatusChip
                            label={review.anomalyFlags.length > 0 ? "Review" : "Healthy"}
                            tone={review.anomalyFlags.length > 0 ? "info" : "success"}
                          />
                        </div>
                        <p className="mt-3 text-xs text-brand-gray-500">
                          {review.playerCount} players • {review.roundCount} rounds • {review.answerCount} answers • {review.timedOutCount} timeouts
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(review.anomalyFlags.length > 0 ? review.anomalyFlags : ["no_flags"]).map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600"
                            >
                              {flag.replaceAll("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {matchReviews.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                        No match reviews are available yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </DeepGlassCard>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Field({
  children,
  className = "",
  hint,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  hint?: string;
  label: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">
        {label}
      </span>
      {hint ? <p className="mt-1 text-xs text-brand-gray-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/75 bg-white/72 px-4 py-3">
      <span className="text-sm font-semibold text-brand-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-brand-teal"
      />
    </label>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "info" | "neutral";
}) {
  const className =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "info"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-teal">
      {label}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/68 px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gray-400">
        {label}
      </p>
      <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}

function createEmptyPoolItem(index: number): PoolItemFormState {
  return {
    questionKey: `question-${index}`,
    prompt: "",
    correctOptionId: "a",
    difficulty: "normal",
    knowledgeTagsText: "",
    explanation: "",
    sourceUnitId: "",
    sourceNodeId: "",
    isActive: true,
    options: createEmptyOptions(),
  };
}

function createEmptyOptions(): PoolOptionFormState[] {
  return [
    { id: "a", text: "" },
    { id: "b", text: "" },
  ];
}

function createEmptyOption(index: number): PoolOptionFormState {
  return {
    id: String.fromCharCode(97 + index),
    text: "",
  };
}

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function serializePoolItem(
  item: PoolItemFormState,
  itemIndex: number
): ArenaAdminQuestionPoolItemUpsertRequest {
  const questionKey = item.questionKey.trim();
  const prompt = item.prompt.trim();
  const correctOptionId = item.correctOptionId.trim();
  const options = item.options.map((option, optionIndex) => {
    const id = option.id.trim();
    const text = option.text.trim();

    if (!id) {
      throw new Error(`Question ${itemIndex + 1}: option ${optionIndex + 1} is missing an id.`);
    }
    if (!text) {
      throw new Error(`Question ${itemIndex + 1}: option ${id} is missing text.`);
    }

    return { id, text };
  });

  if (!questionKey) {
    throw new Error(`Question ${itemIndex + 1} is missing a question key.`);
  }
  if (!prompt) {
    throw new Error(`Question ${itemIndex + 1} is missing a prompt.`);
  }
  if (!correctOptionId) {
    throw new Error(`Question ${itemIndex + 1} is missing a correct option id.`);
  }
  if (!options.some((option) => option.id === correctOptionId)) {
    throw new Error(
      `Question ${itemIndex + 1}: correct option id must match one of the configured options.`
    );
  }

  return {
    questionKey,
    prompt,
    options,
    correctOptionId,
    difficulty: item.difficulty.trim() || "normal",
    knowledgeTags: uniqueValues(splitCommaSeparated(item.knowledgeTagsText)),
    explanation: item.explanation.trim() || null,
    sourceUnitId: item.sourceUnitId.trim() || null,
    sourceNodeId: item.sourceNodeId.trim() || null,
    isActive: item.isActive,
  };
}

function validateCoursePayload(payload: ArenaAdminPublicCourseUpsertRequest) {
  if (!payload.slug) throw new Error("Topic slug is required.");
  if (!payload.title) throw new Error("Topic title is required.");
  if (!payload.topic) throw new Error("Topic topic is required.");
}

function validatePoolPayload(payload: ArenaAdminQuestionPoolUpsertRequest) {
  if (!payload.slug) throw new Error("Pool slug is required.");
  if (!payload.title) throw new Error("Pool title is required.");
  if (!payload.items.length) throw new Error("Pool items cannot be empty.");

  const duplicateQuestionKeys = findDuplicates(payload.items.map((item) => item.questionKey));
  if (duplicateQuestionKeys.length > 0) {
    throw new Error(`Duplicate question keys: ${duplicateQuestionKeys.join(", ")}`);
  }
}

function validateSeasonPayload(payload: ArenaAdminSeasonUpsertRequest) {
  if (!payload.name) throw new Error("Season name is required.");
  if (!payload.status) throw new Error("Season status is required.");
  if (payload.startedAt && payload.endedAt && new Date(payload.endedAt) < new Date(payload.startedAt)) {
    throw new Error("Season end time must be after the start time.");
  }
}

function parseJsonConfig(value: string, label: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be a JSON object")) {
      throw error;
    }
    throw new Error(`${label} must be valid JSON.`);
  }
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return Array.from(duplicates);
}

function upsertById<T extends { id: number }>(items: T[], nextItem: T) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}

const inputClassName =
  "w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal/40 focus:ring-2 focus:ring-brand-teal/15";
