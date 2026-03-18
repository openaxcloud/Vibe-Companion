import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AgentPanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AgentPanelErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6 bg-[var(--ide-panel)]">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-1">Agent Error</h3>
            <p className="text-xs text-[var(--ide-text-muted)] max-w-[200px]">
              {this.state.error?.message || 'Something went wrong with the AI agent.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
