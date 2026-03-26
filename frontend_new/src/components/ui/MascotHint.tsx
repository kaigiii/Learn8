import React from "react";

interface MascotHintProps {
  message: string;
}

export default function MascotHint({ message }: MascotHintProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Small owl avatar */}
      <div className="shrink-0">
        <svg
          viewBox="0 0 64 64"
          className="h-12 w-12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="32" cy="36" rx="18" ry="20" fill="#C4A882" />
          <ellipse cx="32" cy="34" rx="14" ry="16" fill="#E8D5B7" />
          <circle cx="25" cy="28" r="6" fill="white" />
          <circle cx="39" cy="28" r="6" fill="white" />
          <circle cx="25" cy="28" r="6.5" fill="none" stroke="#6B6B6B" strokeWidth="1.5" />
          <circle cx="39" cy="28" r="6.5" fill="none" stroke="#6B6B6B" strokeWidth="1.5" />
          <line x1="31.5" y1="28" x2="32.5" y2="28" stroke="#6B6B6B" strokeWidth="1.5" />
          <circle cx="26" cy="28" r="3" fill="#333" />
          <circle cx="38" cy="28" r="3" fill="#333" />
          <circle cx="27" cy="27" r="1" fill="white" />
          <circle cx="39" cy="27" r="1" fill="white" />
          <polygon points="32,32 29,36 35,36" fill="#E8734A" />
          <polygon points="24,20 28,14 30,22" fill="#C4A882" />
          <polygon points="40,20 36,14 34,22" fill="#C4A882" />
        </svg>
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
