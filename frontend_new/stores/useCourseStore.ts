import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockMedicineUnit } from "@/data/mock_medicine";
import { mockCalculusUnit } from "@/data/mock_calculus";
import { mockJapaneseUnit } from "@/data/mock_japanese";
import { mockSpanishUnit } from "@/data/mock_spanish";
import { mockPythonUnit } from "@/data/mock_python";
import { mockPythonAdvancedUnit } from "@/data/mock_python_advanced";
import { mockStudySkillsUnit } from "@/data/mock_study_skills";
import { mockMLBasicsUnit } from "@/data/mock_ml_basics";
import { mockDataScienceUnit } from "@/data/mock_data_science";

/* ═══════════════════ Types ═══════════════════ */

export interface StageData {
  stageId: string;
  topic: string;
  module: string;
  component: string;
  skin: string;
  config: {
    data: Record<string, unknown>;
    initialState: Record<string, unknown>;
  };
  validation: { type: string; condition: Record<string, unknown> };
  feedback: { success: string; error: string; hint: string };
}

export interface CourseNode {
  id: string;
  title: string;
  description: string;
  type: string;
  status: "completed" | "available" | "locked";
  stages: StageData[];
}

export interface Course {
  unitId: string;
  unitTitle: string;
  nodes: CourseNode[];
}

export interface RemedyNode {
  id: string;
  courseId: string;
  sourceNodeId: string;
  title: string;
  status: "available" | "completed";
}

export interface CourseState {
  /* ── Data ── */
  courses: Record<string, Course>; // keyed by unitId
  /* ── Progress ── */
  nodeStatuses: Record<string, "completed" | "available" | "locked">; // keyed by node id
  completedNodes: string[];
  /* ── Remedy ── */
  remedyNodes: RemedyNode[];
}

export interface CourseActions {
  /* ── Load ── */
  loadMockCourses: () => void;
  /* ── Query ── */
  getCourse: (unitId: string) => Course | undefined;
  getNode: (nodeId: string) => CourseNode | undefined;
  getNodeStatus: (nodeId: string) => "completed" | "available" | "locked";
  getNodesForCourse: (unitId: string) => CourseNode[];
  getCourseProgress: (unitId: string) => number; // 0-100
  /* ── Mutations ── */
  completeNode: (nodeId: string) => void;
  unlockNode: (nodeId: string) => void;
  resetProgress: () => void;
  /* ── Remedy ── */
  addRemedyNode: (courseId: string, sourceNodeId: string, sourceTitle: string) => void;
  completeRemedyNode: (remedyId: string) => void;
  getRemedyNodesForCourse: (courseId: string) => RemedyNode[];
}

/* ═══════════════════ Helpers ═══════════════════ */

function buildInitialStatuses(courses: Record<string, Course>): Record<string, string> {
  const statuses: Record<string, string> = {};
  for (const course of Object.values(courses)) {
    for (const node of course.nodes) {
      statuses[node.id] = node.status;
    }
  }
  return statuses;
}

/* ═══════════════════ Store ═══════════════════ */

