/**
 * 檔案名稱: features/stage-player/components/StageErrorBoundary.tsx
 * 功能描述: Stage 播放器的錯誤邊界 (Error Boundary)
 *
 * 當任一個 Stage 組件在渲染時崩潰，此組件會攔截錯誤並顯示友善的錯誤訊息，
 * 避免整個播放器白屏。使用者可透過「跳過」按鈕繼續。
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    onSkip?: () => void;
    stageName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class StageErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[StageErrorBoundary] ${this.props.stageName || 'Unknown'} 組件崩潰:`, error, errorInfo);
    }

    // 當 children 變更（切換 Stage）時，重置錯誤狀態
    componentDidUpdate(prevProps: Props) {
        if (prevProps.children !== this.props.children && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 text-center flex flex-col items-center justify-center h-full gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">
                        組件載入失敗
                    </h2>
                    <p className="text-slate-500 max-w-md">
                        <strong>{this.props.stageName}</strong> 組件在渲染時發生錯誤。
                        你可以跳過此階段繼續學習。
                    </p>
                    <div className="p-3 bg-slate-100 rounded text-left font-mono text-xs max-w-lg mx-auto overflow-auto max-h-24 w-full text-red-600">
                        {this.state.error?.message}
                    </div>
                    {this.props.onSkip && (
                        <Button onClick={this.props.onSkip} className="mt-4">
                            跳過此階段
                        </Button>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
