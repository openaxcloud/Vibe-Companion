/**
 * Hook to integrate autonomous workspace WebSocket events with chat messages
 * 
 * Converts autonomous workspace progress events into inline chat messages
 * for a Replit-style inline chat experience
 * 
 * Also updates the shared autonomousBuildStore for PreviewPanel splash screens
 */

import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAgentConversationStore } from '@/stores/agentConversationStore';
import { useAutonomousBuildStore } from '@/stores/autonomousBuildStore';
import { useSchemaWarmingStore } from '@/stores/schemaWarmingStore';
import { AgentEventBus } from '@/lib/agentEvents';
import { queryClient } from '@/lib/queryClient';
import type { Message, AutonomousWorkspacePayload, AutonomousBuildTask } from '@/stores/agentConversationStore';
import type { AutonomousBuildPhase } from '@/stores/autonomousBuildStore';

interface AutonomousProgressEvent {
  type: 'planning' | 'plan_ready' | 'awaiting_approval' | 'executing' | 'step_update' | 'complete' | 'error' | 'connected' | 'status' | 'plan_chunk' | 'plan_generated' | 'task_start' | 'task_progress' | 'task_complete' | 'step' | 'summary' | 'file_created' | 'command_output' | 'agent_message' | 'step_start' | 'step_complete' | 'checkpoint_created' | 'autonomous_timeline_event' | 'autonomous_checkpoint' | 'autonomous_task_list' | 'autonomous_preview' | 'autonomous_file_operation' | 'post_validation_start' | 'install_dependencies_start' | 'install_dependencies_complete' | 'verify_build_start' | 'verify_build_complete' | 'responsive_qa_start' | 'responsive_qa_complete';
  projectId?: number;
  sessionId?: string;
  status?: string;
  phaseName?: string;
  progress?: number;
  message?: string;
  taskId?: string;
  taskName?: string;
  plan?: any;
  // Direct step/summary payloads from server
  step?: {
    id: string;
    type: string;
    title: string;
    status?: string;
    details?: string[];
    output?: string;
  };
  summary?: {
    title?: string;
    content: string;
    filesCreated?: string[];
    filesModified?: string[];
  };
  filePath?: string;
  fileName?: string;
  content?: string;
  command?: string;
  output?: string;
  data?: {
    phase?: string;
    planTitle?: string;
    appType?: string;
    features?: string[];
    searchQuery?: string;
    currentTask?: string;
    progress?: number;
    tasks?: Array<{
      id: string;
      name: string;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      progress?: number;
    }>;
    planText?: string;
    buildMode?: 'design-first' | 'full-app';
    errorMessage?: string;
    content?: string;
    step?: {
      id: string;
      type: string;
      title: string;
      details?: string[];
    };
    stepTitle?: string;
    stepType?: string;
  };
  event?: {
    id: string;
    type: 'file_create' | 'file_edit' | 'file_delete' | 'command' | 'checkpoint' | 'info';
    title: string;
    description?: string;
    timestamp: string;
    filePath?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'error';
  };
  checkpoint?: {
    title: string;
    description?: string;
    number?: number;
    completedTasks?: number;
    totalTasks?: number;
    eta?: string;
  };
  taskList?: {
    title?: string;
    items: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      filePath?: string;
      duration?: number;
    }>;
    showProgress?: boolean;
    compact?: boolean;
  };
  preview?: {
    url?: string;
    title?: string;
    isLoading?: boolean;
    isLive?: boolean;
  };
  fileOperation?: {
    type: 'create' | 'update' | 'delete' | 'rename';
    filePath: string;
    language?: string;
    content?: string;
    linesAdded?: number;
    linesRemoved?: number;
  };
  timestamp?: string;
  success?: boolean;
  dependencies?: {
    installed: string[];
    failed: string[];
    total: number;
  };
  buildResult?: {
    success: boolean;
    errors?: string[];
    warnings?: string[];
  };
  qaResult?: {
    score: number;
    breakpoints: {
      name: string;
      width: number;
      passed: boolean;
      issues?: string[];
    }[];
    totalTests: number;
    passedTests: number;
  };
}

interface UseAutonomousChatIntegrationOptions {
  conversationId: number | null;
  projectId?: number;
  sessionId?: string | null;
  enabled?: boolean;
  bootstrapToken?: string | null;
  initialPrompt?: string | null;
}

function mapPhaseToSplashPhase(phase: string | undefined): AutonomousBuildPhase {
  switch (phase) {
    case 'planning':
    case 'waiting_for_plan':
      return 'planning';
    case 'scaffolding':
      return 'scaffolding';
    case 'building':
    case 'executing':
    case 'in_progress':
      return 'building';
    case 'styling':
      return 'styling';
    case 'finalizing':
      return 'finalizing';
    case 'complete':
    case 'completed':
      return 'complete';
    case 'error':
      return 'error';
    default:
      return 'planning';
  }
}

