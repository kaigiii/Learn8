import React from "react";

interface TopProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export default function TopProgressBar({
  progress,
  className = "",
}: TopProgressBarProps) {
  return (
    <div
      className={`w-full h-3 rounded-full bg-brand-gray-200 overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-green transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
