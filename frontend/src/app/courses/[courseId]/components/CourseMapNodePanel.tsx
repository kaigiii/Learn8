"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ApiError,
  deleteLessonGenerationPreference,
  fetchLessonComponentManifest,
  fetchLessonGenerationPreferences,
  saveLessonGenerationPreference,
} from "@/lib/apiClient";
import type {
  CoursePath,
  LessonComponentManifestItem,
  LessonGenerationPreferenceItem,
} from "@/lib/apiTypes";
import { NODE_STATUS } from "@/lib/domain/statuses";
import type { CourseMapNode } from "../hooks/useCourseMapData";

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
  const [manifestItems, setManifestItems] = useState<LessonComponentManifestItem[]>([]);
  const [manifestError, setManifestError] = useState("");
  const [disabledByNodeId, setDisabledByNodeId] = useState<Record<string, string[]>>({});
  const [courseLevelDisabled, setCourseLevelDisabled] = useState<string[]>([]);
  const [nodeOverrideIds, setNodeOverrideIds] = useState<string[]>([]);
  const [preferenceError, setPreferenceError] = useState("");

  const numericCourseId = Number(courseId);

  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetchLessonComponentManifest();
        setManifestItems(response.items);
      } catch (error) {
        setManifestError(
          error instanceof ApiError ? error.detail : "Failed to load question types."
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
        const nextDisabledByNodeId: Record<string, string[]> = {};
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
        const nextNodeOverrideIds: string[] = [];

        allComponents.forEach((item: LessonGenerationPreferenceItem) => {
          if (!item.nodeId) {
            return;
          }
          const disabled = manifestComponentNames.filter(
            (componentName) => !item.allowedComponents.includes(componentName)
          );
          nextDisabledByNodeId[item.nodeId] = disabled;
          nextNodeOverrideIds.push(item.nodeId);
        });

        setCourseLevelDisabled(courseLevelDisabled);
        setNodeOverrideIds(nextNodeOverrideIds);
        setDisabledByNodeId(nextDisabledByNodeId);
      } catch (error) {
        setPreferenceError(
          error instanceof ApiError
            ? error.detail
            : "Failed to load saved lesson preferences."
        );
      }
    };

    if (manifestItems.length > 0) {
      void loadPreferences();
    }
  }, [manifestItems, numericCourseId]);

  const disabledForSelectedNode = selectedNode
    ? nodeOverrideIds.includes(selectedNode.id)
      ? disabledByNodeId[selectedNode.id] || []
      : courseLevelDisabled
    : [];
  const selectedNodeHasOverride = selectedNode
    ? nodeOverrideIds.includes(selectedNode.id)
    : false;
  const selectedNodeHasGeneratedLesson = Boolean(selectedNode?.hasGeneratedLesson);

  const enabledItems = useMemo(() => {
    return manifestItems.filter(
      (item) => !disabledForSelectedNode.includes(String(item.frontendRegistryKey))
    );
  }, [disabledForSelectedNode, manifestItems]);

  const courseEnabledItems = useMemo(() => {
    return manifestItems.filter(
      (item) => !courseLevelDisabled.includes(String(item.frontendRegistryKey))
    );
  }, [courseLevelDisabled, manifestItems]);

  const persistPreference = async ({
    nodeId,
    nextDisabled,
    previousDisabled,
    previousHadOverride,
  }: {
    nodeId: string | null;
    nextDisabled: string[];
    previousDisabled: string[];
    previousHadOverride: boolean;
  }) => {
    const targetNodeId = nodeId || null;
    const nextAllowed = manifestItems
      .map((item) => String(item.frontendRegistryKey))
      .filter((item) => !nextDisabled.includes(item));

    setPreferenceError("");

    try {
      await saveLessonGenerationPreference({
        courseId: numericCourseId,
        nodeId: targetNodeId,
        allowedComponents: nextAllowed,
      });
      if (targetNodeId) {
        setNodeOverrideIds((prev) =>
          prev.includes(targetNodeId) ? prev : [...prev, targetNodeId]
        );
      }
    } catch (error) {
      if (targetNodeId) {
        setDisabledByNodeId((prev) => ({
          ...prev,
          [targetNodeId]: previousDisabled,
        }));
        setNodeOverrideIds((prev) =>
          previousHadOverride
            ? prev
            : prev.filter((item) => item !== targetNodeId)
        );
      } else {
        setCourseLevelDisabled(previousDisabled);
      }
      setPreferenceError(
        error instanceof ApiError
          ? error.detail
          : "Failed to save lesson preferences."
      );
    }
  };

  const toggleCourseComponent = async (componentName: string) => {
    const current = courseLevelDisabled;
    const nextDisabled = current.includes(componentName)
      ? current.filter((item) => item !== componentName)
      : [...current, componentName];

    setCourseLevelDisabled(nextDisabled);
    await persistPreference({
      nodeId: null,
      nextDisabled,
      previousDisabled: current,
      previousHadOverride: true,
    });
  };

  const toggleNodeComponent = async (componentName: string) => {
    if (!selectedNode || selectedNodeHasGeneratedLesson) {
      return;
    }

    const current = selectedNodeHasOverride
      ? disabledByNodeId[selectedNode.id] || []
      : courseLevelDisabled;
    const nextDisabled = current.includes(componentName)
      ? current.filter((item) => item !== componentName)
      : [...current, componentName];

    setDisabledByNodeId((prev) => ({
      ...prev,
      [selectedNode.id]: nextDisabled,
    }));
    setNodeOverrideIds((prev) =>
      prev.includes(selectedNode.id) ? prev : [...prev, selectedNode.id]
    );
    await persistPreference({
      nodeId: selectedNode.id,
      nextDisabled,
      previousDisabled: current,
      previousHadOverride: selectedNodeHasOverride,
    });
  };

  const resetNodeToCourseDefault = async () => {
    if (!selectedNode || !selectedNodeHasOverride || selectedNodeHasGeneratedLesson) {
      return;
    }

    const previousDisabled = disabledByNodeId[selectedNode.id] || [];
    setNodeOverrideIds((prev) => prev.filter((item) => item !== selectedNode.id));
    setDisabledByNodeId((prev) => {
      const next = { ...prev };
      delete next[selectedNode.id];
      return next;
    });
    setPreferenceError("");

    try {
      await deleteLessonGenerationPreference({
        courseId: numericCourseId,
        nodeId: selectedNode.id,
      });
    } catch (error) {
      setNodeOverrideIds((prev) =>
        prev.includes(selectedNode.id) ? prev : [...prev, selectedNode.id]
      );
      setDisabledByNodeId((prev) => ({
        ...prev,
        [selectedNode.id]: previousDisabled,
      }));
      setPreferenceError(
        error instanceof ApiError
          ? error.detail
          : "Failed to reset node preference."
      );
    }
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: "spring", damping: 18 }}
      className="flex flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-lg shadow-teal-200/20 backdrop-blur-xl"
      style={{ minHeight: 560 }}
    >
      <div className="border-b border-white/60 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-teal/70">
          Lesson Brief
        </p>
        <h3 className="mt-2 font-heading text-xl font-bold text-brand-gray-700">
          {selectedNode ? selectedNode.title : coursePath?.courseTitle || "Course Overview"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-brand-gray-500">
          {selectedNode?.description ||
            coursePath?.description ||
            "Select a node to preview its focus, then choose which question types the AI may use."}
        </p>
        {selectedNode?.unitTitle ? (
          <p className="mt-3 text-xs font-medium text-brand-gray-400">
            Unit: {selectedNode.unitTitle}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/70">
            Course Context
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-gray-700">
            {coursePath?.topic || coursePath?.courseTitle || "Current course"}
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-gray-500">
            {coursePath?.description || "This node will generate a lesson based on the course map and your selected question types."}
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gray-400">
                Question Types
              </p>
              <p className="mt-1 text-sm text-brand-gray-500">
                Set course-wide defaults, then optionally override them per node.
              </p>
            </div>
            <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
              {selectedNode ? enabledItems.length : courseEnabledItems.length}/{manifestItems.length || 0} enabled
            </span>
          </div>

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
                    Course default
                  </p>
                  <p className="mt-1 text-xs leading-5 text-brand-gray-500">
                    Applies to every node unless that node has its own override.
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

            <div className="rounded-2xl border border-brand-gray-200 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-gray-700">
                    {selectedNode ? `Node override: ${selectedNode.title}` : "Node override"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-brand-gray-500">
                    {selectedNode
                      ? selectedNodeHasGeneratedLesson
                        ? "This node already has generated lesson content, so its question type selection is locked."
                        : selectedNodeHasOverride
                        ? "This node is using its own override."
                        : "This node is currently inheriting the course default."
                      : "Select a node to set a node-specific override."}
                  </p>
                </div>
                {selectedNode && selectedNodeHasOverride && !selectedNodeHasGeneratedLesson ? (
                  <button
                    type="button"
                    onClick={() => {
                      void resetNodeToCourseDefault();
                    }}
                    className="rounded-full border border-brand-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-brand-gray-600 transition hover:border-brand-teal/30 hover:text-brand-teal"
                  >
                    Use course default
                  </button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
            {manifestItems.map((item) => {
              const componentName = String(item.frontendRegistryKey);
              const enabled = !disabledForSelectedNode.includes(componentName);
              const enabledByCourseDefault = !courseLevelDisabled.includes(componentName);
              const nodeToggleDisabled =
                !selectedNode ||
                isLocked ||
                selectedNodeHasGeneratedLesson ||
                (!enabledByCourseDefault && !enabled);
              return (
                <label
                  key={`node-${componentName}`}
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
                      void toggleNodeComponent(componentName);
                    }}
                    disabled={nodeToggleDisabled}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-gray-700">
                      {item.frontendRegistryKey}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-brand-gray-500">
                      {!enabledByCourseDefault && !enabled
                        ? "Disabled by the course-wide default."
                        : item.description}
                    </p>
                  </div>
                </label>
              );
            })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-white/60 px-6 py-5">
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedNode || isLocked || enabledItems.length === 0}
          className="w-full rounded-2xl bg-gradient-to-r from-brand-teal to-[#5fb3af] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-300/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {!selectedNode
            ? "Select a node first"
            : isLocked
              ? "This node is locked"
              : enabledItems.length === 0
                ? "Enable at least one question type"
                : selectedNodeHasGeneratedLesson
                  ? "Enter this lesson"
                  : "Enter this lesson"}
        </button>
      </div>
    </motion.div>
  );
}
