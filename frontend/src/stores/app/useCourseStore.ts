import { create } from "zustand";

interface CourseSelection {
  id: number;
}

interface CourseState {
  currentCourseId: number | null;
  setCurrentCourse: (course: CourseSelection | null) => void;
  setCurrentCourseId: (courseId: number | null) => void;
}

export const useCourseStore = create<CourseState>()((set) => ({
  currentCourseId: null,
  setCurrentCourse: (course) =>
    set({ currentCourseId: course?.id ?? null }),
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),
}));
