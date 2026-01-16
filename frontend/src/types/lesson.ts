export type ComponentType =
    | 'VariableBalancer'
    | 'LogicChain'
    | 'TaxonomyMatrix'
    | 'TextToken'
    | 'FeynmanMirror'
    | 'Sequencer'
    | 'SpatialAnatomy'
    | 'DilemmaSolver'
    | 'PatternMatcher';

export type SkinType = 'Scientific' | 'Classic' | 'Code';

export type ValidationType = 'exact' | 'regex' | 'logic';

export type ModuleType = 'Instruction' | 'Practice' | 'Assessment' | 'Incentive';

export interface LessonStage {
    stageId: string;
    topic: string;
    module: ModuleType;
    component: ComponentType;
    skin: SkinType;
    config: {
        data: any;
        initialState: any;
    };
    validation: {
        type: ValidationType;
        condition: any;
    };
    feedback: {
        success: string;
        error: string;
    };
}

export type LessonNodeType = 'concept' | 'exercise' | 'quiz';

export interface LessonNode {
    id: string;
    title: string;
    description: string;
    type: LessonNodeType;
    status: 'locked' | 'available' | 'completed';
}

export interface Unit {
    unitId: string;
    unitTitle: string;
    nodes: LessonNode[];
}

export interface CoursePath {
    id?: number;
    courseTitle: string;
    units: Unit[];
}
