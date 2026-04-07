import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { devError } from '@/lib/dev-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for the AI Agent Panel.
 * Unlike the global ErrorBoundary, this shows a compact fallback
 * that fits within the panel area without disrupting the rest of the IDE.
 */
export class AgentPanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    const errorData = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Unknown',
      stack: error?.stack?.slice(0, 800),
      componentStack: errorInfo?.componentStack?.slice(0, 800)
    };
    console.error('[AgentPanelErrorBoundary] Error caught:', errorData);
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {});
    } catch {}
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="flex flex-col items-center justify-center h-full p-6 bg-background/95"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="h-10 w-10 text-yellow-500 mb-4" aria-hidden="true" />
          <h3 className="text-base font-semibold mb-2">AI Assistant Error</h3>
          <p className="text-[13px] text-muted-foreground text-center mb-4 max-w-xs">
            The AI assistant encountered an issue. Try restarting or refreshing the page.
          </p>
          {this.state.error && (
            <pre 
              className="text-[11px] text-left bg-muted p-2 rounded-md mb-4 overflow-auto max-h-20 max-w-full w-full"
              aria-label="Error details"
            >
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={this.handleRetry}
              data-testid="button-agent-retry"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AgentPanelErrorBoundary;
