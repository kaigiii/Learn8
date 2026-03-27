"use client";

import dynamic from "next/dynamic";
import { StageComponentLoading } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

const OrderingQuestion = dynamic(
  () => import("@/components/arena/OrderingQuestion"),
  { loading: () => <StageComponentLoading /> }
);

export function renderOrderingStage({
  stage,
  stageIdx,
  totalStages,
  onSubmitStage,
  onSkipStage,
}: ArenaStageRendererProps) {
  return (
    <OrderingQuestion
      key={`backend-order-${stageIdx}`}
      stage={stage}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      onSubmit={(input) => void onSubmitStage(stage, { order: input })}
      onSkip={() => void onSkipStage(stage)}
    />
  );
}

export const orderingPlugin: ArenaStagePlugin = {
  component: "Ordering",
  render: renderOrderingStage,
};
