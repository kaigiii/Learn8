/**
 * 檔案名稱: features/stage-player/api/learningService.ts
 * 功能描述: 學習與互動服務
 */
import { apiClient } from '@/lib/api-client';
import { LessonStage } from '@/types/lesson';

export interface SubmitResponse {
    message: string;
    nextAction: 'continue' | 'remedial' | 'complete';
    remedialStage?: LessonStage;
}

export const learningService = {
    submitAnswer: async (
        stageId: string,
        userInput: any,
        isCorrect: boolean,
        contextTopic: string,
        component: string
    ): Promise<SubmitResponse> => {
        const response = await apiClient.post('/lessons/submit-answer', {
            stageId,
            userInput,
            isCorrect,
            context_topic: contextTopic,
            component
        });
        return response.data;
    }
};
