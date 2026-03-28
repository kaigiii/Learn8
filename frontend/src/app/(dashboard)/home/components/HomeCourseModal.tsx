"use client";

import { AnimatePresence, motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { CourseModalState } from "../types";

interface HomeCourseModalProps {
  courseModal: CourseModalState;
  setCourseModal: React.Dispatch<React.SetStateAction<CourseModalState>>;
  onRename: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function HomeCourseModal({
  courseModal,
  setCourseModal,
  onRename,
  onDelete,
}: HomeCourseModalProps) {
  return (
    <AnimatePresence>
      {courseModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.01 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={() => {
            if (!courseModal.submitting) {
              setCourseModal(null);
            }
          }}
        >
          <div className="absolute inset-0 bg-brand-gray-700/24 backdrop-blur-[4px]" />
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.01 }}
            className="relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-white/40 bg-white/80 px-6 pb-5 pt-14 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {courseModal.type === "rename" ? (
              <>
                <div className="absolute left-6 top-5 h-6 w-14 rounded-full bg-gradient-to-r from-teal-100 to-cyan-50 shadow-[0_10px_26px_rgba(97,163,184,0.18)]" />
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                  Rename {courseModal.renameTarget === "course" ? "Course" : "Draft"}
                </p>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">
                  Update {courseModal.renameTarget === "course" ? "course title" : "draft title"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  This changes the title shown in your library.
                </p>

                <input
                  autoFocus
                  value={courseModal.draftName}
                  onChange={(event) =>
                    setCourseModal((prev) =>
                      prev && prev.type === "rename"
                        ? { ...prev, draftName: event.target.value }
                        : prev
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !courseModal.submitting) {
                      void onRename();
                    }
                  }}
                  className="mt-5 w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                />

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setCourseModal(null)}
                    disabled={courseModal.submitting}
                    className="rounded-xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-gray-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <GameButton
                    onClick={() => void onRename()}
                    disabled={courseModal.submitting || !courseModal.draftName.trim()}
                    className="min-w-[130px]"
                  >
                    {courseModal.submitting ? "Saving..." : "Save"}
                  </GameButton>
                </div>
              </>
            ) : (
              <>
                <div className="absolute left-6 top-5 h-6 w-14 rounded-full bg-gradient-to-r from-rose-100 to-orange-50 shadow-[0_10px_26px_rgba(232,121,149,0.2)]" />
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-rose-500">
                  Delete Course
                </p>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">
                  Delete this course?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  This removes the uploaded files, generated context, questionnaire draft, and course history.
                </p>

                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  This action cannot be undone.
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setCourseModal(null)}
                    disabled={courseModal.submitting}
                    className="rounded-xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-gray-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void onDelete()}
                    disabled={courseModal.submitting}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600 disabled:opacity-60"
                  >
                    {courseModal.submitting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
