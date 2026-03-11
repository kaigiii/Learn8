import { create } from 'zustand';

interface JobState {
    activeJobId: string | null;
    jobStatus: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    jobProgress: number;
    jobMessage: string;
    setActiveJob: (jobId: string) => void;
    updateJobProgress: (status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled', progress: number, message: string) => void;
    clearJob: () => void;
}

export const useJobStore = create<JobState>()((set) => ({
    activeJobId: null,
    jobStatus: 'idle',
    jobProgress: 0,
    jobMessage: '',

    setActiveJob: (jobId) => set({
        activeJobId: jobId,
        jobStatus: 'pending',
        jobProgress: 0,
        jobMessage: 'Waiting for server...'
    }),

    updateJobProgress: (status, progress, message) => set({
        jobStatus: status,
        jobProgress: progress,
        jobMessage: message
    }),

    clearJob: () => set({
        activeJobId: null,
        jobStatus: 'idle',
        jobProgress: 0,
        jobMessage: ''
    }),
}));