const useCourseStore = create<CourseState & CourseActions>()(
  persist(
    (set, get) => ({
      courses: {},
      nodeStatuses: {},
      completedNodes: [],
      remedyNodes: [],

      /* ── Load mock data ── */
      loadMockCourses: () => {
        const medCourse = mockMedicineUnit as unknown as Course;
        const calcCourse = mockCalculusUnit as unknown as Course;

        const japCourse = mockJapaneseUnit as unknown as Course;
        const spCourse = mockSpanishUnit as unknown as Course;
        const pyCourse = mockPythonUnit as unknown as Course;
        const pyAdvCourse = mockPythonAdvancedUnit as unknown as Course;
        const ssCourse = mockStudySkillsUnit as unknown as Course;
        const mlCourse = mockMLBasicsUnit as unknown as Course;
        const dsCourse = mockDataScienceUnit as unknown as Course;

        const courses: Record<string, Course> = {
          [medCourse.unitId]: medCourse,
          [calcCourse.unitId]: calcCourse,
          [japCourse.unitId]: japCourse,
          [spCourse.unitId]: spCourse,
          [pyCourse.unitId]: pyCourse,
          [pyAdvCourse.unitId]: pyAdvCourse,
          [ssCourse.unitId]: ssCourse,
          [mlCourse.unitId]: mlCourse,
          [dsCourse.unitId]: dsCourse,
        };

        // Only initialize statuses if they haven't been set yet
        const currentStatuses = get().nodeStatuses;
        const hasExisting = Object.keys(currentStatuses).length > 0;

        set({
          courses,
          nodeStatuses: hasExisting
            ? currentStatuses
            : (buildInitialStatuses(courses) as Record<string, "completed" | "available" | "locked">),
        });
      },

      /* ── Query ── */
      getCourse: (unitId) => get().courses[unitId],

      getNode: (nodeId) => {
        for (const course of Object.values(get().courses)) {
          const node = course.nodes.find((n) => n.id === nodeId);
          if (node) {
            // Merge stored status
            return {
              ...node,
              status: get().nodeStatuses[node.id] ?? node.status,
            };
          }
        }
        return undefined;
      },

      getNodeStatus: (nodeId) =>
        get().nodeStatuses[nodeId] ?? "locked",

      getNodesForCourse: (unitId) => {
        const course = get().courses[unitId];
        if (!course) return [];
        return course.nodes.map((n) => ({
          ...n,
          status: get().nodeStatuses[n.id] ?? n.status,
        }));
      },

      getCourseProgress: (unitId) => {
        const course = get().courses[unitId];
        if (!course || course.nodes.length === 0) return 0;
        const completed = course.nodes.filter(
          (n) => get().nodeStatuses[n.id] === "completed"
        ).length;
        return Math.round((completed / course.nodes.length) * 100);
      },

      /* ── Mutations ── */
      completeNode: (nodeId) => {
        const state = get();

        // Find which course this node belongs to
        let courseId: string | null = null;
        let nodeIndex = -1;
        for (const course of Object.values(state.courses)) {
          const idx = course.nodes.findIndex((n) => n.id === nodeId);
          if (idx !== -1) {
            courseId = course.unitId;
            nodeIndex = idx;
            break;
          }
        }

        if (!courseId || nodeIndex === -1) return;

        const course = state.courses[courseId];
        const newStatuses = { ...state.nodeStatuses, [nodeId]: "completed" as const };
        const newCompleted = [...state.completedNodes];
        if (!newCompleted.includes(nodeId)) {
          newCompleted.push(nodeId);
        }

        // Auto-unlock the next node in the same course
        if (nodeIndex < course.nodes.length - 1) {
          const nextNode = course.nodes[nodeIndex + 1];
          if (newStatuses[nextNode.id] === "locked") {
            newStatuses[nextNode.id] = "available";
          }
        }

        set({
          nodeStatuses: newStatuses,
          completedNodes: newCompleted,
        });
      },

      unlockNode: (nodeId) =>
        set((s) => ({
          nodeStatuses: { ...s.nodeStatuses, [nodeId]: "available" },
        })),

      resetProgress: () => {
        const courses = get().courses;
        set({
          nodeStatuses: buildInitialStatuses(courses) as Record<string, "completed" | "available" | "locked">,
          completedNodes: [],
          remedyNodes: [],
        });
      },

      /* ── Remedy ── */
      addRemedyNode: (courseId, sourceNodeId, sourceTitle) => {
        const existing = get().remedyNodes;
        // Don't add duplicate remedy for same source
        if (existing.some((r) => r.sourceNodeId === sourceNodeId && r.status === "available")) return;
        const id = `remedy-${sourceNodeId}-${Date.now()}`;
        set({
          remedyNodes: [
            ...existing,
            { id, courseId, sourceNodeId, title: `📚 補強: ${sourceTitle}`, status: "available" },
          ],
        });
      },

      completeRemedyNode: (remedyId) => {
        set({
          remedyNodes: get().remedyNodes.map((r) =>
            r.id === remedyId ? { ...r, status: "completed" } : r
          ),
        });
      },

      getRemedyNodesForCourse: (courseId) =>
        get().remedyNodes.filter((r) => r.courseId === courseId),
    }),
    {
      name: "learn8-courses",
      partialize: (state) => ({
        nodeStatuses: state.nodeStatuses,
        completedNodes: state.completedNodes,
        remedyNodes: state.remedyNodes,
      }),
    }
  )
);

export default useCourseStore;
