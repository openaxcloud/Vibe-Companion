import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  level?: 'page' | 'component' | 'widget';
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class OptimizedErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error caught:', error, JSON.stringify({ componentStack: errorInfo.componentStack }));
    this.props.onError?.(error, errorInfo);

    const msg = error?.message || String(error) || '';
    const isChunkError = /Loading chunk|Failed to fetch dynamically imported|import.*failed|Loading CSS chunk/i.test(msg);
    if (isChunkError) {
      const key = 'ecode_chunk_reload';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 30000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level || 'component';

    if (level === 'widget') {
      return (
        <div className="flex items-center gap-2 p-2 text-xs text-[var(--ecode-text-muted)]">
          <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
          <span>Failed to load</span>
          <button onClick={this.handleRetry} className="underline hover:text-[var(--ecode-text)]">
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <div>
          <h3 className="text-sm font-medium text-[var(--ecode-text)]">Something went wrong</h3>
          <p className="text-xs text-[var(--ecode-text-muted)] mt-1 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={this.handleRetry}
          className="gap-1.5"
          data-testid="error-boundary-retry"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </Button>
      </div>
    );
  }
}
