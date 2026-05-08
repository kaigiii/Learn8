"use client";

import React from "react";
import { 
  FiList,
  FiHash,
  FiLayers,
  FiMessageSquare,
  FiBookOpen,
  FiCheckCircle
} from "react-icons/fi";
import MultipleChoiceQuestion from "@/components/lesson-session/MultipleChoiceQuestion";
import MatchingPairsQuestion from "@/components/lesson-session/MatchingPairsQuestion";
import OrderingQuestion from "@/components/lesson-session/OrderingQuestion";
import FeynmanQuestion from "@/components/lesson-session/FeynmanQuestion";
import ExplainerMediaCard from "@/components/lesson-session/ExplainerMediaCard";

interface ArenaQuestionPreviewProps {
  prompt: string;
  questionType?: string;
  options: any[];
  correctOptionId?: string;
  difficulty?: string;
  isCompact?: boolean;
}

const mapDifficulty = (d: string): "low" | "medium" | "high" | null => {
  const lower = d.toLowerCase();
  if (lower === "hard" || lower === "high") return "high";
  if (lower === "medium" || lower === "intermediate") return "medium";
  return "low";
};

export default function ArenaQuestionPreview({
  prompt,
  questionType = "MultipleChoice",
  options = [],
  correctOptionId,
  difficulty = "normal",
  isCompact = false,
}: ArenaQuestionPreviewProps) {
  const noop = (_arg?: any) => {};
  const asyncNoop = async () => true;
  const mappedDifficulty = mapDifficulty(difficulty);

  const renderContent = () => {
    switch (questionType) {
      case "MultipleChoice":
        return (
          <div className="scale-[0.85] origin-top-left w-[117%] -mb-[10%]">
            <MultipleChoiceQuestion
              hideChrome
              question={prompt}
              options={options}
              correctId={correctOptionId || ""}
              topic={prompt}
              difficulty={mappedDifficulty}
              stageIndex={0}
              totalStages={1}
              feedbackMsg={{ success: "Correct!", error: "Wrong answer.", hint: "" }}
              onComplete={noop}
              onHintUse={asyncNoop}
            />
          </div>
        );

      case "MatchingPairs": {
        const pairs = options.map((o, i) => ({
          id: String(i),
          left: o.left || "Side A",
          right: o.right || "Side B"
        }));
        return (
          <div className="scale-[0.7] origin-top-left w-[142%] -mb-[25%] -mt-4">
            <MatchingPairsQuestion
              hideChrome
              question={prompt}
              topic={prompt}
              difficulty={mappedDifficulty}
              stageIndex={0}
              totalStages={1}
              pairs={pairs}
              shuffledRightIds={pairs.map(p => p.id)}
              matched={pairs.map(p => p.id)} // Show as matched in preview
              matchedPairs={Object.fromEntries(pairs.map(p => [p.id, p.id]))}
              selectedLeftId={null}
              selectedRightId={null}
              wrongPair={null}
              hintPairId={null}
              hintUsed={false}
              allMatched={true}
              feedback="correct"
              onPickLeft={noop}
              onPickRight={noop}
              onHint={noop}
              onSubmit={noop}
              onSkip={noop}
            />
          </div>
        );
      }

      case "Ordering": {
        const mockStage = {
          stageId: "preview",
          topic: prompt,
          difficulty,
          questionType: "Ordering",
          config: {
            data: {
              steps: options.map(o => typeof o === 'string' ? o : o.text || o.content || "Step")
            }
          },
          feedback: { success: "", error: "" }
        } as any;
        return (
          <div className="scale-[0.8] origin-top-left w-[125%] -mb-[15%]">
            <OrderingQuestion
              hideChrome
              stage={mockStage}
              topic={prompt}
              difficulty={mappedDifficulty}
              stageIndex={0}
              totalStages={1}
              onSubmit={async (_items: string[]) => {}}
              onContinue={noop}
              onSkip={noop}
            />
          </div>
        );
      }

      case "FeynmanMirror":
        return (
          <div className="scale-[0.85] origin-top-left w-[117%] -mb-[10%]">
            <FeynmanQuestion
              hideChrome
              prompt={prompt}
              sampleAnswer="This is a sample model answer for the feynman mirror challenge."
              maxRounds={1}
              topic={prompt}
              difficulty={mappedDifficulty}
              stageIndex={0}
              totalStages={1}
              feedbackMsg={{ success: "Great job!", error: "Needs improvement.", hint: "Try using simpler terms." }}
              onSubmit={async () => ({ result: "correct", feedback: "Good preview!" })}
              onContinue={noop}
              onSkip={noop}
              onHintUse={asyncNoop}
            />
          </div>
        );

      case "ExplainerMedia":
        return (
          <div className="scale-[0.85] origin-top-left w-[117%] -mb-[10%]">
            <ExplainerMediaCard
              hideChrome
              title={prompt}
              explanation="This explainer provides deep context about the topic in your match pool."
              bullets={options?.[0]?.bullets || ["Key point one", "Key point two"]}
              topic={prompt}
              difficulty={mappedDifficulty}
              stageIndex={0}
              totalStages={1}
              onContinue={noop}
            />
          </div>
        );

      default:
        return <div className="text-brand-gray-400 italic">Preview not available for {questionType}</div>;
    }
  };

  const getTypeLabel = () => {
    switch (questionType) {
      case "MultipleChoice": return "Multiple Choice";
      case "MatchingPairs": return "Matching Pairs";
      case "Ordering": return "Ordering";
      case "FeynmanMirror": return "Feynman Mirror";
      case "ExplainerMedia": return "Instructional";
      default: return questionType;
    }
  };

  const getIcon = () => {
    switch (questionType) {
      case "MultipleChoice": return <FiList />;
      case "MatchingPairs": return <FiHash />;
      case "Ordering": return <FiLayers />;
      case "FeynmanMirror": return <FiMessageSquare />;
      case "ExplainerMedia": return <FiBookOpen />;
      default: return <FiList />;
    }
  };

  return (
    <div className={`rounded-xl border border-white/60 bg-white/40 p-3 shadow-inner ${isCompact ? "text-[10px]" : "text-xs"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-brand-teal text-[10px]">{getIcon()}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-teal/70">
              {getTypeLabel()}
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[8px] ${
          difficulty === "hard" ? "bg-rose-100 text-rose-600" : 
          difficulty === "medium" || difficulty === "intermediate" || difficulty === "high" ? "bg-amber-100 text-amber-600" : 
          "bg-emerald-100 text-emerald-600"
        }`}>
          {difficulty}
        </span>
      </div>

      {renderContent()}
    </div>
  );
}
