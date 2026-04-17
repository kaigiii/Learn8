import React from "react";
import Image from "next/image";

interface MascotHintProps {
  message: string;
}

export default function MascotHint({ message }: MascotHintProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Mascot avatar */}
      <div className="shrink-0">
        <Image
          src="/icon.png"
          alt="Mascot avatar"
          width={48}
          height={48}
          className="h-12 w-12 object-contain"
        />
      </div>
      {/* Speech bubble */}
      <div className="relative rounded-2xl bg-white/90 backdrop-blur-sm px-5 py-3 shadow-md border border-white/50">
        <div className="absolute -left-2 top-4 h-3 w-3 rotate-45 bg-white/90 border-l border-b border-white/50" />
        <p className="text-sm text-brand-gray-600 font-medium relative z-10">
          {message}
        </p>
      </div>
    </div>
  );
}
