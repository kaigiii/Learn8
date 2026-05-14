"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import GameButton from "@/components/ui/GameButton";

interface QuestionActionBarProps {
  // Centralized Navigation Props
  onSkip?: () => void | Promise<void>;
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
  const [isSkipping, setIsSkipping] = useState(false);
  const delayTimerRef = useRef<number | null>(null);

  // Clean up the delay timer if the component unmounts (stage advanced).
  useEffect(() => {
    return () => {
      if (delayTimerRef.current !== null) {
        window.clearTimeout(delayTimerRef.current);
      }
    };
  }, []);

  // Safety net: clear spinner after 1.5s so the button is never permanently stuck.
  useEffect(() => {
    if (!isSkipping) return;
    const id = window.setTimeout(() => setIsSkipping(false), 1500);
    return () => window.clearTimeout(id);
  }, [isSkipping]);

  const handleSkipClick = async () => {
    if (isSkipping || delayTimerRef.current !== null || !onSkip) return;
    // Show the spinner only if the transition takes >180ms; fast skips show nothing.
    delayTimerRef.current = window.setTimeout(() => {
      delayTimerRef.current = null;
      setIsSkipping(true);
    }, 180);
    try {
      await onSkip();
    } finally {
      if (delayTimerRef.current !== null) {
        window.clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      setIsSkipping(false);
    }
  };

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
            <GameButton
              variant="secondary"
              onClick={handleSkipClick}
              disabled={isSkipping}
              className="min-w-[120px]"
            >
              {isSkipping ? (
                <span className="inline-flex items-center justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                </span>
              ) : (
                <span className="font-heading font-bold uppercase tracking-wide">{skipLabel}</span>
              )}
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
