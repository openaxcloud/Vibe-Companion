// @ts-nocheck
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  SentryErrorBoundary: React.ComponentType<any> | null;
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="alert" aria-live="assertive">
      <div className="max-w-md w-full px-6 py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-4">
          We encountered an unexpected error. Please try refreshing the page.
        </p>
        {error && (
          <pre className="text-[11px] text-left bg-muted p-3 rounded-md mb-4 overflow-auto max-h-32" aria-label="Error details">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={onReset} data-testid="button-error-retry">Try Again</Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            data-testid="button-error-refresh"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, SentryErrorBoundary: null };
  }

  componentDidMount() {
    import('@sentry/react').then((Sentry) => {
      if (Sentry.isInitialized()) {
        this.setState({ SentryErrorBoundary: Sentry.ErrorBoundary });
      }
    }).catch(() => {});
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    import('@sentry/react').then((Sentry) => {
      if (Sentry.isInitialized()) {
        Sentry.captureException(error, { extra: errorInfo });
      }
    }).catch(() => {});
    console.error('Error caught by boundary:', {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Unknown',
      stack: error?.stack || 'No stack trace',
      errorInfo: errorInfo?.componentStack || 'No component stack'
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    const { SentryErrorBoundary } = this.state;
    if (SentryErrorBoundary) {
      return (
        <SentryErrorBoundary
          fallback={({ error, resetError }: { error: Error; resetError: () => void }) => (
            <ErrorFallback error={error} onReset={resetError} />
          )}
        >
          {this.props.children}
        </SentryErrorBoundary>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
