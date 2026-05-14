"use client";

import type { ReactNode } from "react";
import GameButton from "@/components/ui/GameButton";

interface QuestionActionBarProps {
  // Centralized Navigation Props
  onSkip?: () => void;
  onContinue?: () => void;
  isContinueDisabled?: boolean;
  continueLabel?: string;
  skipLabel?: string;

  // Custom Slots for specific buttons (e.g. Hint)
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  
  justify?: "between" | "end";
}

/**
 * QuestionActionBar - Centrally manages standard lesson navigation buttons.
 * Ensures consistent placement, styling, and labels (SKIP/CONTINUE) across all components.
 */
export function QuestionActionBar({
  onSkip,
  onContinue,
  isContinueDisabled = false,
  continueLabel = "CONTINUE",
  skipLabel = "SKIP",
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
      {/* Left Section: Skip Button + Custom Left Slots */}
      {justify === "between" && (
        <div className="flex items-end gap-3">
          {onSkip && (
            <GameButton variant="secondary" onClick={onSkip} className="min-w-[120px]">
              <span className="font-heading font-bold uppercase tracking-wide">{skipLabel}</span>
            </GameButton>
          )}
          {leftSlot}
        </div>
      )}

      {/* Right Section: Custom Right Slots + Continue Button */}
      <div className="flex items-center gap-3">
        {rightSlot}
        {onContinue && (
          <GameButton 
            variant="primary" 
            onClick={onContinue} 
            disabled={isContinueDisabled}
            className="min-w-[160px]"
          >
            <span className="font-heading font-bold uppercase tracking-wide">{continueLabel}</span>
          </GameButton>
        )}
      </div>
    </div>
  );
}
