"use client";

import React, { useEffect } from 'react';
import { useJobStore } from '@/stores/useJobStore';

export const ProgressOverlay = () => {
    const { activeJobId, jobStatus, jobProgress, jobMessage, clearJob } = useJobStore();

    // Prevent rendering if not active
    if (!activeJobId || jobStatus === 'idle') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center">
                {/* Spinner / Icon */}
                <div className="mb-6 relative">
                    {jobStatus === 'failed' ? (
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center object-scale-down">
                            <span className="text-3xl">❌</span>
                        </div>
                    ) : jobStatus === 'completed' ? (
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-3xl">✅</span>
                        </div>
                    ) : (
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                    )}
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {jobStatus === 'failed' ? 'Operation Failed' : 'AI Processing'}
                </h3>

                <p className="text-slate-500 text-center mb-6 h-12 flex items-center justify-center">
                    {jobMessage || 'Initializing...'}
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${jobStatus === 'failed' ? 'bg-red-500' : jobStatus === 'completed' ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.max(5, jobProgress)}%` }}
                    ></div>
                </div>

                <div className="w-full flex justify-between text-xs font-medium text-slate-400">
                    <span className="uppercase">{jobStatus}</span>
                    <span>{jobProgress}%</span>
                </div>

                {jobStatus === 'failed' && (
                    <button
                        onClick={clearJob}
                        className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};
