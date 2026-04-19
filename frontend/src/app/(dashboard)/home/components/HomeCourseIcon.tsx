"use client";

import Image from "next/image";

function resolveTreeIcon(progress?: number) {
  const safeProgress = Number.isFinite(progress) ? Math.min(Math.max(progress ?? 0, 0), 100) : 0;

  if (safeProgress < 25) return "/library-tree/tree1.png";
  if (safeProgress < 50) return "/library-tree/tree2.png";
  if (safeProgress < 75) return "/library-tree/tree3.png";
  return "/library-tree/tree4.png";
}

export function HomeCourseIcon({ progress, className }: { progress?: number; className?: string }) {
  const iconSrc = resolveTreeIcon(progress);

  return (
    <Image
      src={iconSrc}
      alt="Course tree icon"
      width={144}
      height={144}
      className={className ?? "h-36 w-36 object-contain"}
    />
  );
}
