"use client";

import type { ReactNode } from "react";

interface QuestionActionBarProps {
  leftSlot?: ReactNode;
  rightSlot: ReactNode;
  justify?: "between" | "end";
}

export function QuestionActionBar({
  leftSlot,
  rightSlot,
  justify = "between",
}: QuestionActionBarProps) {
  return (
    <div
      className={`relative flex flex-shrink-0 items-end pt-4 pb-6 ${
        justify === "between" ? "justify-between" : "justify-end"
      }`}
    >
      {justify === "between" && <div className="flex items-end gap-2">{leftSlot}</div>}
      <div className="flex items-center gap-3">{rightSlot}</div>
    </div>
  );
}
