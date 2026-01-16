/**
 * 檔案名稱: lib/mock-data.ts
 * 功能描述: 靜態模擬資料 (Static Mock Data)
 * 
 * 定義了各種類型 Lesson Stage 的範例資料，用於前端開發與測試。
 * 當後端尚未準備好或需要測試特定 UI 組件時，可直接使用此處的資料。
 * 
 * 包含組件範例:
 * - Instruction: SpatialAnatomy, TextToken, PatternMatcher
 * - Practice: VariableBalancer, LogicChain, Sequencer
 * - Assessment: TaxonomyMatrix, FeynmanMirror
 * - Incentive: DilemmaSolver
 */
import { LessonStage } from '@/types/lesson';

const BASE_STAGE: Partial<LessonStage> = {
    stageId: 'mock-1',
    topic: 'Mock Topic',
    skin: 'Scientific',
    validation: { type: 'exact', condition: {} },
    feedback: { success: 'Great job!', error: 'Try again.' }
};

export const MOCK_STAGES: Record<string, LessonStage> = {
    // --- Instruction ---
    'SpatialAnatomy': {
        ...BASE_STAGE,
        module: 'Instruction',
        component: 'SpatialAnatomy',
        config: {
            initialState: {},
            data: {
                imageUrl: "https://images.unsplash.com/photo-1559757602-24af1d70be53?auto=format&fit=crop&w=800&q=80",
                areas: [
                    { id: '1', label: 'Cortex', coords: [10, 10, 20, 20], description: 'Outer layer' },
                    { id: '2', label: 'Core', coords: [40, 40, 15, 15], description: 'Central region' }
                ]
            }
        }
    } as any,
    'TextToken': {
        ...BASE_STAGE,
        module: 'Instruction',
        component: 'TextToken',
        config: {
            initialState: {},
            data: {
                text: "The mitochondria is the powerhouse of the cell.",
                items: ["mitochondria", "powerhouse", "cell"]
            }
        }
    } as any,
    'PatternMatcher': {
        ...BASE_STAGE,
        module: 'Instruction',
        component: 'PatternMatcher',
        config: {
            initialState: {},
            data: {
                pairs: [
                    { id: '1', left: 'Hydrogen', right: 'H' },
                    { id: '2', left: 'Helium', right: 'He' },
                    { id: '3', left: 'Lithium', right: 'Li' }
                ]
            }
        }
    } as any,

    // --- Practice ---
    'VariableBalancer': {
        ...BASE_STAGE,
        module: 'Practice',
        component: 'VariableBalancer',
        config: {
            initialState: {},
            data: {
                variables: [
                    { name: "Pressure", min: 0, max: 100, default: 50, effect: "Higher pressure increases output" },
                    { name: "Temperature", min: 0, max: 100, default: 50, effect: "Optimal at 70" }
                ]
            }
        }
    } as any,
    'LogicChain': {
        ...BASE_STAGE,
        module: 'Practice',
        component: 'LogicChain',
        config: {
            initialState: {},
            data: {
                steps: [
                    { id: '1', content: "Identify the problem" },
                    { id: '2', content: "Formulate hypothesis" },
                    { id: '3', content: "Test hypothesis" }
                ]
            }
        }
    } as any,
    'Sequencer': {
        ...BASE_STAGE,
        module: 'Practice',
        component: 'Sequencer',
        config: {
            initialState: {},
            data: {
                steps: [
                    { id: '1', content: "Wake up" },
                    { id: '2', content: "Brush teeth" },
                    { id: '3', content: "Eat breakfast" }
                ]
            }
        }
    } as any,

    // --- Assessment ---
    'TaxonomyMatrix': {
        ...BASE_STAGE,
        module: 'Assessment',
        component: 'TaxonomyMatrix',
        config: {
            initialState: {},
            data: {
                buckets: ["Fruits", "Vegetables"],
                items: [
                    { id: '1', content: "Apple", correctBucket: "Fruits" },
                    { id: '2', content: "Carrot", correctBucket: "Vegetables" },
                    { id: '3', content: "Banana", correctBucket: "Fruits" }
                ]
            }
        }
    } as any,
    'FeynmanMirror': {
        ...BASE_STAGE,
        module: 'Assessment',
        component: 'FeynmanMirror',
        config: {
            initialState: {},
            data: {
                concept: "Gravity"
            }
        }
    } as any,

    // --- Incentive ---
    'DilemmaSolver': {
        ...BASE_STAGE,
        module: 'Incentive',
        component: 'DilemmaSolver',
        config: {
            initialState: {},
            data: {
                scenario: "A trolley is moving towards 5 people...",
                options: [
                    { id: '1', label: "Pull lever", consequence: "1 person dies, 5 saved" },
                    { id: '2', label: "Do nothing", consequence: "5 people die" }
                ]
            }
        }
    } as any
};
