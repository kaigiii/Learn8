/**
 * 檔案名稱: types/lesson.ts
 * 功能描述: 課程核心型別定義 (Core Lesson Type Definitions)
 * 
 * 定義了前端與後端共用的資料結構，與後端 Pydantic Models 高度對應。
 * 
 * 主要型別:
 * - ComponentType: 所有支援的遊戲化組件名稱 (如 'LogicChain')。
 * - ModuleType: 學習模組分類 (Instruction, Practice, Assessment, Incentive)。
 * - LessonStage: 單一學習階段的完整設定結構 (包含 config, data, validation)。
 * - CoursePath & Unit & LessonNode: 課程大綱的層級結構。
 */
export type ComponentType =
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

export type LessonNodeStatus = 'locked' | 'available' | 'completed';

export interface LessonNode {
    id: string;
    title: string;
    description: string;
    status: LessonNodeStatus;
}

export interface Unit {
    unitId: string;
    unitTitle: string;
    unitDescription?: string;
    nodes: LessonNode[];
}

export interface CoursePath {
    id?: number;
    courseTitle: string;
    topic?: string;
    description?: string;
    units: Unit[];
}
