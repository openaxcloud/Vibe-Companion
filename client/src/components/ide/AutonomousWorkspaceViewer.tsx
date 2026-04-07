/**
 * AutonomousWorkspaceViewer - Real-time WebSocket progress viewer
 * 
 * Displays autonomous workspace creation progress with streaming updates
 * Connected to backend via /ws/agent WebSocket endpoint
 * 
 * Architecture:
 * - Decodes bootstrap token (JWT)
 * - Connects to WebSocket /ws/agent?projectId=X&sessionId=Y
 * - Displays task progress, file creation, build logs in real-time
 * - Auto-closes on completion
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  FileCode, 
  Rocket, 
  Sparkles,
  Terminal,
  Package,
  Code2,
  PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutonomousWorkspaceViewerProps {
  bootstrapToken: string | null;
  projectId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface AgentMessage {
  type: 'task_start' | 'task_progress' | 'task_complete' | 'file_created' | 'build_log' | 'error' | 'complete' | 'status' | 'plan_chunk' | 'plan_generated' | 'connected';
  data?: any;
  message?: string;
  taskId?: string;
  taskName?: string;
  progress?: number;
  filePath?: string;
  content?: string;
  level?: 'info' | 'warn' | 'error';
  timestamp?: string;
  status?: string;
  plan?: any;
  phaseName?: string; // ✅ FIX (Dec 11, 2025): Phase name for UI display
}

interface Task {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
}

export function AutonomousWorkspaceViewer({
  bootstrapToken,
  projectId,
  onComplete,
  onError
}: AutonomousWorkspaceViewerProps) {
  const [isOpen, setIsOpen] = useState(!!bootstrapToken);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState<string>('Initializing workspace...');
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [planText, setPlanText] = useState<string>('');
  const [phase, setPhase] = useState<'planning' | 'executing' | 'complete'>('planning');
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // ✅ FIX (Dec 1, 2025): Track reconnect timer to clear on successful connection
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ✅ FIX (Dec 11, 2025): Track if user intentionally hid the dialog to prevent auto-reopen
  const userHiddenRef = useRef(false);
  
  // ✅ FIX (Dec 1, 2025): Use refs for callbacks to prevent WebSocket reconnection on re-renders
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  
  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);
  
  // ✅ FIX (Dec 10, 2025): Sync isOpen with bootstrapToken changes
  // This ensures the dialog opens when bootstrapToken becomes available after initial render
  // ✅ FIX (Dec 11, 2025): Don't auto-reopen if user intentionally hid the dialog
  useEffect(() => {
    if (bootstrapToken && !isOpen && !isComplete && !userHiddenRef.current) {
      setIsOpen(true);
    }
  }, [bootstrapToken, isOpen, isComplete]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Decode bootstrap token to extract session info (base64url-safe)
  const decodeToken = (token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Base64url decode: replace URL-safe chars and add padding
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) {
          throw new Error('Invalid base64url string');
        }
        base64 += new Array(5 - pad).join('=');
      }
      
      const payload = JSON.parse(atob(base64));
      return {
        projectId: payload.projectId,
        sessionId: payload.sessionId,
        userId: payload.userId
      };
    } catch {
      return null;
    }
  };

  // Connect to WebSocket
  useEffect(() => {
    if (!bootstrapToken || !isOpen) {
      return;
    }

    const tokenData = decodeToken(bootstrapToken);
    if (!tokenData) {
      setErrorMessage('Invalid bootstrap token');
      setConnectionStatus('error');
      onErrorRef.current?.('Invalid bootstrap token');
      return;
    }

    const connectWebSocket = () => {
      // Determine WebSocket protocol based on current protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // ✅ FIX (Dec 5, 2025): DO NOT include bootstrap token in WebSocket URL
      // PROBLEM: Long JWT tokens cause "Invalid frame header" errors on mobile
      // SOLUTION: Use only projectId and sessionId - the session is already authenticated
      const wsUrl = `${protocol}//${window.location.host}/ws/agent?projectId=${tokenData.projectId}&sessionId=${tokenData.sessionId}`;
      
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (error) {
        setConnectionStatus('error');
        addLog(`❌ Failed to create WebSocket: ${(error as Error).message}`);
        setErrorMessage(`WebSocket construction failed: ${(error as Error).message}`);
        return;
      }
      
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        // ✅ FIX (Dec 1, 2025): Clear reconnect timer on successful connection to prevent duplicate sockets
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        addLog('✅ Connected to AI Agent workspace builder');
      };

      ws.onmessage = (event) => {
        try {
          const message: AgentMessage = JSON.parse(event.data);
          handleAgentMessage(message);
        } catch (e) {
          addLog(`❌ Parse error: ${e}`);
        }
      };

      ws.onerror = (event) => {
        setConnectionStatus('error');
        // ✅ FIX (Dec 1, 2025): Log more details about WebSocket errors
        // Browser WebSocket error events don't expose much detail, but we can log state
        const wsState = ws.readyState;
        const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        addLog(`❌ Connection error (state: ${stateNames[wsState] || wsState})`);
      };

      ws.onclose = (event) => {
        setConnectionStatus('closed');
        
        // Attempt reconnection if not graceful close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && !isComplete) {
          reconnectAttempts.current++;
          addLog(`🔄 Reconnecting... (Attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          // ✅ FIX (Dec 1, 2025): Store timer reference for cleanup
          reconnectTimerRef.current = setTimeout(connectWebSocket, 2000 * reconnectAttempts.current);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          addLog('❌ Max reconnection attempts reached');
          setErrorMessage('Connection lost. Please refresh the page.');
          onErrorRef.current?.('Connection lost');
        }
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      // ✅ FIX (Dec 1, 2025): Clear reconnect timer on cleanup
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
    // ✅ FIX (Dec 1, 2025): Removed onError from dependencies - using ref instead
  }, [bootstrapToken, isOpen]);

  // Handle agent messages
  const handleAgentMessage = (message: AgentMessage) => {
    switch (message.type) {
      // ✅ FIX (Dec 1, 2025): Handle 'connected' message from server
      case 'connected':
        addLog('🔌 Connected to AI agent');
        setOverallProgress(5); // Show initial progress
        break;

      case 'status':
        // ✅ FIX (Dec 11, 2025): Use phaseName and progress from server for real-time updates
        // This ensures the UI displays exactly what the backend sends
        if (message.status === 'waiting_for_plan') {
          setPhase('planning');
          setCurrentTask(message.phaseName || 'Waiting for AI');
          setOverallProgress(message.progress ?? 8);
          addLog('⏳ Waiting for AI to begin planning...');
        } else if (message.status === 'planning') {
          setPhase('planning');
          setCurrentTask(message.phaseName || 'Planning started');
          setOverallProgress(message.progress ?? 15);
          addLog('🧠 AI is analyzing your request...');
        } else if (message.status === 'executing') {
          setPhase('executing');
          setCurrentTask(message.phaseName || 'Tasks starting');
          setOverallProgress(message.progress ?? 35);
        } else if (message.status === 'in_progress') {
          // Handle in_progress status with server-sent progress
          setPhase('executing');
          setCurrentTask(message.phaseName || 'Building...');
          if (message.progress !== undefined) {
            setOverallProgress(message.progress);
          }
        }
        if (message.message && message.status !== 'waiting_for_plan') {
          addLog(`📌 ${message.message}`);
        }
        break;

      case 'plan_chunk':
        if (message.data?.content) {
          setPlanText(prev => prev + message.data.content);
          // ✅ FIX (Dec 11, 2025): Update progress during planning (15-30%)
          setOverallProgress(prev => Math.min(30, prev + 0.5));
        }
        break;

      case 'plan_generated':
        if (message.plan) {
          setGeneratedPlan(message.plan);
          const taskCount = message.plan.tasks?.length || 0;
          addLog(`📋 Plan generated with ${taskCount} tasks`);
          if (message.plan.summary) {
            addLog(`📝 ${message.plan.summary}`);
          }
          if (message.plan.technologies?.length) {
            addLog(`🔧 Technologies: ${message.plan.technologies.join(', ')}`);
          }
          // ✅ FIX (Dec 11, 2025): Set proper phase name when plan is generated
          setPhase('executing');
          setCurrentTask('Plan generated');
          setOverallProgress(35); // Plan complete, starting execution
        }
        break;

      case 'task_start':
        if (message.taskId && message.taskName) {
          setTasks(prev => {
            const newTasks = [...prev, {
              id: message.taskId!,
              name: message.taskName!,
              status: 'in_progress' as const
            }];
            // ✅ FIX (Dec 11, 2025): Update progress when tasks start (35-95%)
            const totalTasks = generatedPlan?.tasks?.length || newTasks.length;
            const startedTasks = newTasks.length;
            const progressFromTasks = 35 + (startedTasks / totalTasks) * 30; // 35-65%
            setOverallProgress(Math.min(65, progressFromTasks));
            return newTasks;
          });
          setCurrentTask(message.taskName);
          addLog(`🚀 Starting: ${message.taskName}`);
        } else if (message.message) {
          addLog(`🚀 ${message.message}`);
        }
        break;

      case 'task_progress':
        if (message.taskId) {
          setTasks(prev => prev.map(task => 
            task.id === message.taskId 
              ? { ...task, progress: message.progress }
              : task
          ));
          // ✅ FIX (Dec 11, 2025): Update overall progress during task execution
          if (message.progress !== undefined) {
            setOverallProgress(prev => Math.min(90, prev + 0.2));
          }
          if (message.message) {
            addLog(`⏳ ${message.message}`);
          }
        }
        break;

      case 'task_complete':
        if (message.taskId) {
          setTasks(prev => {
            const updatedTasks = prev.map(task => 
              task.id === message.taskId 
                ? { ...task, status: 'completed' as const, progress: 100 }
                : task
            );
            // ✅ FIX (Dec 11, 2025): Calculate progress based on completed tasks (65-95%)
            const completed = updatedTasks.filter(t => t.status === 'completed').length;
            const total = generatedPlan?.tasks?.length || updatedTasks.length;
            if (total > 0) {
              const progressFromTasks = 65 + (completed / total) * 30; // 65-95%
              setOverallProgress(Math.min(95, progressFromTasks));
            }
            return updatedTasks;
          });
          addLog(`✅ Completed: ${message.taskName || message.taskId}`);
        }
        break;

      case 'file_created':
        if (message.filePath) {
          addLog(`📄 Created: ${message.filePath}`);
        }
        break;

      case 'build_log':
        if (message.content) {
          const icon = message.level === 'error' ? '❌' : message.level === 'warn' ? '⚠️' : '📋';
          addLog(`${icon} ${message.content}`);
        }
        break;

      case 'error':
        const errorMsg = message.message || 'Unknown error occurred';
        setErrorMessage(errorMsg);
        addLog(`❌ Error: ${errorMsg}`);
        onErrorRef.current?.(errorMsg);
        break;

      case 'complete':
        setIsComplete(true);
        setPhase('complete');
        setOverallProgress(100);
        setCurrentTask('Workspace ready! 🎉');
        addLog('🎉 Workspace creation complete!');
        addLog('✨ Your application is ready to use');
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
        break;
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // ✅ FIX (Dec 11, 2025): Separate hide (just closes dialog) from close (stops process)
  const handleHide = () => {
    userHiddenRef.current = true; // Prevent auto-reopen from useEffect
    setIsOpen(false);
    // Keep WebSocket running - user can reopen to see progress
  };

  const handleClose = () => {
    userHiddenRef.current = false; // Reset on close
    setIsOpen(false);
    if (wsRef.current) {
      wsRef.current.close(1000, 'User closed dialog');
    }
    onCompleteRef.current?.();
  };

  // Reopen the dialog to show progress again
  const handleShowProgress = () => {
    userHiddenRef.current = false; // Clear the hidden flag when user wants to see progress
    setIsOpen(true);
  };

  if (!bootstrapToken) {
    // ✅ CRITICAL DEBUG: Return a visible indicator when token is missing
    return (
      <div data-testid="autonomous-workspace-no-token" className="hidden">
        AutonomousWorkspaceViewer: No bootstrap token
      </div>
    );
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => {
      // ✅ FIX (Dec 11, 2025): Use handleHide instead of handleClose to keep process running
      setIsOpen(open);
      // Don't call handleClose here - just hide the dialog, process continues
    }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[98vw] sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[85vh] flex flex-col p-3 sm:p-6 overflow-y-auto bg-[var(--ecode-surface)] border-[var(--ecode-border)]" data-testid="autonomous-workspace-viewer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-[15px] text-[var(--ecode-text)]">
            {isComplete ? (
              <>
                <div className="p-1 rounded-md bg-emerald-500/15"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 flex-shrink-0" /></div>
                <span className="truncate">Workspace Ready!</span>
              </>
            ) : errorMessage ? (
              <>
                <div className="p-1 rounded-md bg-red-500/15"><XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 flex-shrink-0" /></div>
                <span className="truncate">Workspace Creation Failed</span>
              </>
            ) : (
              <>
                <div className="p-1 rounded-md bg-[var(--ecode-accent)]/15"><Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--ecode-accent)] animate-pulse flex-shrink-0" /></div>
                <span className="truncate">Building Your Workspace with AI...</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-[13px] text-[var(--ecode-text-muted)]">
            {isComplete 
              ? 'Your AI-powered workspace has been created successfully!'
              : errorMessage
              ? 'An error occurred during workspace creation'
              : 'The AI agent is autonomously creating your project, files, and starting the preview'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-[11px] sm:text-[13px]">
          <div className={cn(
            "h-2 w-2 rounded-full flex-shrink-0",
            connectionStatus === 'connected' && "bg-emerald-400 animate-pulse",
            connectionStatus === 'connecting' && "bg-amber-400 animate-pulse",
            connectionStatus === 'error' && "bg-red-400",
            connectionStatus === 'closed' && "bg-[var(--ecode-text-muted)]"
          )} />
          <span className="text-[var(--ecode-text-muted)] truncate">
            {connectionStatus === 'connected' && 'Connected'}
            {connectionStatus === 'connecting' && 'Connecting...'}
            {connectionStatus === 'error' && 'Connection Error'}
            {connectionStatus === 'closed' && 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={cn(
            "text-[10px]",
            phase === 'planning' && "bg-[var(--ecode-accent)]/15 text-[var(--ecode-accent)] border-[var(--ecode-accent)]/30",
            phase === 'executing' && "bg-blue-500/15 text-blue-400 border-blue-500/30",
            phase === 'complete' && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          )}>
            {phase === 'planning' ? '🧠 Planning' : phase === 'executing' ? '⚡ Executing' : '✅ Complete'}
          </Badge>
          {generatedPlan && (
            <span className="text-[11px] text-[var(--ecode-text-muted)]">
              {generatedPlan.tasks?.length || 0} tasks • {generatedPlan.estimatedTime || 'Calculating...'}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] sm:text-[13px] gap-2">
            <span className="font-medium truncate flex-1 min-w-0 text-[var(--ecode-text)]">{currentTask}</span>
            <span className="text-[var(--ecode-accent)] font-semibold flex-shrink-0">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--ecode-surface-secondary)] overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[var(--ecode-accent)] to-[var(--ecode-accent-hover)] transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
              data-testid="overall-progress"
            />
          </div>
        </div>

        {phase === 'planning' && (
          <div className="space-y-2 min-h-0">
            <h4 className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2 text-[var(--ecode-text-secondary)] py-1">
              <Code2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-[var(--ecode-accent)]" />
              <span>Generating Plan...</span>
              {!planText && <Loader2 className="h-3 w-3 animate-spin text-[var(--ecode-accent)]" />}
            </h4>
            <ScrollArea className="h-32 sm:h-40 md:h-48 rounded-lg bg-[#0e1525] border border-[var(--ecode-border)] font-mono text-[10px] sm:text-[11px]">
              <div className="p-2 sm:p-3 text-[var(--ecode-text-secondary)] whitespace-pre-wrap break-words">
                {planText || 'Analyzing your request and generating an execution plan...'}
                <span className="inline-block w-2 h-3 sm:h-4 bg-[var(--ecode-accent)] animate-pulse ml-0.5 rounded-sm" />
              </div>
            </ScrollArea>
          </div>
        )}

        {generatedPlan && phase !== 'planning' && (
          <div className="space-y-2 min-h-0">
            <h4 className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2 text-[var(--ecode-text-secondary)]">
              <FileCode className="h-3 w-3 sm:h-4 sm:w-4 text-[var(--ecode-accent)]" />
              Execution Plan
            </h4>
            <div className="text-[11px] text-[var(--ecode-text-muted)] border border-[var(--ecode-border)] rounded-lg p-2 bg-[var(--ecode-surface-secondary)]">
              <p className="font-medium text-[var(--ecode-text)]">{generatedPlan.summary}</p>
              {generatedPlan.technologies?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {generatedPlan.technologies.slice(0, 6).map((tech: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-[var(--ecode-border)] text-[var(--ecode-text-secondary)]">{tech}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="space-y-2 min-h-0">
            <h4 className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2 text-[var(--ecode-text-secondary)]">
              <Package className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-[var(--ecode-accent)]" />
              Tasks ({tasks.filter(t => t.status === 'completed').length}/{tasks.length})
            </h4>
            <ScrollArea className="h-20 sm:h-28 md:h-32 rounded-lg border border-[var(--ecode-border)] bg-[var(--ecode-surface-secondary)]">
              <div className="p-2 space-y-1">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 py-0.5 text-[11px] sm:text-[13px]" data-testid={`task-${task.id}`}>
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400 flex-shrink-0" />
                    ) : task.status === 'error' ? (
                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-400 flex-shrink-0" />
                    ) : task.status === 'in_progress' ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-[var(--ecode-accent)] animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full border-2 border-[var(--ecode-border)] flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate min-w-0 text-[var(--ecode-text-secondary)]">{task.name}</span>
                    {task.progress !== undefined && task.status === 'in_progress' && (
                      <span className="text-[10px] sm:text-[11px] text-[var(--ecode-accent)] flex-shrink-0">{task.progress}%</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="space-y-2 min-h-0">
          <h4 className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2 text-[var(--ecode-text-secondary)] py-1 sticky top-0 z-10">
            <Terminal className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-[var(--ecode-accent)]" />
            Activity Log ({Math.min(logs.length, 30)}{logs.length > 30 ? '+' : ''})
          </h4>
          <ScrollArea className="h-20 sm:h-24 md:h-28 rounded-lg border border-[var(--ecode-border)] bg-[#0e1525] font-mono text-[9px] sm:text-[11px]" data-testid="activity-logs">
            <div className="p-2 space-y-0.5">
              {logs.slice(-30).map((log, index) => (
                <div key={index} className="text-[var(--ecode-text-muted)] whitespace-pre-wrap break-words leading-tight">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 sm:p-3 text-[11px] sm:text-[13px] text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {isComplete ? (
            <Button onClick={handleClose} className="text-[11px] sm:text-[13px] bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white" data-testid="button-close">
              <Rocket className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Open Workspace</span>
              <span className="sm:hidden">Open</span>
            </Button>
          ) : errorMessage ? (
            <Button variant="outline" onClick={handleClose} className="text-[11px] sm:text-[13px] border-[var(--ecode-border)] text-[var(--ecode-text-secondary)]" data-testid="button-close-error">
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleHide} className="text-[11px] sm:text-[13px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]" data-testid="button-hide">
                <span>Hide Progress</span>
              </Button>
              <Button disabled className="text-[11px] sm:text-[13px] bg-[var(--ecode-accent)]/20 text-[var(--ecode-accent)] border-[var(--ecode-accent)]/30" data-testid="button-cancel">
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                Building...
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {!isOpen && !isComplete && !errorMessage && connectionStatus === 'connected' && (
      <Button
        onClick={handleShowProgress}
        className="fixed bottom-4 right-4 z-50 shadow-lg shadow-[var(--ecode-accent)]/20 gap-2 bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
        size="sm"
        data-testid="button-show-progress"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Building... {Math.round(overallProgress)}%</span>
      </Button>
    )}
  </>
  );
}

// Default export for React.lazy() compatibility
export default AutonomousWorkspaceViewer;
