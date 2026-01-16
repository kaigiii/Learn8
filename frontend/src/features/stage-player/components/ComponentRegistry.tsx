import React from 'react';
import { LessonStage } from '@/types/lesson';
import { VariableBalancer } from './stages/practice/VariableBalancer';
import { LogicChain } from './stages/practice/LogicChain';
import { TaxonomyMatrix } from './stages/assessment/TaxonomyMatrix';
import { FeynmanMirror } from './stages/assessment/FeynmanMirror';
import TextToken from './stages/instruction/TextToken';
import { Sequencer } from './stages/practice/Sequencer';
import { SpatialAnatomy } from './stages/instruction/SpatialAnatomy';
import { DilemmaSolver } from './stages/incentive/DilemmaSolver';
import { PatternMatcher } from './stages/instruction/PatternMatcher';
import { Button } from '@/components/ui/button';

export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
    'VariableBalancer': VariableBalancer,
    'LogicChain': LogicChain,
    'TaxonomyMatrix': TaxonomyMatrix,
    'TextToken': TextToken,
    'FeynmanMirror': FeynmanMirror,
    'Sequencer': Sequencer,
    'SpatialAnatomy': SpatialAnatomy,
    'DilemmaSolver': DilemmaSolver,
    'PatternMatcher': PatternMatcher,
};

export const FallbackComponent = ({ stage, onSkip }: { stage: LessonStage, onSkip: () => void }) => (
    <div className="p-10 text-center flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-bold mb-2">{stage.topic}</h2>
        <div className="p-4 bg-orange-50 text-orange-600 rounded-lg mb-4">
            Component <strong>{stage.component}</strong> not found or coming soon.
        </div>
        <div className="p-4 bg-slate-100 rounded text-left font-mono text-sm max-w-lg mx-auto overflow-auto max-h-40 w-full">
            {JSON.stringify(stage.config, null, 2)}
        </div>
        <Button onClick={onSkip} className="mt-8">
            Skip Stage
        </Button>
    </div>
);
