"use client";

import { AnimatePresence, motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { ProjectModalState } from "../types";

interface HomeProjectModalProps {
  projectModal: ProjectModalState;
  setProjectModal: React.Dispatch<React.SetStateAction<ProjectModalState>>;
  onRename: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function HomeProjectModal({
  projectModal,
  setProjectModal,
  onRename,
  onDelete,
}: HomeProjectModalProps) {
  return (
    <AnimatePresence>
      {projectModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-gray-700/30 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!projectModal.submitting) {
              setProjectModal(null);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/92 p-6 shadow-[0_24px_60px_rgba(31,41,55,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            {projectModal.type === "rename" ? (
              <>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                  Rename Project
                </p>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">
                  Update project name
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  This changes the label used across your current learning journey.
                </p>

                <input
                  autoFocus
                  value={projectModal.draftName}
                  onChange={(event) =>
                    setProjectModal((prev) =>
                      prev && prev.type === "rename"
                        ? { ...prev, draftName: event.target.value }
                        : prev
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !projectModal.submitting) {
                      void onRename();
                    }
                  }}
                  className="mt-5 w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                />

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setProjectModal(null)}
                    disabled={projectModal.submitting}
                    className="rounded-xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-gray-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <GameButton
                    onClick={() => void onRename()}
                    disabled={projectModal.submitting || !projectModal.draftName.trim()}
                    className="min-w-[130px]"
                  >
                    {projectModal.submitting ? "Saving..." : "Save"}
                  </GameButton>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-rose-500">
                  Delete Project
                </p>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">
                  Delete "{projectModal.project.name}"?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                  This removes the project, uploaded files, generated context, and associated course history for that journey.
                </p>

                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  This action cannot be undone.
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setProjectModal(null)}
                    disabled={projectModal.submitting}
                    className="rounded-xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-gray-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void onDelete()}
                    disabled={projectModal.submitting}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600 disabled:opacity-60"
                  >
                    {projectModal.submitting ? "Deleting..." : "Delete"}
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
