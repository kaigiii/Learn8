import { LessonStage } from '@/types/lesson';

export const MOCK_GALLERY: LessonStage[] = [
    {
        stageId: 'gallery-2',
        topic: 'Logic Chain: Photosynthesis',
        component: 'LogicChain',
        skin: 'Classic',
        config: {
            data: {
                nodes: ["Sunlight hits Chloroplast", "Water splits (Photolysis)", "Oxygen released", "ATP produced", "Calvin Cycle starts"]
            },
            initialState: {}
        },
        validation: { type: 'exact', condition: {} },
        feedback: { success: "Correct sequence!", error: "Check the order." }
    } as any,
    {
        stageId: 'gallery-3',
        topic: 'Taxonomy Matrix: States of Matter',
        component: 'TaxonomyMatrix',
        skin: 'Classic',
        config: {
            data: {
                buckets: ["Solid", "Liquid", "Gas"],
                items: [
                    { id: "m1", content: "Ice Cube" },
                    { id: "m2", content: "Water Vapor" },
                    { id: "m3", content: "Orange Juice" },
                    { id: "m4", content: "Iron Bar" },
                    { id: "m5", content: "Helium" }
                ]
            },
            initialState: { assignments: {} }
        },
        validation: { type: 'exact', condition: {} },
        feedback: { success: "All classified correctly!", error: "Review the states." }
    } as any,
    {
        stageId: 'gallery-4',
        topic: 'Text Token: English Syntax',
        component: 'TextToken',
        skin: 'Classic',
        config: {
            data: {
                text: "The quick brown fox jumps over the lazy dog"
            },
            initialState: { order: [] }
        },
        validation: { type: 'exact', condition: {} },
        feedback: { success: "Perfect sentence structure!", error: "Grammar check failed." }
    } as any,
    {
        stageId: 'gallery-5',
        topic: 'Feynman Mirror: Explain Entropy',
        component: 'FeynmanMirror',
        skin: 'Scientific',
        config: {
            data: {},
            initialState: {}
        },
        validation: { type: 'logic', condition: {} },
        feedback: { success: "Great explanation!", error: "Try simpler terms." }
    } as any,
    {
        stageId: 'gallery-6',
        topic: 'Sequencer: Order of Operations',
        component: 'Sequencer',
        skin: 'Classic',
        config: {
            data: {
                steps: ["(3 + 5)", "Multiply by 2", "Subtract 4", "Result: 12"]
            },
            initialState: {}
        },
        validation: { type: 'exact', condition: {} },
        feedback: { success: "Correct PEMDAS!", error: "Check operation order." }
    } as any,
    {
        stageId: 'gallery-7',
        topic: 'Spatial Anatomy: Cell Structure',
        component: 'SpatialAnatomy',
        skin: 'Scientific',
        config: {
            data: {
                model: "cell-diagram",
                labels: [
                    { id: "nucleus", x: 50, y: 50, label: "Nucleus" },
                    { id: "mitochondria", x: 70, y: 30, label: "Mitochondria" },
                    { id: "membrane", x: 30, y: 80, label: "Cell Membrane" }
                ]
            },
            initialState: {}
        },
        validation: { type: 'exact', condition: { target: "nucleus" } },
        feedback: { success: "Correct region identified!", error: "Wrong location." }
    } as any,
    {
        stageId: 'gallery-8',
        topic: 'Dilemma Solver: The Trolley Problem',
        component: 'DilemmaSolver',
        skin: 'Classic',
        config: {
            data: {
                scenario: "A trolley is barreling towards 5 people. You can pull a lever to switch it to a track with 1 person.",
                options: [
                    { id: "pull", text: "Pull the lever (Sacrifice 1 to save 5)" },
                    { id: "nothing", text: "Do nothing (5 people die)" }
                ]
            },
            initialState: {}
        },
        validation: { type: 'logic', condition: { choice: "pull" } }, // Arbitrary "correct" for demo
        feedback: { success: "Utilitarian choice made.", error: "Deontological choice made." }
    } as any,
    {
        stageId: 'gallery-9',
        topic: 'Pattern Matcher: Math Functions',
        component: 'PatternMatcher',
        skin: 'Scientific',
        config: {
            data: {
                pairs: [
                    { id: "p1", left: "f(x) = x²", right: "f'(x) = 2x" },
                    { id: "p2", left: "f(x) = sin(x)", right: "f'(x) = cos(x)" },
                    { id: "p3", left: "f(x) = ln(x)", right: "f'(x) = 1/x" }
                ]
            },
            initialState: {}
        },
        validation: { type: 'exact', condition: {} },
        feedback: { success: "All pairs matched!", error: "Keep trying." }
    } as any
];
