/**
 * 檔案名稱: features/stage-player/components/ComponentRegistry.tsx
 * 功能描述: 組件註冊表 (Component Registry)
 * 
 * 這是 "Feature Slicing" 架構的核心部分，將後端回傳的字串 key (例如 'MultipleChoice')
 * 映射到實際的前端 React 組件。
 * 
 * 作用:
 * - 實現動態渲染: `StageRenderer` 根據 `stage.component` 名稱來查表並渲染。
 * - 擴充性: 新增遊戲類型時，只需在此處註冊，無需修改主要渲染邏輯。
 * 
 * 註冊組件:
 * - Assessment: MultipleChoice, FeynmanMirror
 * - Practice: Ordering, MatchingPairs
 */
import React from 'react';
import { LessonStage } from '@/types/lesson';
import { MatchingPairs } from './stages/practice/MatchingPairs';
import { FeynmanMirror } from './stages/assessment/FeynmanMirror';
import MultipleChoice from './stages/assessment/MultipleChoice';
import { Ordering } from './stages/practice/Ordering';
import { Button } from '@/components/ui/button';

export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
    'MatchingPairs': MatchingPairs,
    'MultipleChoice': MultipleChoice,
    'FeynmanMirror': FeynmanMirror,
    'Ordering': Ordering,
};

export const FallbackComponent = ({ stage, onSkip }: { stage: LessonStage, onSkip: () => void }) => (
    <div className="p-10 text-center flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-bold mb-2">{stage.topic}</h2>
        <div className="p-4 bg-orange-50 text-orange-600 rounded-lg mb-4">
            Component <strong>{stage.component}</strong> is no longer supported or is unavailable in this build.
        </div>
        <div className="p-4 bg-slate-100 rounded text-left font-mono text-sm max-w-lg mx-auto overflow-auto max-h-40 w-full">
            {JSON.stringify(stage.config, null, 2)}
        </div>
        <Button onClick={onSkip} className="mt-8">
            Skip Stage
        </Button>
    </div>
);
