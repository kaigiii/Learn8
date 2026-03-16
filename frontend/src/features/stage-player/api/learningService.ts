/**
 * 檔案名稱: features/stage-player/api/learningService.ts
 * 功能描述: 學習與互動服務
 */
import { apiClient } from '@/lib/api-client';
import { FailedStageRecord, LessonStage } from '@/types/lesson';

export interface SubmitResponse {
    message: string;
    nextAction: 'proceed' | 'review_later' | 'complete';
    remedialStage?: LessonStage;
}

export const learningService = {
    submitAnswer: async (
        stageId: string,
        userInput: any,
        isCorrect: boolean,
        contextTopic: string,
        component: string,
        failedStage?: LessonStage
    ): Promise<SubmitResponse> => {
        const response = await apiClient.post('/lessons/submit-answer', {
            stageId,
            userInput,
            isCorrect,
            context_topic: contextTopic,
            component,
            failedStage,
        });
        return response.data;
    },
    generateRemedialStages: async (
        topic: string,
        failedStages: FailedStageRecord[]
    ): Promise<LessonStage[]> => {
        const response = await apiClient.post('/lessons/generate-remedial-stages', {
            topic,
            failedStages,
        });
        return response.data;
    }
};