export function useAutonomousChatIntegration({
  conversationId: externalConversationId,
  projectId,
  sessionId,
  enabled = true,
  bootstrapToken,
  initialPrompt
}: UseAutonomousChatIntegrationOptions) {
  const addMessage = useAgentConversationStore(s => s.addMessage);
  const updateMessage = useAgentConversationStore(s => s.updateMessage);
  const setMessages = useAgentConversationStore(s => s.setMessages);
  const wsRef = useRef<WebSocket | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const planTextRef = useRef<string>('');
  const hasConnectedRef = useRef(false);
  // ✅ NEW (Jan 26, 2026): Track task list message ID for in-place updates (Fortune 500 UX)
  const taskListMessageIdRef = useRef<string | null>(null);
  const hasAddedUserPromptRef = useRef(false);
  const effectRanRef = useRef(false);
  const layoutEffectConnectedRef = useRef(false);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const connectFnRef = useRef<(() => void) | null>(null);
  
  // ✅ FIX (Jan 2026): Fortune 500-grade WebSocket stability for mobile bootstrap
  // Problem: On iOS WebView (Replit-Bonsai), inlineMode toggles cause transient `enabled` changes
  // that trigger React cleanup, disconnecting WebSocket at ~35% progress
  
  // Track if we're in an active bootstrap build
  const bootstrapActiveRef = useRef(false);
  
  // Track if build reached a terminal state (complete, error)
  const buildCompletedRef = useRef(false);
  
  // ✅ CRITICAL: Intentional teardown flag - set by unmount useLayoutEffect at end of hook
  // React cleanup runs in REVERSE order, so the last useLayoutEffect cleanup runs FIRST
  // This ensures intentionalTeardownRef is true before other cleanups check it
  const intentionalTeardownRef = useRef(false);
  
  // Previous enabled value to detect transitions
  const prevEnabledRef = useRef(enabled);
  
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    error: string | null;
    reconnectAttempt: number;
    maxReconnectAttempts: number;
  }>({
    isConnected: false,
    error: null,
    reconnectAttempt: 0,
    maxReconnectAttempts: 10
  });
  
  // Reconnection logic with exponential backoff
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewPollDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxReconnectAttempts = 10;
  const baseReconnectDelayMs = 1000; // 1 second initial delay, doubles each attempt
  
  // Generate a STABLE temporary conversation ID for autonomous bootstrap flow
  // This allows messages to be added to the store even before the backend provides a real ID
  // CRITICAL: Use projectId-based ID so messages persist across page refreshes
  const tempConversationIdRef = useRef<number | null>(null);
  if (!tempConversationIdRef.current && bootstrapToken && projectId) {
    // Use a negative projectId to avoid collision with real IDs but ensure stability
    // Same projectId will always get the same tempConversationId
    tempConversationIdRef.current = -projectId;
  }
  
  // Use external conversationId if available, otherwise use temp ID for bootstrap flow
  const conversationId = externalConversationId ?? tempConversationIdRef.current;

  // ✅ CRITICAL FIX (Dec 12, 2025): Resolve prompt from multiple sources
  // The prop might be null, but the prompt might be in sessionStorage
  // Priority: prop > URL param > sessionStorage
  const resolvedPrompt = useMemo(() => {
    if (initialPrompt) return initialPrompt;
    
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const promptFromUrl = urlParams.get('prompt');
    if (promptFromUrl) return promptFromUrl;
    
    // Check sessionStorage (bootstrap flow stores prompt here)
    if (projectId) {
      const promptFromSession = window.sessionStorage.getItem(`agent-prompt-${projectId}`);
      if (promptFromSession) return promptFromSession;
    }
    
    return null;
  }, [initialPrompt, projectId]);

  // 🔍 MOUNT TRACKING (useLayoutEffect): Runs synchronously BEFORE paint for early detection
  // This helps diagnose if the issue is useEffect timing vs component not committing
  useLayoutEffect(() => {
    isMountedRef.current = true;
    
    // Write to sessionStorage for mobile WebView debugging (useLayoutEffect timing)
    try {
      sessionStorage.setItem('autonomousChatEffect_layoutEffectRan', String(Date.now()));
    } catch (e) { /* ignore */ }
    
    return () => {
      isMountedRef.current = false;
      
      // Note: intentionalTeardownRef is set by the LAST useLayoutEffect (at end of hook)
      // which runs FIRST during unmount due to React's reverse cleanup order
      
      // 🆘 CLEANUP: Cancel any pending fallback timer on unmount
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      
      // Cleanup preview polling timers
      if (previewPollTimerRef.current) {
        clearInterval(previewPollTimerRef.current);
        previewPollTimerRef.current = null;
      }
      if (previewPollDelayRef.current) {
        clearTimeout(previewPollDelayRef.current);
        previewPollDelayRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('autonomousChatEffect_diagnosticRan', String(Date.now()));
    } catch (e) { /* ignore */ }
  }, []);

  // Decode bootstrap token to extract session info (memoized for use in both effects)
  const decodeTokenFn = useCallback((token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) return null;
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
  }, []);

  const connectionAttemptedForProjectRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    prevEnabledRef.current = enabled;
    
    if (!enabled && wsRef.current) {
      wsRef.current.close(1000, 'genuine-disable');
      wsRef.current = null;
      layoutEffectConnectedRef.current = false;
      hasConnectedRef.current = false;
      bootstrapActiveRef.current = false;
      intentionalTeardownRef.current = false;
      connectionAttemptedForProjectRef.current = null;
    }
    
    if (!enabled || !conversationId || !projectId) {
      return;
    }
    
    if (hasConnectedRef.current || layoutEffectConnectedRef.current) {
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    if (connectionAttemptedForProjectRef.current === projectId) {
      return;
    }
    connectionAttemptedForProjectRef.current = projectId;
    
    let wsProjectId = projectId;
    let wsSessionId = sessionId;
    
    if (bootstrapToken && (!wsProjectId || !wsSessionId)) {
      const tokenData = decodeTokenFn(bootstrapToken);
      if (tokenData) {
        wsProjectId = wsProjectId || tokenData.projectId;
        wsSessionId = wsSessionId || tokenData.sessionId;
      }
    }
    
    if (!wsProjectId) {
      return;
    }
    
    layoutEffectConnectedRef.current = true;
    if (bootstrapToken) {
      bootstrapActiveRef.current = true;
    }
    
    useAutonomousBuildStore.getState().startBuild({ 
      projectId: wsProjectId, 
      sessionId: wsSessionId || undefined, 
      conversationId 
    });
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();
    params.set('projectId', String(wsProjectId));
    if (wsSessionId) params.set('sessionId', wsSessionId);
    if (bootstrapToken) params.set('bootstrap', bootstrapToken);
    
    const wsUrl = `${protocol}//${window.location.host}/ws/agent?${params.toString()}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      hasConnectedRef.current = true;
      reconnectAttemptRef.current = 0;
      if (bootstrapToken) {
        bootstrapActiveRef.current = true;
        buildCompletedRef.current = false;
        taskListMessageIdRef.current = null;
      }
      setConnectionState({ isConnected: true, error: null, reconnectAttempt: 0, maxReconnectAttempts: 10 });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleProgressEventRef.current?.(data);
      } catch (err) {
      }
    };
    
    ws.onerror = () => {
      setConnectionState(prev => ({ ...prev, error: 'Connection error occurred' }));
    };
    
    ws.onclose = (event) => {
      hasConnectedRef.current = false;
      wsRef.current = null;
      
      // Emit disconnected event
      AgentEventBus.emit('agent:disconnected', { code: event.code, reason: event.reason });
      
      // Attempt reconnection with backoff (same logic as main effect)
      if (event.code !== 1000 && isMountedRef.current && reconnectAttemptRef.current < maxReconnectAttempts) {
        reconnectAttemptRef.current++;
        const delay = Math.min(baseReconnectDelayMs * Math.pow(2, reconnectAttemptRef.current - 1), 8000);
        setConnectionState(prev => ({ 
          ...prev, 
          isConnected: false, 
          error: null,
          reconnectAttempt: reconnectAttemptRef.current 
        }));
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && connectFnRef.current) {
            connectFnRef.current();
          }
        }, delay);
      } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        setConnectionState(prev => ({ 
          ...prev, 
          isConnected: false, 
          error: 'Maximum reconnection attempts reached. Click retry to try again.',
          reconnectAttempt: maxReconnectAttempts
        }));
      } else {
        setConnectionState(prev => ({ ...prev, isConnected: false }));
      }
    };
    
    return () => {
      // ✅ FIX (Jan 2026): Fortune 500-grade cleanup - NO TIMEOUT during active bootstrap
      // Problem: Any fixed timeout can be exceeded by iOS WebView stalls
      // Solution: NEVER close socket in cleanup during active bootstrap
      // Socket is ONLY closed by:
      //   1. Genuine disable (detected at start of new effect)
      //   2. Component unmount (intentionalTeardownRef=true)
      //   3. Build completion (buildCompletedRef=true)
      
      const wsReady = wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING;
      const isBootstrapActive = bootstrapActiveRef.current && 
        !buildCompletedRef.current && 
        bootstrapToken &&
        wsReady;
      
      // Telemetry for debugging
      
      // Always cleanup reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      const doCleanup = (reason: string) => {
        layoutEffectConnectedRef.current = false;
        if (wsRef.current) {
          wsRef.current.close(1000, `cleanup: ${reason}`);
          wsRef.current = null;
        }
        hasConnectedRef.current = false;
        bootstrapActiveRef.current = false;
        intentionalTeardownRef.current = false;
      };
      
      // ✅ CRITICAL: During active connection/bootstrap, NEVER close socket from cleanup
      // The socket will be closed by the new effect if it detects a genuine disable
      // This prevents the infinite re-render loop where:
      //   startBuild() → Zustand update → re-render → cleanup resets refs → re-connect → startBuild() → loop
      const isConnectionActive = layoutEffectConnectedRef.current && wsReady;
      if ((isBootstrapActive || isConnectionActive) && !intentionalTeardownRef.current) {
        return;
      }
      
      if (intentionalTeardownRef.current) {
        doCleanup('component-unmount');
      } else if (!wsReady) {
        doCleanup('ws-not-ready');
      }
    };
  }, [enabled, conversationId, projectId, sessionId, bootstrapToken, decodeTokenFn, maxReconnectAttempts, baseReconnectDelayMs]);

  // ✅ CRITICAL FIX (Dec 13, 2025): Add user's prompt IMMEDIATELY on hook init
  // This ensures the prompt is visible BEFORE WebSocket connects, not after
  // Solves: "Je dois voir mon prompt pas le message de bienvenu"
  // Uses setMessages to REPLACE any existing messages (like welcome message) with the user prompt
  useEffect(() => {
    if (!conversationId || !resolvedPrompt || hasAddedUserPromptRef.current) return;
    
    hasAddedUserPromptRef.current = true;
    const userPromptMsg: Message = {
      id: `user-prompt-${Date.now()}`,
      role: 'user',
      content: resolvedPrompt,
      timestamp: new Date(),
      type: 'text'
    };
    // Use setMessages to REPLACE messages, ensuring user prompt is FIRST
    // This clears any welcome message that may have been rehydrated from localStorage
    setMessages(conversationId, [userPromptMsg]);
  }, [conversationId, resolvedPrompt, setMessages]);

  const createAutonomousMessage = useCallback((
    type: Message['type'],
    content: string,
    payload: AutonomousWorkspacePayload
  ): Message => ({
    id: `autonomous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content,
    timestamp: new Date(),
    type,
    autonomousPayload: payload,
    isStreaming: payload.phase === 'planning' || payload.phase === 'executing'
  }), []);

  // Use ref to store handleProgressEvent to avoid dependency changes triggering re-connections
  const handleProgressEventRef = useRef<((event: AutonomousProgressEvent) => void) | null>(null);
  
  handleProgressEventRef.current = (event: AutonomousProgressEvent) => {
    if (!conversationId) return;

    // Get store state directly to avoid dependency on buildStore object
    const store = useAutonomousBuildStore.getState();
    const { type, data, status, phaseName, progress: eventProgress, message: eventMessage, taskId, taskName, plan } = event;
    
    switch (type) {
      case 'connected': {
        store.setPhase('planning');
        store.setCurrentTask('Connected to AI agent');
        store.setProgress(5);
        
        // Emit connected event for favicon/audio/notifications
        AgentEventBus.emit('agent:connected', { projectId, sessionId });
        AgentEventBus.emit('agent:status', { status: 'working', phase: 'planning' });
        
        // NOTE: User's initial prompt is now added IMMEDIATELY via useEffect (lines 204-220)
        // This ensures the prompt is visible before WebSocket connects
        
        // Add welcome message to chat
        const connectedMsg = createAutonomousMessage(
          'autonomous_working',
          '🔗 Connected to AI agent. Starting workspace creation...',
          {
            phase: 'planning',
            progress: 5
          }
        );
        addMessage(conversationId, connectedMsg);
        lastMessageIdRef.current = connectedMsg.id;
        break;
      }

      case 'status': {
        const splashPhase = mapPhaseToSplashPhase(status);
        store.setPhase(splashPhase);
        store.setCurrentTask(phaseName || eventMessage || 'Processing...');
        if (eventProgress !== undefined) {
          store.setProgress(eventProgress);
        }
        
        // Emit status event for favicon/audio/notifications
        AgentEventBus.emit('agent:status', { status: splashPhase, phase: status, progress: eventProgress });
        
        // Map splash phase to payload phase (AutonomousWorkspacePayload only accepts specific phases)
        const payloadPhase: 'planning' | 'awaiting_approval' | 'executing' | 'complete' | 'error' = 
          splashPhase === 'planning' ? 'planning' :
          splashPhase === 'complete' ? 'complete' :
          splashPhase === 'error' ? 'error' : 'executing';
        
        // Add status update message to chat (update existing if same phase, or add new)
        const statusContent = phaseName || eventMessage || `${splashPhase}...`;
        const statusMsg = createAutonomousMessage(
          'autonomous_working',
          statusContent,
          {
            phase: payloadPhase,
            progress: eventProgress || store.progress
          }
        );
        
        if (splashPhase === 'complete') {
          buildCompletedRef.current = true;
          bootstrapActiveRef.current = false;
          useSchemaWarmingStore.getState().markReady();
          AgentEventBus.emit('agent:preview-ready', { projectId });
        }
        
        // Update existing message or add new one based on phase changes
        if (lastMessageIdRef.current && splashPhase === store.phase) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: statusContent,
            autonomousPayload: { phase: payloadPhase, progress: eventProgress || store.progress }
          });
        } else {
          addMessage(conversationId, statusMsg);
          lastMessageIdRef.current = statusMsg.id;
        }
        break;
      }

      case 'planning': {
        store.setPhase('planning');
        store.setCurrentTask(data?.searchQuery ? `Searching for "${data.searchQuery}"...` : 'Analyzing your request...');
        
        const msg = createAutonomousMessage(
          'autonomous_working',
          data?.searchQuery ? `Searching for "${data.searchQuery}"...` : 'Analyzing your request...',
          {
            phase: 'planning',
            searchQuery: data?.searchQuery,
            appType: data?.appType
          }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'plan_chunk': {
        if (data?.content) {
          planTextRef.current += data.content;
          store.setPlan({ planText: planTextRef.current });
          store.setProgress(Math.min(30, store.progress + 0.5));
        }
        break;
      }

      case 'plan_generated': {
        if (plan) {
          const features = plan.tasks?.map((t: any) => t.description || t.name) || [];
          const planTitle = plan.summary || 'Generated Plan';
          store.setPlan({
            planTitle,
            featureList: features,
            planText: planTextRef.current
          });
          store.setPhase('scaffolding');
          store.setProgress(35);
          
          // Create rich inline plan card message
          const planMsg = createAutonomousMessage(
            'autonomous_plan',
            "I've created a plan for your app:",
            {
              phase: 'awaiting_approval',
              planTitle,
              featureList: features,
              planText: planTextRef.current,
              appType: plan.appType || 'web-app'
            }
          );
          addMessage(conversationId, planMsg);
          lastMessageIdRef.current = planMsg.id;
        }
        break;
      }

      case 'plan_ready': {
        store.setPhase('scaffolding');
        store.setPlan({
          planTitle: data?.planTitle || "I'll include the following features:",
          featureList: data?.features || []
        });
        
        const msg = createAutonomousMessage(
          'autonomous_plan',
          "I've created a plan for your app:",
          {
            phase: 'awaiting_approval',
            planTitle: data?.planTitle || "I'll include the following features:",
            appType: data?.appType,
            featureList: data?.features || [],
            planText: data?.planText
          }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'awaiting_approval': {
        const msg = createAutonomousMessage(
          'autonomous_build_options',
          'How would you like me to build this?',
          {
            phase: 'awaiting_approval',
            featureList: data?.features || []
          }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'task_start': {
        if (taskId && taskName) {
          const newTask: AutonomousBuildTask = {
            id: taskId,
            name: taskName,
            status: 'in_progress'
          };
          const updatedTasks = [...store.tasks, newTask];
          store.setTasks(updatedTasks);
          store.setCurrentTask(taskName);
          store.setPhase('building');
          
          // Create or update progress message
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              content: `Working on: ${taskName}`,
              isStreaming: true,
              autonomousPayload: {
                phase: 'executing',
                currentTask: taskName,
                progress: store.progress,
                tasks: updatedTasks
              }
            });
          } else {
            const msg = createAutonomousMessage(
              'autonomous_progress',
              `Working on: ${taskName}`,
              {
                phase: 'executing',
                currentTask: taskName,
                progress: store.progress,
                tasks: updatedTasks
              }
            );
            addMessage(conversationId, msg);
            lastMessageIdRef.current = msg.id;
          }
        }
        break;
      }

      case 'task_progress': {
        if (taskId && eventProgress !== undefined) {
          store.updateTask(taskId, { progress: eventProgress });
          
          // Update existing progress message
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              autonomousPayload: {
                phase: 'executing',
                currentTask: store.currentTask || undefined,
                progress: store.progress,
                tasks: store.tasks
              }
            });
          }
        }
        break;
      }

      case 'task_complete': {
        if (taskId) {
          store.updateTask(taskId, { status: 'completed', progress: 100 });
          const completedCount = store.tasks.filter(t => t.status === 'completed').length + 1;
          const totalTasks = store.tasks.length;
          let newProgress = store.progress;
          if (totalTasks > 0) {
            newProgress = Math.min(95, 35 + (completedCount / totalTasks) * 60);
            store.setProgress(newProgress);
          }
          
          // Update progress message with completed task
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              content: `Completed: ${taskName || taskId}`,
              autonomousPayload: {
                phase: 'executing',
                currentTask: `Completed: ${taskName || taskId}`,
                progress: newProgress,
                tasks: store.tasks
              }
            });
          }
        }
        break;
      }

      case 'executing':
      case 'step_update': {
        const tasks: AutonomousBuildTask[] = (data?.tasks || []).map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          progress: t.progress
        }));

        store.setPhase('building');
        store.setTasks(tasks);
        store.setCurrentTask(data?.currentTask || 'Building...');
        if (data?.progress !== undefined) {
          store.setProgress(data.progress);
        }
        if (data?.buildMode) {
          store.setBuildMode(data.buildMode);
        }

        if (lastMessageIdRef.current && type === 'step_update') {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: data?.currentTask || 'Building...',
            isStreaming: true,
            autonomousPayload: {
              phase: 'executing',
              progress: data?.progress || 0,
              currentTask: data?.currentTask,
              tasks,
              buildMode: data?.buildMode
            }
          });
        } else {
          const msg = createAutonomousMessage(
            'autonomous_progress',
            data?.currentTask || 'Starting build...',
            {
              phase: 'executing',
              progress: data?.progress || 0,
              currentTask: data?.currentTask,
              tasks,
              buildMode: data?.buildMode
            }
          );
          addMessage(conversationId, msg);
          lastMessageIdRef.current = msg.id;
        }
        break;
      }

      case 'complete': {
        store.setComplete();
        
        // ✅ FIX (Jan 2026): Mark build as completed - allows normal cleanup
        buildCompletedRef.current = true;
        bootstrapActiveRef.current = false;
        
        // Unlock preview/deploy tabs — schema warming gate not needed after build completes
        useSchemaWarmingStore.getState().markReady();
        
        // Auto-show preview panel immediately so user sees starting/building state
        AgentEventBus.emit('agent:preview-ready', { projectId });
        
        // Preview auto-start is handled by backend (agent-orchestrator fires startPreviewFromProject).
        // Frontend polls for preview readiness and invalidates cache so URL appears when available.
        if (projectId) {
          // Clear any existing poll timers before starting new ones
          if (previewPollTimerRef.current) {
            clearInterval(previewPollTimerRef.current);
            previewPollTimerRef.current = null;
          }
          if (previewPollDelayRef.current) {
            clearTimeout(previewPollDelayRef.current);
            previewPollDelayRef.current = null;
          }
          
          // Immediate first invalidation to reduce no-content flicker
          queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
          queryClient.invalidateQueries({ queryKey: ['/api/preview/url', String(projectId)] });
          
          const pollPreviewReady = () => {
            let attempts = 0;
            const maxAttempts = 15;
            const intervalMs = 2000;
            const timer = setInterval(async () => {
              attempts++;
              queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
              queryClient.invalidateQueries({ queryKey: ['/api/preview/url', String(projectId)] });
              
              try {
                const res = await fetch(`/api/preview/url?projectId=${projectId}`, { credentials: 'include' });
                if (res.ok) {
                  const data = await res.json();
                  if (data.previewUrl && (data.status === 'running' || data.status === 'static')) {
                    clearInterval(timer);
                    previewPollTimerRef.current = null;
                    return;
                  }
                }
              } catch {
                // Transient fetch error — continue polling
              }
              
              if (attempts >= maxAttempts) {
                clearInterval(timer);
                previewPollTimerRef.current = null;
                queryClient.invalidateQueries({ queryKey: ['/api/preview/url', projectId] });
                queryClient.invalidateQueries({ queryKey: ['/api/preview/url', String(projectId)] });
              }
            }, intervalMs);
            
            previewPollTimerRef.current = timer;
          };
          const delayTimer = setTimeout(pollPreviewReady, 1000);
          previewPollDelayRef.current = delayTimer;
        }
        
        // Emit complete event for favicon/audio/notifications
        AgentEventBus.emit('agent:complete', { projectId, sessionId });
        AgentEventBus.emit('agent:status', { status: 'complete' });
        
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: 'Build complete! Your app is ready.',
            isStreaming: false,
            autonomousPayload: {
              phase: 'complete',
              progress: 100
            }
          });
        } else {
          const msg = createAutonomousMessage(
            'autonomous_complete',
            'Build complete! Your app is ready.',
            { phase: 'complete', progress: 100 }
          );
          addMessage(conversationId, msg);
        }
        lastMessageIdRef.current = null;
        break;
      }

      case 'error': {
        const errorMsg = data?.errorMessage || eventMessage || 'An error occurred';
        store.setError(errorMsg);
        
        // ✅ FIX (Jan 2026): Mark build as completed (with error) - allows normal cleanup
        buildCompletedRef.current = true;
        bootstrapActiveRef.current = false;
        
        // Emit error event for favicon/audio/notifications
        AgentEventBus.emit('agent:error', { projectId, sessionId, message: errorMsg });
        AgentEventBus.emit('agent:status', { status: 'error' });

        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: errorMsg,
            isStreaming: false,
            status: 'error',
            autonomousPayload: {
              phase: 'error',
              errorMessage: errorMsg
            }
          });
        } else {
          const msg = createAutonomousMessage(
            'autonomous_error',
            errorMsg,
            { phase: 'error', errorMessage: errorMsg }
          );
          msg.status = 'error';
          addMessage(conversationId, msg);
        }
        lastMessageIdRef.current = null;
        break;
      }

      // Post-build validation events (Task 6: Build/Install/QA progress indicators)
      case 'post_validation_start': {
        store.setCurrentTask('Running post-build validation...');
        store.setPhase('finalizing');
        
        const msg = createAutonomousMessage(
          'autonomous_working',
          '🔍 Running post-build validation...',
          { phase: 'executing', progress: store.progress }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'install_dependencies_start': {
        store.setCurrentTask('Installing dependencies...');
        
        const msg = createAutonomousMessage(
          'autonomous_working',
          '📦 Installing dependencies...',
          { phase: 'executing', progress: store.progress }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'install_dependencies_complete': {
        const deps = event.dependencies;
        const success = event.success !== false && (!deps || deps.failed.length === 0);
        const statusIcon = success ? '✅' : '⚠️';
        const statusText = success 
          ? `${statusIcon} Dependencies installed successfully${deps ? ` (${deps.installed.length}/${deps.total})` : ''}`
          : `${statusIcon} Some dependencies failed to install${deps ? ` (${deps.failed.length} failed)` : ''}`;
        
        store.setCurrentTask(statusText);
        
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: statusText,
            isStreaming: false
          });
        }
        break;
      }

      case 'verify_build_start': {
        store.setCurrentTask('Verifying build...');
        
        const msg = createAutonomousMessage(
          'autonomous_working',
          '🔨 Verifying build...',
          { phase: 'executing', progress: store.progress }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'verify_build_complete': {
        const result = event.buildResult;
        const success = event.success !== false && (!result || result.success);
        const statusIcon = success ? '✅' : '❌';
        let statusText = success 
          ? `${statusIcon} Build verified successfully`
          : `${statusIcon} Build verification failed`;
        
        if (result?.errors?.length) {
          statusText += `\n\nErrors:\n${result.errors.slice(0, 3).map(e => `• ${e}`).join('\n')}`;
        }
        if (result?.warnings?.length) {
          statusText += `\n\nWarnings: ${result.warnings.length}`;
        }
        
        store.setCurrentTask(success ? 'Build verified' : 'Build failed');
        
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: statusText,
            isStreaming: false,
            status: success ? undefined : 'error'
          });
        }
        break;
      }

      case 'responsive_qa_start': {
        store.setCurrentTask('Running responsive QA...');
        
        const msg = createAutonomousMessage(
          'autonomous_working',
          '📱 Running responsive QA tests...',
          { phase: 'executing', progress: store.progress }
        );
        addMessage(conversationId, msg);
        lastMessageIdRef.current = msg.id;
        break;
      }

      case 'responsive_qa_complete': {
        const qa = event.qaResult;
        const score = qa?.score ?? 0;
        const scorePercent = Math.round(score * 100);
        const scoreIcon = scorePercent >= 80 ? '🟢' : scorePercent >= 50 ? '🟡' : '🔴';
        
        let statusText = `${scoreIcon} Responsive QA Score: ${scorePercent}%`;
        if (qa?.passedTests !== undefined && qa?.totalTests !== undefined) {
          statusText += ` (${qa.passedTests}/${qa.totalTests} tests passed)`;
        }
        
        if (qa?.breakpoints?.length) {
          statusText += '\n\n**Breakpoint Results:**\n';
          statusText += qa.breakpoints.map(bp => {
            const icon = bp.passed ? '✅' : '❌';
            let line = `${icon} ${bp.name} (${bp.width}px)`;
            if (!bp.passed && bp.issues?.length) {
              line += `: ${bp.issues[0]}`;
            }
            return line;
          }).join('\n');
        }
        
        store.setCurrentTask(`QA Score: ${scorePercent}%`);
        
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: statusText,
            isStreaming: false
          });
        }
        break;
      }

      // Handle step updates from workflow execution
      case 'step': {
        const stepData = event.step;
        if (stepData) {
          store.setCurrentTask(stepData.title || 'Processing step...');
          store.setPhase('building');
          
          // Update or create progress message
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              content: `📝 ${stepData.title}`,
              isStreaming: true,
              autonomousPayload: {
                phase: 'executing',
                currentTask: stepData.title,
                progress: store.progress
              }
            });
          } else {
            const msg = createAutonomousMessage(
              'autonomous_progress',
              `📝 ${stepData.title}`,
              {
                phase: 'executing',
                currentTask: stepData.title,
                progress: store.progress
              }
            );
            addMessage(conversationId, msg);
            lastMessageIdRef.current = msg.id;
          }
        }
        break;
      }

      // Handle summary updates (usually at end of phases)
      case 'summary': {
        const summaryData = event.summary;
        if (summaryData) {
          const content = summaryData.content || summaryData.title || 'Summary';
          
          // Create a new summary message
          const msg = createAutonomousMessage(
            'autonomous_progress',
            `📊 ${content}`,
            {
              phase: 'executing',
              currentTask: content,
              progress: store.progress
            }
          );
          addMessage(conversationId, msg);
          lastMessageIdRef.current = msg.id;
        }
        break;
      }

      // Handle file creation notifications
      case 'file_created': {
        const fileName = event.fileName || event.filePath;
        if (fileName) {
          // Emit file created event for notifications
          AgentEventBus.emit('agent:file-created', { filename: fileName, projectId });
          
          // Compute new progress BEFORE setting to store (avoid stale snapshot)
          const newProgress = Math.min(store.progress + 2, 95);
          store.setProgress(newProgress);
          
          // Update existing progress message with file creation info
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              content: `📄 Created: ${fileName}`,
              isStreaming: true,
              autonomousPayload: {
                phase: 'executing',
                currentTask: `Created: ${fileName}`,
                progress: newProgress
              }
            });
          } else {
            const msg = createAutonomousMessage(
              'autonomous_progress',
              `📄 Created: ${fileName}`,
              {
                phase: 'executing',
                currentTask: `Created: ${fileName}`,
                progress: newProgress
              }
            );
            addMessage(conversationId, msg);
            lastMessageIdRef.current = msg.id;
          }
        }
        break;
      }

      // Handle command output (terminal commands)
      case 'command_output': {
        const cmd = event.command;
        if (cmd) {
          if (lastMessageIdRef.current) {
            updateMessage(conversationId, lastMessageIdRef.current, {
              content: `💻 Running: ${cmd}`,
              isStreaming: true,
              autonomousPayload: {
                phase: 'executing',
                currentTask: `Running: ${cmd}`,
                progress: store.progress
              }
            });
          }
        }
        break;
      }

      // Handle agent messages (thinking/reasoning)
      case 'agent_message': {
        const msgContent = event.content || eventMessage;
        if (msgContent) {
          const msg = createAutonomousMessage(
            'autonomous_working',
            `💭 ${msgContent}`,
            {
              phase: 'executing',
              currentTask: msgContent,
              progress: store.progress
            }
          );
          addMessage(conversationId, msg);
        }
        break;
      }

      // Handle step_start from workflow engine
      case 'step_start': {
        const stepTitle = data?.stepTitle || data?.stepType || 'Working on step...';
        store.setPhase('building');
        store.setCurrentTask(stepTitle);
        
        // Update or create progress message
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: `🔧 ${stepTitle}`,
            isStreaming: true,
            autonomousPayload: {
              phase: 'executing',
              currentTask: stepTitle,
              progress: store.progress
            }
          });
        } else {
          const msg = createAutonomousMessage(
            'autonomous_progress',
            `🔧 ${stepTitle}`,
            {
              phase: 'executing',
              currentTask: stepTitle,
              progress: store.progress
            }
          );
          addMessage(conversationId, msg);
          lastMessageIdRef.current = msg.id;
        }
        break;
      }

      // Handle step_complete from workflow engine
      case 'step_complete': {
        const completedStep = data?.stepTitle || data?.stepType || 'Step';
        // Compute new progress BEFORE setting to store (avoid stale snapshot)
        const newProgress = Math.min(store.progress + 5, 95);
        store.setProgress(newProgress);
        
        // Update progress message with completed step using computed newProgress
        if (lastMessageIdRef.current) {
          updateMessage(conversationId, lastMessageIdRef.current, {
            content: `✅ Completed: ${completedStep}`,
            isStreaming: true,
            autonomousPayload: {
              phase: 'executing',
              currentTask: `Completed: ${completedStep}`,
              progress: newProgress
            }
          });
        }
        break;
      }

      // Handle checkpoint creation notifications - create inline chat card
      case 'checkpoint_created': {
        const checkpointData = event.checkpoint || (event as any);
        // ✅ FIX: Server emits checkpoint ID as `stepId` (string), not `id` or `checkpointId`
        // Priority: event.stepId > checkpointData.stepId > checkpointData.id > checkpointData.checkpointId
        const rawCheckpointId = (event as any).stepId || checkpointData.stepId || checkpointData.id || checkpointData.checkpointId;
        const checkpointId = rawCheckpointId ? (typeof rawCheckpointId === 'string' ? parseInt(rawCheckpointId, 10) : rawCheckpointId) : undefined;
        const aiSummary = checkpointData.aiSummary || checkpointData.summary || checkpointData.title;
        const filesCount = checkpointData.filesCount || checkpointData.fileCount;
        const createdAt = checkpointData.createdAt || event.timestamp || new Date().toISOString();
        const checkpointType = checkpointData.type || 'auto';
        
        if (checkpointId) {
          const checkpointMsg: Message = {
            id: `checkpoint-${checkpointId}-${Date.now()}`,
            role: 'assistant',
            content: aiSummary || `Checkpoint #${checkpointId} created`,
            timestamp: new Date(createdAt),
            type: 'auto_checkpoint_created',
            autoCheckpoint: {
              id: checkpointId,
              aiSummary,
              filesCount,
              createdAt,
              type: checkpointType
            }
          };
          addMessage(conversationId, checkpointMsg);
        } else {
        }
        break;
      }

      // ============================================================================
      // ✅ NEW: Replit Agent 2024 Inline Progress Messages (Dec 12, 2025)
      // These handlers convert WebSocket events into rich inline chat components
      // ============================================================================

      // Handle timeline event (file operations, commands, etc.)
      case 'autonomous_timeline_event': {
        const timelineEvent = event.event;
        if (timelineEvent) {
          // Create a new message with timeline payload
          const msg = createAutonomousMessage(
            'autonomous_timeline',
            `${timelineEvent.title}`,
            {
              phase: 'executing',
              progress: store.progress,
              timeline: {
                events: [timelineEvent],
                maxHeight: '200px'
              }
            }
          );
          addMessage(conversationId, msg);
        }
        break;
      }

      // Handle checkpoint milestone marker
      case 'autonomous_checkpoint': {
        const checkpointData = event.checkpoint;
        if (checkpointData) {
          const msg = createAutonomousMessage(
            'autonomous_checkpoint',
            `Checkpoint: ${checkpointData.title}`,
            {
              phase: 'executing',
              progress: store.progress,
              checkpoint: checkpointData
            }
          );
          addMessage(conversationId, msg);
        }
        break;
      }

      // Handle task list with progress
      // ✅ NEW (Jan 26, 2026): Update existing task list message in-place for Fortune 500 UX
      case 'autonomous_task_list': {
        const taskListData = event.taskList;
        if (taskListData) {
          if (taskListMessageIdRef.current) {
            // Update existing task list message in-place (no chat flooding)
            updateMessage(conversationId, taskListMessageIdRef.current, {
              autonomousPayload: {
                phase: 'executing',
                progress: store.progress,
                taskList: taskListData
              }
            });
          } else {
            // First task list message - create and track ID
            const msg = createAutonomousMessage(
              'autonomous_task_list',
              taskListData.title || 'Task Progress',
              {
                phase: 'executing',
                progress: store.progress,
                taskList: taskListData
              }
            );
            taskListMessageIdRef.current = msg.id;
            addMessage(conversationId, msg);
          }
        }
        break;
      }

      // Handle preview window update
      case 'autonomous_preview': {
        const previewData = event.preview;
        if (previewData) {
          const msg = createAutonomousMessage(
            'autonomous_preview',
            previewData.title || 'Preview',
            {
              phase: 'executing',
              progress: store.progress,
              preview: previewData
            }
          );
          addMessage(conversationId, msg);
        }
        break;
      }

      // Handle file operation notification
      case 'autonomous_file_operation': {
        const fileOp = event.fileOperation;
        if (fileOp) {
          // Emit file event for notifications
          if (fileOp.type === 'create') {
            AgentEventBus.emit('agent:file-created', { filename: fileOp.filePath, projectId });
          }
          
          const opIcon = fileOp.type === 'create' ? '📄' : 
                        fileOp.type === 'update' ? '✏️' : 
                        fileOp.type === 'delete' ? '🗑️' : '📝';
          
          const msg = createAutonomousMessage(
            'autonomous_file_operation',
            `${opIcon} ${fileOp.type}: ${fileOp.filePath}`,
            {
              phase: 'executing',
              progress: store.progress,
              fileOperation: {
                type: fileOp.type === 'update' ? 'edit' : fileOp.type === 'rename' ? 'move' : fileOp.type as 'create' | 'delete' | 'edit' | 'read' | 'move',
                path: fileOp.filePath,
                language: fileOp.language,
                linesChanged: (fileOp.linesAdded || 0) + (fileOp.linesRemoved || 0)
              }
            }
          );
          addMessage(conversationId, msg);
        }
        break;
      }
    }
  };

  // Decode bootstrap token to extract session info
  const decodeToken = useCallback((token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) return null;
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
  }, []);

  useEffect(() => {
    effectRanRef.current = true;
    
    if (layoutEffectConnectedRef.current || hasConnectedRef.current) {
      return;
    }
    
    if (!enabled || !conversationId || !projectId) {
      return;
    }
    
    if (connectionAttemptedForProjectRef.current === projectId) {
      return;
    }
    
    let wsProjectId = projectId;
    let wsSessionId = sessionId;
    
    if (bootstrapToken && (!wsProjectId || !wsSessionId)) {
      const tokenData = decodeToken(bootstrapToken);
      if (tokenData) {
        wsProjectId = wsProjectId || tokenData.projectId;
        wsSessionId = wsSessionId || tokenData.sessionId;
      }
    }
    
    if (!wsProjectId) {
      return;
    }
    
    connectionAttemptedForProjectRef.current = projectId;

    useAutonomousBuildStore.getState().startBuild({ 
      projectId: wsProjectId, 
      sessionId: wsSessionId || undefined, 
      conversationId 
    });

    layoutEffectConnectedRef.current = true;
    if (bootstrapToken) {
      bootstrapActiveRef.current = true;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();
    params.set('projectId', String(wsProjectId));
    if (wsSessionId) params.set('sessionId', wsSessionId);
    if (bootstrapToken) params.set('bootstrap', bootstrapToken);
    
    const wsUrl = `${protocol}//${window.location.host}/ws/agent?${params.toString()}`;

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          hasConnectedRef.current = true;
          reconnectAttemptRef.current = 0;
          setConnectionState({ isConnected: true, error: null, reconnectAttempt: 0, maxReconnectAttempts: 10 });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleProgressEventRef.current?.(data as AutonomousProgressEvent);
          } catch (err) {
          }
        };

        ws.onerror = () => {
          setConnectionState(prev => ({ ...prev, error: 'Connection error occurred' }));
        };

        ws.onclose = (event) => {
          hasConnectedRef.current = false;
          wsRef.current = null;
          
          AgentEventBus.emit('agent:disconnected', { code: event.code, reason: event.reason });
          
          if (event.code !== 1000 && reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            const delay = Math.min(baseReconnectDelayMs * Math.pow(2, reconnectAttemptRef.current - 1), 8000);
            setConnectionState(prev => ({ 
              ...prev, 
              isConnected: false, 
              error: null,
              reconnectAttempt: reconnectAttemptRef.current 
            }));
            
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
            setConnectionState(prev => ({ 
              ...prev, 
              isConnected: false, 
              error: 'Maximum reconnection attempts reached. Click retry to try again.',
              reconnectAttempt: maxReconnectAttempts
            }));
            useAutonomousBuildStore.getState().setError('Connection lost. Please refresh the page.');
          } else {
            setConnectionState(prev => ({ ...prev, isConnected: false }));
          }
        };
      } catch (err) {
        hasConnectedRef.current = false;
      }
    };

    connectFnRef.current = connectWebSocket;
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connectFnRef.current = null;
    };
  }, [enabled, conversationId, projectId, sessionId, bootstrapToken]);

  const sendBuildModeSelection = useCallback((mode: 'design-first' | 'full-app') => {
    useAutonomousBuildStore.getState().setBuildMode(mode);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'build_mode_selected',
        mode,
        projectId
      }));
    }
  }, [projectId]);

  const requestPlanChange = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'change_plan_request',
        projectId
      }));
    }
  }, [projectId]);

  // Manual reconnect function for retry button
  const manualReconnect = useCallback(() => {
    
    // Reset reconnect counter to allow fresh attempts
    reconnectAttemptRef.current = 0;
    setConnectionState(prev => ({ ...prev, error: null, reconnectAttempt: 0 }));
    
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect');
      wsRef.current = null;
    }
    
    // Trigger reconnect using stored connect function
    if (connectFnRef.current) {
      connectFnRef.current();
    }
  }, []);

  // ✅ FIX (Jan 2026): FINAL UNMOUNT HANDLER - Guarantees socket closure on component unmount
  // This MUST be the LAST useLayoutEffect in the hook
  // React cleanup runs in REVERSE declaration order, so this cleanup runs FIRST
  // This cleanup does TWO things:
  // 1. Set intentionalTeardownRef so other cleanups know this is unmount
  // 2. DIRECTLY close the socket here as a guarantee (defense in depth)
  useLayoutEffect(() => {
    return () => {
      // This cleanup runs FIRST during unmount (reverse order)
      intentionalTeardownRef.current = true;
      
      // ✅ GUARANTEE: Close socket directly here, don't rely on other cleanups
      // This ensures socket is closed even if other cleanup logic has edge cases
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'component-unmount-guarantee');
        } catch (e) {
        }
        wsRef.current = null;
      }
      
      // Reset connection flags
      layoutEffectConnectedRef.current = false;
      hasConnectedRef.current = false;
      bootstrapActiveRef.current = false;
    };
  }, []);

  return {
    sendBuildModeSelection,
    requestPlanChange,
    manualReconnect,
    isConnected: connectionState.isConnected,
    connectionError: connectionState.error,
    reconnectAttempt: connectionState.reconnectAttempt,
    maxReconnectAttempts: connectionState.maxReconnectAttempts,
    // Expose effective conversationId for parent components to use when displaying messages
    effectiveConversationId: conversationId,
    // Flag to indicate if we're using a temporary ID (for bootstrap flow)
    isUsingTempConversationId: conversationId !== null && conversationId < 0
  };
}

export default useAutonomousChatIntegration;
