"use client";

interface HintButtonProps {
  onClick: () => void;
  disabled?: boolean;
  cost?: number;
}

export function HintButton({ onClick, disabled = false, cost = 10 }: HintButtonProps) {
  if (disabled) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-full border border-brand-gray-200 bg-brand-gray-100/70 pl-3 pr-4 py-2 text-xs font-bold text-brand-gray-400 cursor-not-allowed"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gray-200 shadow-inner">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-gray-400" fill="currentColor">
            <path d="M9 21h6v-1.5H9V21Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Z" />
          </svg>
        </span>
        <span className="tracking-wide">Hint</span>
        <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-brand-gray-400 shadow-inner">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
            <path d="M12 2 4 10l8 12 8-12L12 2Z" />
          </svg>
          {cost}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-2 rounded-full border border-[#D4A96A]/40 bg-gradient-to-br from-[#fff8eb] to-[#ffe9c2] pl-3 pr-4 py-2 text-xs font-bold text-[#9d6a1f] shadow-[0_4px_14px_-6px_rgba(212,169,106,0.45)] hover:shadow-[0_6px_18px_-6px_rgba(212,169,106,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#F4D88B] to-[#D4A96A] shadow-inner">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor">
          <path d="M9 21h6v-1.5H9V21Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Z" />
        </svg>
      </span>
      <span className="tracking-wide">Hint</span>
      <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-[#5fb3af] shadow-inner">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M12 2 4 10l8 12 8-12L12 2Z" />
        </svg>
        {cost}
      </span>
    </button>
  );
}
