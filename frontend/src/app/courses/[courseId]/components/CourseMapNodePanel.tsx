"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchLessonComponentManifest,
  fetchLessonGenerationPreferences,
  saveLessonGenerationPreference,
} from "@/lib/apiClient";
import type {
  CoursePath,
  LessonComponentManifestItem,
} from "@/lib/apiTypes";
import { NODE_STATUS } from "@/lib/domain/statuses";
import type { CourseMapNode } from "../hooks/useCourseMapData";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";

function courseSlugFromTitle(title: string): string {
  return title.toLowerCase().replace(/ /g, "-").replace(/&/g, "and");
}

function translatePublicNode(
  t: (key: TranslationKey) => string,
  courseSlug: string,
  nodeId: string,
  fallback: string
): string {
  const key = `course.${courseSlug}.node.${nodeId}` as TranslationKey;
  const result = t(key);
  return result === key ? fallback : result;
}

function translatePublicUnitTitle(
  t: (key: TranslationKey) => string,
  courseSlug: string,
  nodeId: string,
  fallback: string
): string {
  // node IDs follow the pattern {prefix}-{unitNum}-{nodeNum}, e.g. "ai-1-2" → unit 1
  const match = nodeId.match(/-(\d+)-\d+$/);
  if (!match) return fallback;
  const key = `course.${courseSlug}.unit-${match[1]}` as TranslationKey;
  const result = t(key);
  return result === key ? fallback : result;
}

function translatePublicNodeDescription(
  t: (key: TranslationKey) => string,
  courseSlug: string,
  nodeId: string,
  fallback: string
): string {
  const key = `course.${courseSlug}.node.${nodeId}.desc` as TranslationKey;
  const result = t(key);
  return result === key ? fallback : result;
}

