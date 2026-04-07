import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, WifiOff, LogIn, Bug, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ErrorCategory = 'network' | 'auth' | 'render' | 'chunk' | 'unknown';

interface ErrorClassification {
  category: ErrorCategory;
  title: string;
  description: string;
  icon: typeof AlertCircle;
  recoveryActions: RecoveryAction[];
  userFriendlyMessage: string;
}

interface RecoveryAction {
  label: string;
  icon: typeof RefreshCw;
  action: () => void;
  variant?: 'default' | 'outline' | 'destructive';
  testId: string;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  lastRetryAt: number | null;
  isInCooldown: boolean;
}

function classifyError(error: Error): ErrorClassification {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    name.includes('typeerror') && message.includes('failed to fetch')
  ) {
    return {
      category: 'network',
      title: 'Connection Problem',
      description: 'We couldn\'t reach the server. This might be a temporary issue.',
      icon: WifiOff,
      userFriendlyMessage: 'Check your internet connection and try again.',
      recoveryActions: [],
    };
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('session') ||
    message.includes('token')
  ) {
    return {
      category: 'auth',
      title: 'Authentication Required',
      description: 'Your session may have expired or you need to sign in.',
      icon: LogIn,
      userFriendlyMessage: 'Please sign in again to continue.',
      recoveryActions: [],
    };
  }

  if (
    message.includes('loading chunk') ||
    message.includes('dynamically imported module') ||
    message.includes('failed to load') ||
    message.includes('loading module') ||
    message.includes('empty error thrown while loading') ||
    message.includes('module load failed')
  ) {
    return {
      category: 'chunk',
      title: 'Loading Error',
      description: 'A part of the application failed to load. This often happens after updates.',
      icon: RefreshCw,
      userFriendlyMessage: 'Refreshing the page should fix this.',
      recoveryActions: [],
    };
  }

  if (
    name.includes('syntaxerror') ||
    name.includes('referenceerror') ||
    name.includes('typeerror') ||
    message.includes('render') ||
    message.includes('undefined is not') ||
    message.includes('null is not') ||
    message.includes('cannot read')
  ) {
    return {
      category: 'render',
      title: 'Display Error',
      description: 'Something went wrong while showing this content.',
      icon: Bug,
      userFriendlyMessage: 'Try refreshing or going back. If this keeps happening, let us know.',
      recoveryActions: [],
    };
  }

  return {
    category: 'unknown',
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred.',
    icon: AlertCircle,
    userFriendlyMessage: 'We\'ve logged this issue. Try refreshing the page.',
    recoveryActions: [],
  };
}

export class OptimizedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0,
      lastRetryAt: null,
      isInCooldown: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error caught:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleReset = () => {
    const now = Date.now();
    const cooldownMs = 2000;
    
    if (this.state.isInCooldown) {
      return;
    }
    
    if (this.state.lastRetryAt && now - this.state.lastRetryAt < cooldownMs) {
      return;
    }

    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: this.state.retryCount + 1,
      lastRetryAt: now,
      isInCooldown: true,
    });

    this.retryTimeoutId = setTimeout(() => {
      this.setState({ isInCooldown: false });
    }, cooldownMs);
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleSignIn = () => {
    window.location.href = '/login';
  };

  getRecoveryActions(classification: ErrorClassification): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (classification.category) {
      case 'network':
        actions.push(
          { label: 'Retry', icon: RefreshCw, action: this.handleReset, testId: 'button-retry' },
          { label: 'Refresh Page', icon: RefreshCw, action: this.handleRefresh, variant: 'outline', testId: 'button-refresh' }
        );
        break;
      case 'auth':
        actions.push(
          { label: 'Sign In', icon: LogIn, action: this.handleSignIn, testId: 'button-signin' },
          { label: 'Go Home', icon: Home, action: this.handleGoHome, variant: 'outline', testId: 'button-home' }
        );
        break;
      case 'chunk':
        actions.push(
          { label: 'Retry', icon: RefreshCw, action: this.handleReset, testId: 'button-retry' },
          { label: 'Refresh Page', icon: RefreshCw, action: this.handleRefresh, variant: 'outline', testId: 'button-refresh' }
        );
        break;
      case 'render':
        actions.push(
          { label: 'Try Again', icon: RefreshCw, action: this.handleReset, testId: 'button-retry' },
          { label: 'Go Back', icon: ArrowLeft, action: this.handleGoBack, variant: 'outline', testId: 'button-back' },
          { label: 'Go Home', icon: Home, action: this.handleGoHome, variant: 'outline', testId: 'button-home' }
        );
        break;
      default:
        actions.push(
          { label: 'Try Again', icon: RefreshCw, action: this.handleReset, testId: 'button-retry' },
          { label: 'Go Home', icon: Home, action: this.handleGoHome, variant: 'outline', testId: 'button-home' }
        );
    }

    return actions;
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const classification = this.state.error 
        ? classifyError(this.state.error) 
        : classifyError(new Error('Unknown error'));
      
      const Icon = classification.icon;
      const recoveryActions = this.getRecoveryActions(classification);
      const isCompact = this.props.level === 'component';

      if (isCompact) {
        return (
          <div 
            className="p-4 border border-destructive/20 rounded-lg bg-destructive/5"
            data-testid="error-boundary-compact"
          >
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">{classification.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{classification.userFriendlyMessage}</p>
                <div className="flex gap-2 mt-3">
                  {recoveryActions.slice(0, 2).map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={action.variant || 'default'}
                      onClick={action.action}
                      disabled={this.state.isInCooldown && action.action === this.handleReset}
                      className="text-[11px]"
                      data-testid={action.testId}
                    >
                      <action.icon className="h-3 w-3 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div 
          className="min-h-screen flex items-center justify-center p-4 bg-background"
          data-testid="error-boundary-page"
        >
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <Icon className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle>{classification.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {classification.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[13px] text-muted-foreground">
                {classification.userFriendlyMessage}
              </p>

              {this.state.retryCount > 2 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Persistent Issue</AlertTitle>
                  <AlertDescription>
                    This error keeps occurring. Try clearing your browser cache or contact support if it continues.
                  </AlertDescription>
                </Alert>
              )}

              {import.meta.env.DEV && this.state.error && (
                <Alert variant="destructive">
                  <AlertTitle>Developer Info</AlertTitle>
                  <AlertDescription className="mt-2">
                    <pre className="text-[11px] overflow-auto p-2 bg-black/10 rounded max-h-40">
                      {this.state.error.toString()}
                      {this.state.errorInfo && (
                        <>
                          {'\n\nComponent Stack:'}
                          {this.state.errorInfo.componentStack}
                        </>
                      )}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex flex-wrap gap-2">
                {recoveryActions.map((action, index) => (
                  <Button 
                    key={index}
                    onClick={action.action}
                    variant={action.variant || 'default'}
                    disabled={this.state.isInCooldown && action.action === this.handleReset}
                    className="flex items-center gap-2"
                    data-testid={action.testId}
                  >
                    <action.icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withAsyncErrorHandler<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ReactNode,
  level?: 'page' | 'component'
) {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = (props: P & { ref?: React.Ref<unknown> }) => {
    const { ref, ...rest } = props as P & { ref?: React.Ref<unknown> };
    return (
      <OptimizedErrorBoundary fallback={errorFallback} level={level}>
        <Component {...(rest as P)} ref={ref} />
      </OptimizedErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withAsyncErrorHandler(${displayName})`;
  return WrappedComponent;
}