export function CourseMapNodePanel({
  courseId,
  coursePath,
  selectedNode,
}: {
  courseId: string;
  coursePath: CoursePath | null;
  selectedNode: CourseMapNode | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [manifestItems, setManifestItems] = useState<LessonComponentManifestItem[]>([]);
  const [manifestError, setManifestError] = useState("");
  const [courseLevelDisabled, setCourseLevelDisabled] = useState<string[]>([]);
  const [preferenceError, setPreferenceError] = useState("");

  const numericCourseId = Number(courseId);

  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetchLessonComponentManifest();
        setManifestItems(response.items);
      } catch (error) {
        setManifestError(
          error instanceof ApiError ? error.detail : t("courseMap.failedLoadQuestionTypes")
        );
      }
    };

    void loadManifest();
  }, []);

  useEffect(() => {
    if (!Number.isFinite(numericCourseId)) {
      return;
    }

    const loadPreferences = async () => {
      try {
        const response = await fetchLessonGenerationPreferences(numericCourseId);
        const allComponents = response.items;
        const manifestComponentNames = manifestItems.map((item) =>
          String(item.frontendRegistryKey)
        );
        const courseLevelPreference = allComponents.find((item) => !item.nodeId);
        const courseLevelDisabled = courseLevelPreference
          ? manifestComponentNames.filter(
              (componentName) =>
                !courseLevelPreference.allowedComponents.includes(componentName)
            )
          : [];

        setCourseLevelDisabled(courseLevelDisabled);
      } catch (error) {
        setPreferenceError(
          error instanceof ApiError
            ? error.detail
            : t("courseMap.failedLoadPreferences")
        );
      }
    };

    if (manifestItems.length > 0) {
      void loadPreferences();
    }
  }, [manifestItems, numericCourseId]);

  const selectedNodeHasGeneratedLesson = Boolean(selectedNode?.hasGeneratedLesson);

  const enabledItems = useMemo(() => {
    return manifestItems.filter(
      (item) => !courseLevelDisabled.includes(String(item.frontendRegistryKey))
    );
  }, [courseLevelDisabled, manifestItems]);

  const courseEnabledItems = useMemo(() => {
    return manifestItems.filter(
      (item) => !courseLevelDisabled.includes(String(item.frontendRegistryKey))
    );
  }, [courseLevelDisabled, manifestItems]);

  const persistCoursePreference = async ({
    nextDisabled,
    previousDisabled,
  }: {
    nextDisabled: string[];
    previousDisabled: string[];
  }) => {
    const nextAllowed = manifestItems
      .map((item) => String(item.frontendRegistryKey))
      .filter((item) => !nextDisabled.includes(item));

    setPreferenceError("");

    try {
      await saveLessonGenerationPreference({
        courseId: numericCourseId,
        nodeId: null,
        allowedComponents: nextAllowed,
      });
    } catch (error) {
      setCourseLevelDisabled(previousDisabled);
      setPreferenceError(
        error instanceof ApiError
          ? error.detail
          : t("courseMap.failedSavePreferences")
      );
    }
  };

  const toggleCourseComponent = async (componentName: string) => {
    const current = courseLevelDisabled;
    const nextDisabled = current.includes(componentName)
      ? current.filter((item) => item !== componentName)
      : [...current, componentName];

    setCourseLevelDisabled(nextDisabled);
    await persistCoursePreference({
      nextDisabled,
      previousDisabled: current,
    });
  };

  const handleStart = () => {
    if (!selectedNode || enabledItems.length === 0) {
      return;
    }

    if (selectedNodeHasGeneratedLesson) {
      router.push(`/courses/${courseId}/nodes/${selectedNode.id}`);
      return;
    }

    const search = new URLSearchParams();
    if (enabledItems.length !== manifestItems.length) {
      search.set(
        "components",
        enabledItems.map((item) => String(item.frontendRegistryKey)).join(",")
      );
    }
    router.push(
      `/courses/${courseId}/nodes/${selectedNode.id}${
        search.toString() ? `?${search.toString()}` : ""
      }`
    );
  };

  const isLocked = selectedNode?.status === NODE_STATUS.LOCKED;
  const contextTitle = (() => {
    if (coursePath?.isPublic && selectedNode && coursePath.courseTitle) {
      return translatePublicNode(
        t,
        courseSlugFromTitle(coursePath.courseTitle),
        selectedNode.id,
        selectedNode.title
      );
    }
    return (
      selectedNode?.title ||
      coursePath?.topic ||
      coursePath?.courseTitle ||
      "Current course"
    );
  })();
  const contextDescription = (() => {
    if (coursePath?.isPublic && selectedNode && coursePath.courseTitle) {
      return translatePublicNodeDescription(
        t,
        courseSlugFromTitle(coursePath.courseTitle),
        selectedNode.id,
        selectedNode?.description || coursePath?.description || t("courseMap.nodeDefaultDescription")
      );
    }
    return selectedNode?.description || coursePath?.description || t("courseMap.nodeDefaultDescription");
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: "spring", damping: 18 }}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section className={`rounded-2xl border p-4 ${
          coursePath?.isPublic 
            ? "border-brand-teal/20 bg-brand-teal/5" 
            : "border-sky-100 bg-sky-50/70"
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${
            coursePath?.isPublic ? "text-brand-teal/70" : "text-sky-700/70"
          }`}>
            {coursePath?.isPublic ? t("courseMap.officialTopic") : t("courseMap.courseContext")}
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-gray-700">
            {contextTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-gray-500">
            {contextDescription}
          </p>
          {selectedNode?.unitTitle ? (
            <p className="mt-2 text-xs font-medium text-brand-gray-400">
              {t("courseMap.unitLabel", {
                title:
                  coursePath?.isPublic && coursePath.courseTitle
                    ? translatePublicUnitTitle(
                        t,
                        courseSlugFromTitle(coursePath.courseTitle),
                        selectedNode.id,
                        selectedNode.unitTitle
                      )
                    : selectedNode.unitTitle,
              })}
            </p>
          ) : null}
        </section>

        {!coursePath?.isPublic && (
          <section>
            {manifestError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {manifestError}
              </div>
            ) : null}
            {preferenceError ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {preferenceError}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-brand-teal/15 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-gray-700">
                      {t("courseMap.courseDefault")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-brand-gray-500">
                      {t("courseMap.courseDefaultDesc")}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                    {courseEnabledItems.length}/{manifestItems.length || 0}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {manifestItems.map((item) => {
                    const componentName = String(item.frontendRegistryKey);
                    const enabled = !courseLevelDisabled.includes(componentName);
                    return (
                      <label
                        key={`course-${componentName}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          enabled
                            ? "border-brand-teal/20 bg-brand-teal/5"
                            : "border-brand-gray-200 bg-brand-gray-50/70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-brand-gray-300 text-brand-teal focus:ring-brand-teal"
                          checked={enabled}
                          onChange={() => {
                            void toggleCourseComponent(componentName);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-brand-gray-700">
                            {item.frontendRegistryKey}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="border-t border-white/60 px-6 py-5">
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedNode || isLocked || enabledItems.length === 0}
          className="w-full rounded-2xl bg-gradient-to-r from-brand-teal to-[#5fb3af] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-300/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {!selectedNode
            ? t("courseMap.selectNodeFirst")
            : isLocked
              ? t("courseMap.nodeLocked")
              : enabledItems.length === 0
                ? t("courseMap.enableQuestionType")
                : t("courseMap.enterLesson")}
        </button>
      </div>
    </motion.div>
  );
}
