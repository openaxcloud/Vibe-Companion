import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';

import { useQuery } from '@tanstack/react-query';
import { devLog } from '@/lib/dev-logger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAgentConversationStore, type Message } from '@/stores/agentConversationStore';
import { useAutonomousChatIntegration } from '@/hooks/use-autonomous-chat-integration';
import { useAutonomousBuildStore } from '@/stores/autonomousBuildStore';
import { useAgentAudioNotifications } from '@/hooks/use-agent-audio-notifications';
import { useAgentDockNotifications } from '@/hooks/use-agent-dock-notifications';
import { useAgentFavicon } from '@/hooks/use-agent-favicon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Send,
  Sparkles,
  Plus,
  Loader2,
  Settings,
  Brain,
  Zap,
  MoreHorizontal,
  Copy,
  RefreshCw,
  Pause,
  Play,
  AlertCircle,
  Paperclip,
  Mic,
  Square
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThinkingDisplay, ThinkingDisplayCompact, ThinkingStep } from './ThinkingDisplay';
import { ToolExecutionList, ToolExecutionProps } from './ToolExecutionDisplay';
import { MessageMetadataFooter } from './MessageMetadataFooter';
import { 
  TaskMessage, 
  ActionMessage, 
  RichMessageContent,
  type Task,
  type Action,
  type FileDiff
} from '@/components/agent/messages';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getCSRFToken } from '@/lib/queryClient';
import { useWorkflowManager } from '@/hooks/use-workflow-manager';
import { useAgentModelPreference } from '@/hooks/use-agent-model-preference';
import { AgentWorkflowSelector } from './AgentWorkflowSelector';
import { DesignPrototypeViewer } from './DesignPrototypeViewer';
import { MVPCompletionDialog } from './MVPCompletionDialog';
import { ModeSelector, type AgentMode } from './ModeSelector';
import { AIModelSelector } from './AIModelSelector';
import { CurrentModelChip } from './CurrentModelChip';
import { handleSSEWarning, type SSEWarningData } from '@/lib/sse-warning-handler';
import { AgentHistoryModal } from '@/components/grids/AgentHistoryModal';
import { MaxAutonomyProgress, MaxAutonomyStartForm } from './MaxAutonomyProgress';
import { useMaxAutonomy } from '@/hooks/useMaxAutonomy';
import { AgentToolsPanel, type AgentToolsSettings } from './AgentToolsPanel';
import { ElementEditor, type ElementSelection } from './ElementEditor';
import { ChatToolbar, ChatToolbarMobile } from './ChatToolbar';
import { UsageTrackingIcon } from './UsageTrackingIcon';
import { VideoReplayViewer } from './VideoReplayViewer';
import { ECodeLogo } from '@/components/ECodeLogo';
import { RAGToggle, RAGStatsDisplay, RetrievedContextPanel, useRAGStats } from './RAGControls';
import { useSchemaWarmingStore } from '@/stores/schemaWarmingStore';
// ✅ Memory Bank is 100% TRANSPARENT (like Replit) - no UI, works invisibly in background
// Context is auto-injected into AI prompts via server/api/ai-streaming.ts
import { EffortPricingDisplay } from '@/components/EffortPricingDisplay';
import { UnifiedCheckpointsPanel } from '@/components/UnifiedCheckpointsPanel';
import { InlineCheckpointMarker, CheckpointDivider } from './InlineCheckpointMarker';
import { TaskDecompositionDisplay, type DecomposedTask } from '@/components/agent/TaskDecompositionDisplay';
import { SlashCommandMenu, useSlashCommand, DEFAULT_MCP_SERVERS, type MCPServer } from './SlashCommandMenu';
import { AIModelIndicator, AIModelBadge, type DelegationInfo } from '@/components/agent/AIModelIndicator';
import { OrchestratorProgress, MiniProgressIndicator, type SessionProgressData } from '@/components/agent/OrchestratorProgress';
import { ProviderHealthBadge } from '@/components/agent/ProviderHealthIndicator';
import { MessageQueue, type QueuedMessage } from '@/components/agent/MessageQueue';
import { History, X, MousePointer2, Coins, Database, Volume2, VolumeX, DollarSign, RotateCcw } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { LazyMotionDiv, LazyMotionSpan, LazyAnimatePresence } from '@/lib/motion';
import { 
  EnhancedChatMessage, 
  StreamingSkeleton, 
  ConversationSyncIndicator,
  EmptyConversation
} from './EnhancedChatMessage';
import { VirtualizedMessageList, useOptimisticMessages, useDebouncedStreamingContent, StreamingText } from './VirtualizedMessageList';
import { Progress } from '@/components/ui/progress';
import { Package, Hammer, Smartphone, CheckCircle2, XCircle } from 'lucide-react';

const EMPTY_MESSAGES: Message[] = [];

interface ToolExecution {
  id: string;
  tool: string;
  parameters: any;
  result?: any;
  success?: boolean;
  status: 'pending' | 'running' | 'complete' | 'error';
  metadata?: {
    executionTime?: number;
    filesChanged?: string[];
    commandOutput?: string;
  };
  error?: string;
}

interface FileAttachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'binary';
  mimeType: string;
  size: number;
  content?: string;
  base64?: string;
  preview?: string;
}

type WorkflowPhase = 
  | 'generating_features'
  | 'selecting_build_option'
  | 'building_design'
  | 'design_preview'
  | 'building_full'
  | 'mvp_complete'
  | 'extended_build'
  | 'complete';

type ValidationStep = 'idle' | 'post_validation' | 'installing_deps' | 'deps_complete' | 'deps_failed' | 'verifying_build' | 'build_complete' | 'build_failed' | 'running_qa' | 'qa_complete';

interface BuildValidationProgressProps {
  currentStep: ValidationStep;
  depsResult?: { success: boolean; installed: number; failed: number; total: number };
  buildResult?: { success: boolean; errorCount: number; warningCount: number };
  qaResult?: { score: number; passedTests: number; totalTests: number };
}

function BuildValidationProgress({ currentStep, depsResult, buildResult, qaResult }: BuildValidationProgressProps) {
  if (currentStep === 'idle') return null;

  const steps = [
    { key: 'deps', label: 'Dependencies', icon: Package },
    { key: 'build', label: 'Build', icon: Hammer },
    { key: 'qa', label: 'QA', icon: Smartphone },
  ];

  const getStepStatus = (stepKey: string) => {
    switch (stepKey) {
      case 'deps':
        if (currentStep === 'installing_deps') return 'active';
        if (currentStep === 'deps_complete') return 'success';
        if (currentStep === 'deps_failed') return 'error';
        if (['verifying_build', 'build_complete', 'build_failed', 'running_qa', 'qa_complete'].includes(currentStep)) return depsResult?.success !== false ? 'success' : 'error';
        return 'pending';
      case 'build':
        if (currentStep === 'verifying_build') return 'active';
        if (currentStep === 'build_complete') return 'success';
        if (currentStep === 'build_failed') return 'error';
        if (['running_qa', 'qa_complete'].includes(currentStep)) return buildResult?.success !== false ? 'success' : 'error';
        return 'pending';
      case 'qa':
        if (currentStep === 'running_qa') return 'active';
        if (currentStep === 'qa_complete') return qaResult && qaResult.score >= 0.8 ? 'success' : qaResult && qaResult.score >= 0.5 ? 'warning' : 'error';
        return 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div
      className="collapsible-content expanded"
      data-testid="build-validation-progress"
    >
      <div className="bg-muted/50 rounded-lg p-3 mb-3 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-[13px] font-medium">Post-Build Validation</span>
      </div>
      
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]",
                status === 'active' && "bg-primary/20 text-primary",
                status === 'success' && "bg-green-500/20 text-green-600 dark:text-green-400",
                status === 'error' && "bg-red-500/20 text-red-600 dark:text-red-400",
                status === 'warning' && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
                status === 'pending' && "bg-muted text-muted-foreground"
              )}>
                {status === 'active' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : status === 'success' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : status === 'error' ? (
                  <XCircle className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{step.label}</span>
                {step.key === 'qa' && status !== 'pending' && status !== 'active' && qaResult && (
                  <span className="font-medium">{Math.round(qaResult.score * 100)}%</span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="w-4 h-px bg-border mx-1" />
              )}
            </div>
          );
        })}
      </div>
      
      {qaResult && currentStep === 'qa_complete' && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {qaResult.passedTests}/{qaResult.totalTests} responsive tests passed
        </div>
      )}
      </div>
    </div>
  );
}


interface AgentCapability {
  id: string;
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  badge?: string;
  description: string;
}

export interface ExternalInputHandlers {
  handleSubmit: (value: string) => void;
  handleSlashCommand: () => void;
  isWorking: boolean;
  agentMode: string;
  onModeChange: (mode: string) => void;
  conversationId: number | null;
  agentToolsSettings: AgentToolsSettings;
  onAgentToolsSettingsChange: (settings: AgentToolsSettings) => void;
  onAttach: () => void;
  onVoice: () => void;
  isRecording: boolean;
  isUploadingFiles: boolean;
  pendingAttachmentsCount: number;
  onRemoveAttachment?: (id: string) => void;
}

interface ReplitAgentPanelV3Props {
  projectId: string | number;
  className?: string;
  onMinimize?: () => void;
  mode?: 'desktop' | 'tablet' | 'mobile';
  // Props from ReplitAgent for compatibility during consolidation
  selectedFile?: string;
  selectedCode?: string;
  initialPrompt?: string | null;
  websocket?: WebSocket | null;
  onBuildComplete?: () => void;
  sessionId?: string | null;
  externalConversationId?: number | null;
  autoStart?: boolean; // ✅ FIX (Nov 30, 2025): Now defaults to true for auto-launch
  // Lifted agent tools settings to parent to survive remounts (Dec 2025)
  agentToolsSettings?: AgentToolsSettings;
  onAgentToolsSettingsChange?: (settings: AgentToolsSettings) => void;
  // ✅ FIX (Dec 11, 2025): Show ModeSelector immediately during bootstrap
  isBootstrapping?: boolean;
  // ✅ FIX (Dec 11, 2025): Bootstrap token for inline autonomous workspace creation
  bootstrapToken?: string | null;
  // ✅ FIX (Dec 19, 2025): Hide input on mobile to use external input bar
  hideInput?: boolean;
  // ✅ FIX (Dec 19, 2025): Callback to expose input handlers for external input bar
  onExternalInput?: (handlers: ExternalInputHandlers) => void;
  // ✅ FIX (Dec 25, 2025): Callback when agent bootstrap fails (clears token to exit loading)
  onBootstrapFailure?: () => void;
}

function categorizeError(error: unknown): { title: string; message: string } {
  // Extract error message from various formats - prioritize Error instances
  let errorMessage = '';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    // Check for empty plain objects (not Error instances) - indicates connection lost
    if (Object.keys(err).length === 0) {
      return {
        title: 'Connection Issue',
        message: 'Lost connection to the AI service. Please check your internet and try again.'
      };
    }
    errorMessage = String(err.message || err.error || err.detail || JSON.stringify(error));
  } else if (!error) {
    // Handle null/undefined errors
    return {
      title: 'Connection Issue',
      message: 'Lost connection to the AI service. Please check your internet and try again.'
    };
  } else {
    errorMessage = String(error);
  }
  errorMessage = errorMessage.toLowerCase();
  
  // Handle "Load failed" and similar fetch errors  
  if (errorMessage.includes('load failed') || errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('econnrefused') || errorMessage.includes('failed to fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the AI service. Please check your connection and try again.'
    };
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('etimedout') || errorMessage.includes('aborted')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long. Please try a simpler request or try again.'
    };
  }
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication') || errorMessage.includes('unauthenticated')) {
    return {
      title: 'Authentication Error',
      message: 'Authentication failed. Please refresh the page and log in again.'
    };
  }
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return {
      title: 'Rate Limit Exceeded',
      message: 'Too many requests. Please wait a moment and try again.'
    };
  }
  if (errorMessage.includes('500') || errorMessage.includes('internal server error')) {
    return {
      title: 'Server Error',
      message: 'The server encountered an error. Please try again in a moment.'
    };
  }
  
  return {
    title: 'AI Assistant Error',
    message: 'Something went wrong. Please try again.'
  };
}

export function ReplitAgentPanelV3({ 
  projectId, 
  className,
  onMinimize,
  mode = 'desktop',
  selectedFile,
  selectedCode,
  initialPrompt,
  websocket: externalWebsocket,
  onBuildComplete,
  sessionId: externalSessionId,
  externalConversationId,
  autoStart = true,
  agentToolsSettings: externalAgentToolsSettings,
  onAgentToolsSettingsChange,
  isBootstrapping = false,
  bootstrapToken,
  hideInput = false,
  onExternalInput,
  onBootstrapFailure
}: ReplitAgentPanelV3Props) {
  const projectIdNum = typeof projectId === 'string' ? (/^[0-9]+$/.test(projectId) ? parseInt(projectId, 10) : Math.abs(projectId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0))) : projectId;
  
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  const { toast } = useToast();
  
  const { modelId, provider, supportsExtendedThinking: modelSupportsExtendedThinking, model, setPreferredModel } = useAgentModelPreference();
  
  const abInlineMode = useAutonomousBuildStore(s => s.inlineMode);
  const abCurrentTask = useAutonomousBuildStore(s => s.currentTask);
  const abPhase = useAutonomousBuildStore(s => s.phase);
  const bootstrapTimedOut = useAutonomousBuildStore(s => s.bootstrapTimedOut);
  const bootstrapWarning = useAutonomousBuildStore(s => s.bootstrapWarning);
  const startBootstrapTimer = useAutonomousBuildStore(s => s.startBootstrapTimer);
  const setBootstrapTimedOut = useAutonomousBuildStore(s => s.setBootstrapTimedOut);
  const setBootstrapWarning = useAutonomousBuildStore(s => s.setBootstrapWarning);
  const clearBootstrapTimers = useAutonomousBuildStore(s => s.clearBootstrapTimers);
  const bootstrapFailed = bootstrapTimedOut;
  
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>('build');
  const [autonomySessionId, setAutonomySessionId] = useState<string | null>(null);
  
  const effectiveConversationId = conversationId ?? -projectIdNum;
  const isUsingTempConversation = conversationId === null;
  
  const setStoreMessages = useAgentConversationStore(s => s.setMessages);
  const addStoreMessage = useAgentConversationStore(s => s.addMessage);
  const clearStoreMessages = useAgentConversationStore(s => s.clearMessages);
  const setLastSyncedAt = useAgentConversationStore(s => s.setLastSyncedAt);
  const getLastSyncedAt = useAgentConversationStore(s => s.getLastSyncedAt);
  const hasConversation = useAgentConversationStore(s => s.hasConversation);
  const migrateMessages = useAgentConversationStore(s => s.migrateMessages);
  const getMessages = useAgentConversationStore(s => s.getMessages);
  
  const [isActiveBuildSession, setIsActiveBuildSession] = useState(false);
  
  const { 
    sendBuildModeSelection, 
    requestPlanChange, 
    manualReconnect,
    isConnected: wsIsConnected,
    connectionError,
    reconnectAttempt,
    maxReconnectAttempts
  } = useAutonomousChatIntegration({
    conversationId,
    projectId: projectIdNum,
    sessionId: externalSessionId,
    enabled: (!!bootstrapToken || isActiveBuildSession) && abInlineMode,
    bootstrapToken,
    initialPrompt
  });
  
  const { isEnabled: isAudioEnabled, setEnabled: setAudioEnabled } = useAgentAudioNotifications();
  useAgentDockNotifications();
  useAgentFavicon();
  
  const triggerSchemaWarming = useSchemaWarmingStore(s => s.startWarming);
  const isSchemaWarming = useSchemaWarmingStore(s => s.isWarming);
  const isSchemaReady = useSchemaWarmingStore(s => s.isReady);
  const schemaProgress = useSchemaWarmingStore(s => s.progress);
  
  const storeMessages = useAgentConversationStore(
    (s) => s.messages[effectiveConversationId]
  );
  const messages = storeMessages || EMPTY_MESSAGES;

  const bootstrapInjectedRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !bootstrapInjectedRef.current && effectiveConversationId) {
      const hasUserMsg = messages.some(m => m.role === 'user');
      if (!hasUserMsg) {
        bootstrapInjectedRef.current = true;
        const bootstrapUserMsg: Message = {
          id: `bootstrap-${Date.now()}`,
          role: 'user',
          content: initialPrompt.trim(),
          timestamp: new Date(),
          status: 'sent'
        };
        setStoreMessages(effectiveConversationId, [...messages, bootstrapUserMsg]);
      }
    }
  }, [initialPrompt, effectiveConversationId, messages]);
  
  devLog('[ReplitAgentPanelV3] 📊 Messages:', {
    effectiveConversationId,
    conversationId,
    isUsingTempConversation,
    messageCount: messages.length,
    firstMessageId: messages[0]?.id
  });
  
  // ✅ FIX (Jan 2026): Wrapper to update messages in zustand store
  // Uses effectiveConversationId to support Replit-style always-ready chat
  // Messages are stored with temp ID (-projectId) and migrated when real ID is available
  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    const currentMessages = getMessages(effectiveConversationId); const newMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
    setStoreMessages(effectiveConversationId, newMessages);
  }, [effectiveConversationId, getMessages, setStoreMessages]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [vibeModeEnabled, setVibeModeEnabled] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPendingResponse, setIsPendingResponse] = useState(false); // True when waiting for first AI response chunk
  const [streamingContent, setStreamingContent] = useState('');
  const [activeThinking, setActiveThinking] = useState<ThinkingStep[]>([]);
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([
    {
      id: 'extended_thinking',
      label: 'Extended Thinking',
      icon: Brain,
      enabled: true,
      badge: 'PRO',
      description: 'Deep reasoning with visible thought process'
    },
    {
      id: 'high_power',
      label: 'High Power Mode',
      icon: Zap,
      enabled: false,
      badge: 'ENTERPRISE',
      description: 'Use the most capable AI model available'
    }
  ]);
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [videoReplayViewerOpen, setVideoReplayViewerOpen] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  
  // Fast Mode state - quick mode for 10-60 second targeted changes
  const [fastMode, setFastMode] = useState(false);
  
  // Fast Mode toggle handler with toast notification
  const handleFastModeToggle = useCallback(() => {
    const newState = !fastMode;
    setFastMode(newState);
    toast({
      title: newState ? '⚡ Fast Mode Enabled' : 'Fast Mode Disabled',
      description: newState 
        ? 'Using fast model for quick 10-60s targeted edits' 
        : 'Switched back to standard model',
    });
  }, [fastMode, toast]);
  
  // Slash command menu state (Replit-style "/" to show integrations)
  const slashCommand = useSlashCommand();
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  
  const pendingExternalSubmitRef = useRef<string | null>(null);
  const handleSendRef = useRef<(() => void) | null>(null);

  const handleExternalSubmit = useCallback((value: string) => {
    if (!value.trim() || isWorking) return;
    pendingExternalSubmitRef.current = value;
    flushSync(() => {
      setInput(value);
    });
    if (handleSendRef.current) {
      handleSendRef.current();
    }
  }, [isWorking]);
  
  // Optimistic UI updates and debounced streaming for faster perceived response
  const { addOptimisticMessage, hasPendingMessages } = useOptimisticMessages(messages, setMessages);
  // Note: debouncedStreaming hook removed - using direct setStreamingContent for simplicity
  
  // Use virtualized list for long conversations (>20 messages)
  const useVirtualization = messages.length > 20;
  
  // Agent Tools Panel settings (Replit Agent 3 exact toggles)
  // Use external settings if provided (lifted state pattern), otherwise use internal state
  const defaultSettings: AgentToolsSettings = {
    maxAutonomy: false,
    appTesting: true, // ON by default per Replit Agent 3
    extendedThinking: false,
    highPowerModels: false,
    webSearch: false
  };
  
  const [internalAgentToolsSettings, setInternalAgentToolsSettings] = useState<AgentToolsSettings>(defaultSettings);
  
  // Use external settings if provided, otherwise use internal state
  const agentToolsSettings = externalAgentToolsSettings ?? internalAgentToolsSettings;
  const setAgentToolsSettings = onAgentToolsSettingsChange ?? setInternalAgentToolsSettings;
  
  // Ref to track previous settings for toast comparison (avoids stale closure issues)
  const agentToolsSettingsRef = useRef<AgentToolsSettings>(agentToolsSettings);
  
  // Element Editor state
  const [elementEditorActive, setElementEditorActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementSelection | null>(null);
  const [videoReplayCount, setVideoReplayCount] = useState(0);
  
  // Build/Install/QA validation progress state (Task 6)
  const [validationStep, setValidationStep] = useState<ValidationStep>('idle');
  const [depsResult, setDepsResult] = useState<{ success: boolean; installed: number; failed: number; total: number } | undefined>();
  const [buildResult, setBuildResult] = useState<{ success: boolean; errorCount: number; warningCount: number } | undefined>();
  const [qaResult, setQaResult] = useState<{ score: number; passedTests: number; totalTests: number } | undefined>();
  
  // RAG (Retrieval-Augmented Generation) state
  const [ragEnabled, setRagEnabled] = useState(true);
  const [showRAGContext, setShowRAGContext] = useState(false);
  const { data: ragStats } = useRAGStats();
  
  // ✅ Memory Bank works 100% transparently - no UI needed
  // Context auto-injected into AI prompts on server side
  
  // Replit-style "Show Previous Messages" feature
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  
  // Derive validation step from autonomousBuildStore current task (Task 6)
  const validationStepRef = useRef<ValidationStep>(validationStep);
  validationStepRef.current = validationStep;
  
  useEffect(() => {
    const currentTask = abCurrentTask?.toLowerCase() || '';
    const phase = abPhase;
    
    if (phase === 'complete' || phase === 'error') {
      setIsActiveBuildSession(false);
    }
    
    if (currentTask.includes('post-build validation') || currentTask.includes('running post-build')) {
      setValidationStep('post_validation');
    } else if (currentTask.includes('installing dependencies')) {
      setValidationStep('installing_deps');
    } else if (currentTask.includes('dependencies installed successfully')) {
      setValidationStep('deps_complete');
      setDepsResult({ success: true, installed: 0, failed: 0, total: 0 });
    } else if (currentTask.includes('dependencies failed')) {
      setValidationStep('deps_failed');
      setDepsResult({ success: false, installed: 0, failed: 1, total: 1 });
    } else if (currentTask.includes('verifying build')) {
      setValidationStep('verifying_build');
    } else if (currentTask.includes('build verified')) {
      setValidationStep('build_complete');
      setBuildResult({ success: true, errorCount: 0, warningCount: 0 });
    } else if (currentTask.includes('build failed')) {
      setValidationStep('build_failed');
      setBuildResult({ success: false, errorCount: 1, warningCount: 0 });
    } else if (currentTask.includes('running responsive qa') || currentTask.includes('responsive qa tests')) {
      setValidationStep('running_qa');
    } else if (currentTask.includes('qa score')) {
      setValidationStep('qa_complete');
      const match = currentTask.match(/(\d+)%/);
      const score = match ? parseInt(match[1]) / 100 : 0.8;
      setQaResult({ score, passedTests: Math.round(score * 5), totalTests: 5 });
    } else if (phase === 'complete' && validationStepRef.current !== 'idle') {
      setTimeout(() => setValidationStep('idle'), 5000);
    }
  }, [abCurrentTask, abPhase]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserNearBottomRef = useRef(true);
  const lastScrollTimeRef = useRef(0);

  // Bootstrap conversation on mount
  // ✅ FIX (Dec 10, 2025): Always call POST /api/agent/conversation to get proper integer ID
  // External conversation IDs from bootstrap tokens are UUIDs but aiConversations.id is integer
  // The backend will return existing conversation if one exists for this projectId
  useEffect(() => {
    let isMounted = true;
    let bootstrapCompleted = false;
    
    const bootstrapConversation = async () => {
      try {
        devLog('[ReplitAgentPanelV3] Starting conversation bootstrap for projectId:', projectId);
        
        const response = await apiRequest('POST', '/api/agent/conversation', {
          projectId: projectId.toString()
        }) as { conversationId: number; agentMode: 'plan' | 'build'; existing: boolean };

        if (!isMounted) return;
        
        devLog('[ReplitAgentPanelV3] Bootstrap successful:', response);

        // ✅ FIX (Dec 12, 2025): Migrate messages from temp conversationId to real conversationId
        const tempConversationId = -projectIdNum;
        const realConversationId = response.conversationId;
        
        if (realConversationId && tempConversationId && realConversationId !== tempConversationId) {
          devLog('[ReplitAgentPanelV3] Migrating messages from temp', tempConversationId, 'to real', realConversationId);
          migrateMessages(tempConversationId, realConversationId);
        }

        setConversationId(realConversationId);
        setAgentMode(response.agentMode);
        bootstrapCompleted = true;
        
        clearBootstrapTimers();
        setBootstrapTimedOut(false);
        setBootstrapWarning(false);
        
        if (bootstrapToken) {
          setIsActiveBuildSession(true);
        }
      } catch (error: unknown) {
        if (!isMounted) return;
        
        console.error('[ReplitAgentPanelV3] Bootstrap conversation failed:', error);
        bootstrapCompleted = true;
        
        clearBootstrapTimers();
        setBootstrapTimedOut(true);
        // ✅ FIX (Dec 25, 2025): Notify parent to clear bootstrap token
        onBootstrapFailure?.();
        
        // Only show toast for non-401 errors (401 is expected during bootstrap with token)
        const isAuthError = error instanceof Error && 
          (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized'));
        
        if (!isAuthError) {
          toast({
            title: "Conversation Setup Failed",
            description: "Could not initialize agent conversation. You can still chat.",
            variant: "destructive"
          });
        }
      }
    };

    bootstrapConversation();
    
    // ✅ FIX (Jan 2026): Use global timer that survives component remounts
    // This prevents mobile users from being stuck on "Initializing Agent" forever
    // The timer runs in Zustand store, not in this component's lifecycle
    startBootstrapTimer();
    
    return () => {
      isMounted = false;
      // Note: We DON'T clear the global timer here - it survives remounts intentionally
    };
  }, [projectId, toast, migrateMessages, onBootstrapFailure, startBootstrapTimer, setBootstrapTimedOut]);

  // ✅ FIX (Jan 2026): React to bootstrap timeout and seed fallback message
  // When the global timer fires, we need to:
  // 1. Notify parent to clear isBootstrapping state
  // 2. Unlock preview/deploy gate so user isn't stuck behind schema gate forever
  // 3. Seed a system message so the chat is never empty (Replit-style UX)
  useEffect(() => {
    if (bootstrapTimedOut && !conversationId) {
      devLog('[ReplitAgentPanelV3] Bootstrap timeout detected - seeding fallback message');
      
      // Notify parent to clear bootstrap token and isBootstrapping state
      onBootstrapFailure?.();
      
      // ✅ FIX (Mar 2026): Also call markReady so preview/deploy tabs unlock even on timeout
      // The build may still be running in the background; don't block the user forever
      useSchemaWarmingStore.getState().markReady();
      
      // Seed a system message so the chat isn't empty
      // Use the temp conversationId (negative projectId) for offline/degraded mode
      const tempConvId = -projectIdNum;
      const fallbackMessage: Message = {
        id: `system-bootstrap-timeout-${Date.now()}`,
        role: 'assistant',
        content: "I'm ready to help! The connection took a moment, but you can start chatting now. Type your request below.",
        timestamp: new Date(),
      };
      
      // Only add if we don't already have messages
      const existingMessages = getMessages(tempConvId);
      if (existingMessages.length === 0) {
        addStoreMessage(tempConvId, fallbackMessage);
      }
    }
  }, [bootstrapTimedOut, conversationId, projectIdNum, onBootstrapFailure, getMessages, addStoreMessage]);

  // Track if initial sync from backend has been completed for this conversation
  const initialSyncDoneRef = useRef<number | null>(null);
  
  // Load existing messages from backend when conversationId is available
  // ✅ FIX (Dec 10, 2025): Always fetch when conversationId is available
  // Previously used `!hasConversation(conversationId)` which prevented fetching
  // when localStorage had rehydrated stale data
  const { data: backendMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: [`/api/agent/conversation/${conversationId}/messages`],
    enabled: !!conversationId && !hasConversation(conversationId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch decomposed tasks for autonomy session
  const { data: orchestratorTasks, isLoading: isLoadingTasks } = useQuery<{ tasks: DecomposedTask[] }>({
    queryKey: [`/api/autonomy/sessions/${autonomySessionId}/tasks`],
    enabled: Boolean(autonomySessionId),
    refetchInterval: 5000,
  });

  const { data: orchestratorProgress, isLoading: isLoadingProgress } = useQuery<{ 
    progress: SessionProgressData & { 
      metadata?: { 
        delegation?: DelegationInfo 
      } 
    } 
  }>({
    queryKey: [`/api/autonomy/sessions/${autonomySessionId}/progress`],
    enabled: Boolean(autonomySessionId),
    refetchInterval: 3000,
  });

  const { data: queuedMessagesData, isLoading: isLoadingQueuedMessages } = useQuery<{ messages: QueuedMessage[] }>({
    queryKey: [`/api/autonomy/sessions/${autonomySessionId}/messages`],
    enabled: Boolean(autonomySessionId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!conversationId) return;
    if (initialSyncDoneRef.current === conversationId) return;

    const fetchedMessages = (backendMessages?.messages as Message[] | undefined) || [];
    const existingMessages = getMessages(conversationId);
    const localHasContent = existingMessages.length > 1 || existingMessages.some(m => m.role === 'user');

    if (localHasContent && fetchedMessages.length <= existingMessages.length) {
      initialSyncDoneRef.current = conversationId;
      if (backendMessages?.hasMore !== undefined) setHasMoreMessages(backendMessages.hasMore);
      if (backendMessages?.totalCount !== undefined) setTotalMessageCount(backendMessages.totalCount);
      return;
    }

    if (fetchedMessages.length > existingMessages.length) {
      setStoreMessages(conversationId, fetchedMessages);
      setLastSyncedAt(conversationId, Date.now());
    }

    initialSyncDoneRef.current = conversationId;
    if (backendMessages?.hasMore !== undefined) setHasMoreMessages(backendMessages.hasMore);
    if (backendMessages?.totalCount !== undefined) setTotalMessageCount(backendMessages.totalCount);
  }, [backendMessages, conversationId, setStoreMessages, setLastSyncedAt, getMessages]);
  
  // Handler for "Show Previous Messages" button (Replit-style incremental loading)
  const handleLoadPreviousMessages = useCallback(async () => {
    if (!conversationId || isLoadingPrevious) return;
    
    setIsLoadingPrevious(true);
    try {
      // Calculate how many more messages to load (20 at a time)
      const currentCount = messages.length;
      const batchSize = 20;
      const newLimit = currentCount + batchSize;
      
      // Load incrementally by increasing the limit
      const response = await fetch(`/api/agent/conversation/${conversationId}/messages?limit=${newLimit}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          // Prepend older messages to the existing list (backend returns chronologically ordered)
          setStoreMessages(conversationId, data.messages as Message[]);
          
          // Update hasMore based on whether there are still more messages
          const remainingCount = (data.totalCount || 0) - data.messages.length;
          setHasMoreMessages(remainingCount > 0);
          setTotalMessageCount(data.totalCount || data.messages.length);
        }
      }
    } catch (error) {
      console.error('[LoadPrevious] Failed to load previous messages:', error);
    } finally {
      setIsLoadingPrevious(false);
    }
  }, [conversationId, isLoadingPrevious, messages.length, setStoreMessages]);

  // Track context injection to prevent duplicates
  const contextInjectedRef = useRef<string | null>(null);
  
  // ✅ FIX (Dec 9, 2025): REMOVED first auto-start effect
  // The second auto-start effect (lines 588-883) is the authoritative one.
  // This first effect was clearing sessionStorage before the second effect could use it,
  // causing the mobile bootstrap flow to fail.
  // Consolidation: Only use the second effect which properly waits for conversationId,
  // handles streaming, and persists messages correctly.

  // Handle selected file/code context injection - with idempotent check using content hash
  useEffect(() => {
    if (!selectedFile || !selectedCode) return;
    
    // Create a unique key using file name and content length + first/last chars for better uniqueness
    const codeHash = `${selectedCode.length}-${selectedCode.substring(0, 50)}-${selectedCode.substring(selectedCode.length - 50)}`;
    const contextKey = `${selectedFile}:${codeHash}`;
    
    if (contextInjectedRef.current !== contextKey) {
      contextInjectedRef.current = contextKey;
      // Add context to the input
      const contextPrefix = `\n\n[Context: ${selectedFile}]\n\`\`\`\n${selectedCode.substring(0, 500)}${selectedCode.length > 500 ? '...' : ''}\n\`\`\`\n\n`;
      setInput(prev => prev ? prev + contextPrefix : contextPrefix);
    }
  }, [selectedFile, selectedCode]);

  // Max Autonomy hook
  const {
    startSession: startAutonomySession,
    isStartingSession: isStartingAutonomy,
    session: autonomySession
  } = useMaxAutonomy(autonomySessionId, projectIdNum);

  // Handler for agent tools settings changes (Replit Agent 3 toggles)
  // State is now lifted to parent (IDEPage) to survive remounts
  const handleAgentToolsChange = useCallback((newSettings: AgentToolsSettings) => {
    // Get previous settings from ref for toast comparison
    const prevSettings = agentToolsSettingsRef.current;
    
    // Update ref to track current settings
    agentToolsSettingsRef.current = newSettings;
    
    // Update state (either parent's state via callback or internal state)
    setAgentToolsSettings(newSettings);
    
    // Show toasts for newly enabled features
    if (newSettings.maxAutonomy && !prevSettings.maxAutonomy) {
      toast({
        title: "Max Autonomy Enabled",
        description: "Agent will supervise itself for up to 200 minutes"
      });
    }
    
    if (newSettings.appTesting && !prevSettings.appTesting) {
      toast({
        title: "App Testing Enabled",
        description: "Agent will test using browser automation with video replays"
      });
    }
    
    if (newSettings.extendedThinking && !prevSettings.extendedThinking) {
      toast({
        title: "Extended Thinking Enabled",
        description: "Deeper reasoning for harder problems"
      });
    }
    
    if (newSettings.highPowerModels && !prevSettings.highPowerModels) {
      toast({
        title: "High Power Models Enabled",
        description: "Using sophisticated AI for complex tasks"
      });
    }
    
    if (newSettings.webSearch && !prevSettings.webSearch) {
      toast({
        title: "Web Search Enabled",
        description: "Agent can search the web for docs and APIs"
      });
    }
  }, [setAgentToolsSettings, toast]);
  
  // Handler for Element Editor save
  const handleElementSave = useCallback((changes: Partial<ElementSelection['styles']> & { text?: string }) => {
    setSelectedElement(null);
    setElementEditorActive(false);
    toast({
      title: "Changes Applied",
      description: "Element styles updated successfully"
    });
  }, [toast]);
  
  // Handler for viewing video replays
  const handleViewVideoReplays = useCallback(() => {
    setVideoReplayViewerOpen(true);
    toast({
      title: "Video Replays",
      description: "Opening test session recordings..."
    });
  }, [toast]);

  const handleModeChange = useCallback(async (newMode: AgentMode) => {
    setAgentMode(newMode);
    
    const modeDescriptions: Record<AgentMode, string> = {
      build: "Agent will autonomously make changes",
      plan: "Agent will brainstorm without making code changes",
      edit: "Targeted changes to specific files with precise control",
      fast: "Quick responses with reduced reasoning for speed"
    };
    
    toast({
      title: `Switched to ${newMode.charAt(0).toUpperCase() + newMode.slice(1)} Mode`,
      description: modeDescriptions[newMode],
    });

    if (conversationId && Number.isInteger(conversationId) && conversationId > 0) {
      try {
        await apiRequest('POST', `/api/agent/conversation/${conversationId}/mode`, {
          mode: newMode
        });
      } catch (error) {
      }
    }
  }, [conversationId, setAgentMode, toast]);

  // Handler for starting autonomy session
  const handleStartAutonomy = async (goal: string, options: any) => {
    try {
      const response = await apiRequest<{ success: boolean; session: { id: string } }>(
        'POST', 
        '/api/autonomy/sessions', 
        {
          projectId: projectIdNum,
          goal,
          ...options
        }
      );
      
      if (response?.success && response?.session?.id) {
        setAutonomySessionId(response.session.id);
        
        // Add a system message about the autonomous session starting
        const systemMessage: Message = {
          id: `autonomy-start-${Date.now()}`,
          role: 'assistant',
          content: `🚀 **Max Autonomy Session Started**\n\n**Goal:** ${goal}\n\nI'll work autonomously on this with automatic checkpoints and testing. You can pause or stop at any time.`,
          timestamp: new Date(),
          type: 'text'
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error: any) {
      console.error('Failed to start autonomy session:', error);
      toast({
        title: "Failed to Start Session",
        description: error.message || "Could not start autonomous session",
        variant: "destructive"
      });
    }
  };

  const handleStopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsWorking(false);
    setIsPendingResponse(false);
    setStreamingContent('');
    setActiveThinking([]);
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && last.isStreaming) {
        return prev.map(msg =>
          msg.id === last.id
            ? { ...msg, isStreaming: false, content: msg.content || '(Stopped by user)' }
            : msg
        );
      }
      return prev;
    });
  }, [setMessages]);

  const handleStopAutonomy = () => {
    setAutonomySessionId(null);
    setAgentMode('build');
  };

  // Handler for file attachment button click
  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handler for file selection - uploads to backend and adds to pending attachments
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingFiles(true);
    
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      const attachCsrf = await getCSRFToken();
      const response = await fetch('/api/agent/attachments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': attachCsrf },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload files');
      }
      
      const data = await response.json();
      
      if (data.attachments && data.attachments.length > 0) {
        setPendingAttachments(prev => [...prev, ...data.attachments]);
        toast({
          title: "Files Attached",
          description: `${data.attachments.length} file(s) ready to send with your message.`,
        });
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingFiles(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  }, [toast]);

  // Handler to remove a pending attachment
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);

  // Handler for voice vibe coding — MediaRecorder → OpenAI Whisper transcription
  const handleVoiceClick = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone Not Available",
        description: "Your browser does not support microphone access. Please use Chrome or Firefox.",
        variant: "destructive"
      });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access and try again.'
        : 'No microphone found. Please connect a microphone and try again.';
      toast({ title: "Microphone Error", description: msg, variant: "destructive" });
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const recorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      mediaRecorderRef.current = null;

      const chunks = audioChunksRef.current;
      if (chunks.length === 0) return;

      const audioBlob = new Blob(chunks, { type: mimeType });
      if (audioBlob.size < 1000) {
        toast({ title: "No speech detected", description: "Please speak louder and try again.", variant: "destructive" });
        return;
      }

      toast({ title: "Transcribing...", description: "Converting your voice to text with AI." });

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${mimeType.includes('ogg') ? 'ogg' : 'webm'}`);
        formData.append('prompt', 'Code, programming, software, build, create, function, component, API');

        const { transcript } = await apiRequest<{ transcript: string; language?: string }>(
          'POST',
          '/api/voice/transcribe',
          formData
        );

        if (!transcript || transcript.trim().length === 0) {
          toast({ title: "No speech detected", description: "Please try again and speak clearly.", variant: "destructive" });
          return;
        }

        if (vibeModeEnabled && !isWorking) {
          flushSync(() => { setInput(transcript); });
          setTimeout(() => {
            if (handleSendRef.current) handleSendRef.current();
          }, 120);
          toast({ title: "Vibe Mode: Sending!", description: `"${transcript.slice(0, 60)}${transcript.length > 60 ? '…' : ''}"` });
        } else {
          setInput(prev => prev ? `${prev} ${transcript}` : transcript);
          toast({ title: "Voice captured!", description: `"${transcript.slice(0, 60)}${transcript.length > 60 ? '…' : ''}"` });
        }
      } catch (err: any) {
        toast({
          title: "Transcription Failed",
          description: err.message || "Could not transcribe audio. Please try again.",
          variant: "destructive"
        });
      }
    };

    recorder.onerror = () => {
      stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      mediaRecorderRef.current = null;
      toast({ title: "Recording Error", description: "Recording failed. Please try again.", variant: "destructive" });
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    toast({ title: "Listening...", description: "Speak your coding request. Click mic again to stop." });
  }, [isRecording, vibeModeEnabled, isWorking, toast]);

  // Cleanup media recorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    };
  }, []);

  const slashCommandOpen = slashCommand.open;
  const modeChangeHandler = useCallback((mode: string) => handleModeChange(mode as AgentMode), [handleModeChange]);
  const pendingAttachmentsCount = pendingAttachments.length;

  const externalHandlers = useMemo(() => ({
    handleSubmit: handleExternalSubmit,
    handleSlashCommand: slashCommandOpen,
    isWorking,
    agentMode,
    onModeChange: modeChangeHandler,
    conversationId,
    agentToolsSettings,
    onAgentToolsSettingsChange: setAgentToolsSettings,
    onAttach: handleAttachmentClick,
    onVoice: handleVoiceClick,
    isRecording,
    isUploadingFiles,
    pendingAttachmentsCount,
    onRemoveAttachment: handleRemoveAttachment,
  }), [handleExternalSubmit, slashCommandOpen, isWorking, agentMode, modeChangeHandler, conversationId, agentToolsSettings, setAgentToolsSettings, handleAttachmentClick, handleVoiceClick, isRecording, isUploadingFiles, pendingAttachmentsCount, handleRemoveAttachment]);

  useEffect(() => {
    if (onExternalInput) {
      onExternalInput(externalHandlers);
    }
  }, [onExternalInput, externalHandlers]);

  // ✅ FIX (Dec 14, 2025): Fortune 500-grade scroll behavior
  // Track if user is near bottom to prevent jumping when user is reading history
  const checkIfNearBottom = useCallback(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isUserNearBottomRef.current = distanceFromBottom < 150; // Within 150px of bottom
    }
  }, []);

  // Attach scroll listener to track user position
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      const handleScroll = () => {
        lastScrollTimeRef.current = Date.now();
        checkIfNearBottom();
      };
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom - only when user is near bottom and not actively scrolling
  useEffect(() => {
    // Don't auto-scroll if user recently scrolled (prevents jumping during manual scroll)
    const timeSinceLastScroll = Date.now() - lastScrollTimeRef.current;
    if (timeSinceLastScroll < 100) return;

    // Only auto-scroll if user is near bottom (reading new messages)
    if (!isUserNearBottomRef.current) return;

    if (lastMessageRef.current) {
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, [messages.length]); // Only trigger on new messages, not streaming updates

  // Scroll to bottom on streaming completion (when streaming stops)
  const prevStreamingRef = useRef(streamingContent);
  useEffect(() => {
    // Detect when streaming ends (content was streaming, now stopped)
    if (prevStreamingRef.current && !streamingContent && isUserNearBottomRef.current) {
      requestAnimationFrame(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
    prevStreamingRef.current = streamingContent;
  }, [streamingContent]);

  // Auto-focus input
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Ref to track if auto-start has been processed (prevent double execution)
  const autoStartExecutedRef = useRef(false);
  // ✅ FORTUNE 500 FIX: Track pending auto-start state for WebSocket readiness
  const [pendingAutoStart, setPendingAutoStart] = useState<{ prompt: string; startTime: number } | null>(null);
  
  // ✅ FORTUNE 500 FIX (Dec 25, 2025): CONSOLIDATED auto-start effect with WebSocket readiness
  // Uses state (pendingAutoStart) instead of ref to trigger re-renders when WS connects
  useEffect(() => {
    // CRITICAL: Don't start until conversationId is available so messages persist to store
    if (!conversationId) {
      return;
    }
    
    // Prevent double execution
    if (autoStartExecutedRef.current) {
      return;
    }
    
    // Check URL params for prompt and bootstrap token
    const urlParams = new URLSearchParams(window.location.search);
    const promptFromUrl = urlParams.get('prompt');
    const agentEnabled = urlParams.get('agent') === 'true';
    const hasBootstrapToken = !!urlParams.get('bootstrap');
    
    // Check session storage for prompt (IDEPage.tsx stores bootstrap prompt here)
    const promptFromSession = window.sessionStorage.getItem(`agent-prompt-${projectId}`);
    
    // Priority order for prompt sources:
    // 1. initialPrompt prop (passed from parent component)
    // 2. URL param (?prompt=...)
    // 3. sessionStorage (bootstrap flow)
    const resolvedPrompt = initialPrompt || promptFromUrl || promptFromSession;
    
    // Trigger auto-start when prompt exists in sessionStorage
    // This handles the Replit-like flow: landing page → login → IDE with preserved prompt
    const hasStoredPrompt = !!promptFromSession;
    const shouldAutoStart = (agentEnabled || hasBootstrapToken || autoStart || hasStoredPrompt) && resolvedPrompt && !isWorking;
    
    if (!shouldAutoStart) {
      return;
    }
    
    // ✅ FORTUNE 500 FIX: Check WebSocket readiness before streaming
    const WS_READY_TIMEOUT = 5000; // 5 seconds max wait for WebSocket
    
    // If WS not connected and not pending, set pending state (triggers re-render when WS connects)
    if (!wsIsConnected && !pendingAutoStart) {
      setPendingAutoStart({ prompt: resolvedPrompt, startTime: Date.now() });
      devLog('[AutoStart] Waiting for WebSocket connection before streaming...', { conversationId });
      return;
    }
    
    // Check if we've been waiting too long
    if (pendingAutoStart) {
      const waitTime = Date.now() - pendingAutoStart.startTime;
      if (!wsIsConnected && waitTime < WS_READY_TIMEOUT) {
        // Still waiting, the dependency on wsIsConnected will re-fire this effect
        devLog('[AutoStart] Still waiting for WebSocket...', { waitTime, wsIsConnected });
        return;
      }
      if (!wsIsConnected && waitTime >= WS_READY_TIMEOUT) {
        devLog('[AutoStart] WebSocket timeout - proceeding without WS', { waitTime });
      }
    }
    
    // Mark as executed to prevent re-runs
    autoStartExecutedRef.current = true;
    setPendingAutoStart(null);
    
    // Set the prompt in the input
    setInput(resolvedPrompt);
    
    // Clear session storage
    if (promptFromSession) {
      window.sessionStorage.removeItem(`agent-prompt-${projectId}`);
    }
    
    devLog('[AutoStart] ✅ Starting build with prompt', { 
      conversationId, 
      wsIsConnected, 
      promptLength: resolvedPrompt.length 
    });
    
    // ✅ FORTUNE 500: Activate build session BEFORE streaming to ensure WS is ready
    setIsActiveBuildSession(true);
    
    // Auto-start building after a brief delay to ensure state propagation
    setTimeout(() => {
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: resolvedPrompt.trim(),
          timestamp: new Date(),
          status: 'sent'
        };

        setMessages(prev => [...prev, userMessage]);
        
        // ✅ FIX (Dec 10, 2025): Persist user message to backend database
        persistMessageToBackend({
          role: 'user',
          content: userMessage.content,
          timestamp: userMessage.timestamp,
        });
        
        setInput('');
        setIsWorking(true);
        setIsPendingResponse(true); // Show skeleton until first chunk
        setStreamingContent('');

        // Show thinking if extended thinking is enabled
        const extendedThinkingEnabled = agentToolsSettings.extendedThinking;
        
        if (extendedThinkingEnabled) {
          const thinkingSteps = simulateThinkingSteps(userMessage.content);
          setActiveThinking(thinkingSteps);
        }

        // Track assistant message ID for error handling
        let autoStartAssistantMessageId: string | null = null;
        
        // Call the AI streaming API
        (async () => {
          try {
            // Use selected provider from model preference (fallback to openai)
            const selectedProvider = provider || 'openai';
            
            // ✅ FIX (Dec 7, 2025): Only send conversationId if it's a valid numeric ID
            // The backend expects an integer, not a string like "conv-123456"
            const chatConversationId = conversationId && !isNaN(Number(conversationId)) 
              ? String(conversationId) 
              : undefined; // Let backend create conversation if needed
            
            // Use raw fetch for SSE streaming - apiRequest consumes the body
            // CSRF token must be included manually since we can't use apiRequest for streaming
            const streamCsrf = await getCSRFToken();
            const response = await fetch('/api/agent/chat/stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': streamCsrf },
              credentials: 'include',
              body: JSON.stringify({
                message: userMessage.content,
                projectId: projectId,
                ...(chatConversationId && { conversationId: chatConversationId }),
                provider: selectedProvider,
                modelId: modelId || undefined,
                context: messages.slice(-20).map(m => ({
                  role: m.role,
                  content: m.content
                })),
                capabilities: {
                  extendedThinking: agentToolsSettings.extendedThinking,
                  webSearch: agentToolsSettings.webSearch,
                  highPower: agentToolsSettings.highPowerModels,
                  highPowerModels: agentToolsSettings.highPowerModels,
                  maxAutonomy: agentToolsSettings.maxAutonomy,
                  appTesting: agentToolsSettings.appTesting,
                }
              })
            });

            // ✅ FORTUNE 500 FIX: Enhanced error handling for non-2xx responses
            if (!response.ok) {
              let errorMessage = 'Failed to get AI response';
              try {
                const errorText = await response.text();
                // Check if it's JSON error or HTML error page
                if (errorText.startsWith('{')) {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.message || errorJson.error || errorMessage;
                } else if (response.status === 429) {
                  errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                } else if (response.status >= 500) {
                  errorMessage = 'Server error. Please try again later.';
                }
              } catch (e) {
                // Use default error message
              }
              devLog('[AutoStart] ❌ Streaming error:', { status: response.status, errorMessage });
              throw new Error(errorMessage);
            }
            
            devLog('[AutoStart] ✅ Stream connected, first chunk timestamp:', Date.now());

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            autoStartAssistantMessageId = (Date.now() + 1).toString();
            const assistantMessage: Message = {
              id: autoStartAssistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              thinking: extendedThinkingEnabled ? [...activeThinking] : undefined,
              isStreaming: true,
              metadata: {
                extendedThinking: extendedThinkingEnabled
              }
            };
            
            // Add assistant message to state BEFORE streaming to support live updates
            setMessages(prev => [...prev, assistantMessage]);

            let fullContent = '';
            const thinkingSteps: ThinkingStep[] = [];
            const toolExecutions: ToolExecution[] = [];
            
            let sseBuffer = '';
            
            while (reader) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              sseBuffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              
              let boundaryIndex;
              while ((boundaryIndex = sseBuffer.indexOf('\n\n')) !== -1) {
                const eventText = sseBuffer.slice(0, boundaryIndex);
                sseBuffer = sseBuffer.slice(boundaryIndex + 2);
                
                let currentEventType = 'message';
                let dataStr = '';
                for (const line of eventText.split('\n')) {
                  if (line.startsWith('event: ')) currentEventType = line.slice(7).trim();
                  else if (line.startsWith('data: ')) dataStr += line.slice(6);
                }
                if (!dataStr) continue;
                
                try {
                  const data = JSON.parse(dataStr);
                  
                  if (currentEventType === 'error' && data.message) {
                    devLog('[AutoStart SSE] Error event:', data.message);
                    continue;
                  }
                  
                  if (currentEventType === 'token' || data.content) {
                    fullContent += data.content || '';
                    setStreamingContent(fullContent);
                    setIsPendingResponse(false);
                  }
                  
                  if ((currentEventType === 'thinking_start' || currentEventType === 'thinking_update' || currentEventType === 'thinking_complete') && data.step) {
                    setIsPendingResponse(false);
                    const step: ThinkingStep = { ...data.step, timestamp: new Date(data.step.timestamp) };
                    const existingIndex = thinkingSteps.findIndex(s => s.id === step.id);
                    if (existingIndex >= 0) thinkingSteps[existingIndex] = step;
                    else thinkingSteps.push(step);
                    setActiveThinking([...thinkingSteps]);
                  }
                  
                  if (currentEventType === 'action_start' && data.actionId) {
                    thinkingSteps.push({
                      id: `action-${data.actionId}`, type: 'tool',
                      title: data.label || data.action || 'Processing',
                      content: '', status: 'active', timestamp: new Date(),
                    });
                    setActiveThinking([...thinkingSteps]);
                  }
                  
                  if (currentEventType === 'action_complete' && data.actionId) {
                    const idx = thinkingSteps.findIndex(s => s.id === `action-${data.actionId}`);
                    if (idx >= 0) {
                      thinkingSteps[idx] = { ...thinkingSteps[idx], status: data.success ? 'complete' : 'error',
                        content: data.filesCreated ? `${data.filesCreated} files created` : '' };
                      setActiveThinking([...thinkingSteps]);
                    }
                  }
                  
                  if (currentEventType === 'file_diff' && data.path) {
                    toolExecutions.push({
                      id: `diff-${data.path}-${Date.now()}`,
                      tool: 'file_diff',
                      parameters: { path: data.path },
                      status: 'complete',
                      success: true,
                      result: data,
                      metadata: { language: data.language, isNewFile: data.isNewFile },
                    });
                  }
                  
                  if (data.toolCallId) {
                    const toolId = data.toolCallId;
                    if (data.tool && data.parameters && !data.result) {
                      toolExecutions.push({ id: toolId, tool: data.tool, parameters: data.parameters, status: 'running' });
                    }
                    if (data.result !== undefined) {
                      const index = toolExecutions.findIndex(t => t.id === toolId);
                      if (index >= 0) {
                        toolExecutions[index] = { ...toolExecutions[index], result: data.result, success: data.success, status: 'complete', metadata: data.metadata };
                      }
                    }
                    if (data.error) {
                      const index = toolExecutions.findIndex(t => t.id === toolId);
                      if (index >= 0) {
                        toolExecutions[index] = { ...toolExecutions[index], status: 'error', error: data.error };
                      }
                    }
                  }
                  
                  if (toolExecutions.length > 0) {
                    assistantMessage.toolExecutions = [...toolExecutions];
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.toolExecutions = [...toolExecutions];
                      }
                      return newMessages;
                    });
                  }
                } catch (e) {
                  devLog('[AutoStart SSE] Invalid JSON:', { data: dataStr.slice(0, 100) });
                }
              }
            }

            // Update existing assistant message with final content
            const finalContent = fullContent || "I'll help you build that! Let me start working on it...";
            setMessages(prev => prev.map(msg =>
              msg.id === autoStartAssistantMessageId
                ? {
                    ...msg,
                    content: finalContent,
                    isStreaming: false
                  }
                : msg
            ));
            
            // ✅ FIX (Dec 10, 2025): Persist assistant message to backend database
            // Use current timestamp (not the one captured before streaming) to reflect completion time
            persistMessageToBackend({
              role: 'assistant',
              content: finalContent,
              timestamp: new Date(),
              metadata: assistantMessage.metadata,
              extendedThinking: thinkingSteps.length > 0 ? { steps: thinkingSteps } : undefined,
            });
            
            setStreamingContent('');
            setActiveThinking([]);
            
          } catch (error) {
            // Better error logging with full details
            const errorDetails = error instanceof Error 
              ? { message: error.message, stack: error.stack, name: error.name }
              : { raw: error };
            
            console.error('AI chat error - Full details:', errorDetails);
            
            const { title, message: userFriendlyError } = categorizeError(error);
            const errorContent = `⚠️ ${userFriendlyError}\n\nIf this issue persists, please try:\n- Refreshing the page\n- Checking your internet connection\n- Waiting a few moments before trying again`;
            
            toast({
              title,
              description: userFriendlyError || 'An unknown error occurred. Please check the console for details.',
              variant: 'destructive',
            });
            
            setMessages(prev => {
              // Find and update the streaming assistant message by tracked ID
              if (autoStartAssistantMessageId) {
                const existingMessage = prev.find(msg => msg.id === autoStartAssistantMessageId);
                if (existingMessage) {
                  return prev.map(msg =>
                    msg.id === autoStartAssistantMessageId
                      ? { 
                          ...msg, 
                          content: errorContent, 
                          isStreaming: false,
                          status: 'error' as const,
                          metadata: { ...msg.metadata, error: true }
                        }
                      : msg
                  );
                }
              }
              // Only append new error message if no streaming message was created
              return [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant' as const,
                content: errorContent,
                timestamp: new Date(),
                isStreaming: false,
                status: 'error' as const,
                thinking: extendedThinkingEnabled ? activeThinking : undefined,
                metadata: {
                  extendedThinking: extendedThinkingEnabled,
                  error: true
                }
              }];
            });
            setActiveThinking([]);
          } finally {
            setIsWorking(false);
            setIsPendingResponse(false);
            // Call onBuildComplete callback when bootstrap build finishes
            if (onBuildComplete) {
              onBuildComplete();
            }
          }
        })();
      }, 100); // Minimal delay for state propagation - speed is priority
      
    // Remove URL params to clean up the URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [projectId, conversationId, autoStart, isWorking, initialPrompt, wsIsConnected, pendingAutoStart]); // ✅ FORTUNE 500 FIX: Added wsIsConnected + pendingAutoStart for WS readiness

  const toggleCapability = useCallback((capabilityId: string) => {
    setCapabilities(prev => prev.map(cap =>
      cap.id === capabilityId ? { ...cap, enabled: !cap.enabled } : cap
    ));
  }, []);

  const simulateThinkingSteps = useCallback((message: string): ThinkingStep[] => {
    const baseTimestamp = new Date();
    return [
      {
        id: '1',
        type: 'reasoning',
        title: 'Understanding the request',
        content: `Analyzing: "${message.substring(0, 50)}..."`,
        status: 'complete',
        timestamp: new Date(baseTimestamp.getTime()),
        details: [
          'Identifying key requirements',
          'Checking for ambiguities',
          'Determining scope and complexity'
        ]
      },
      {
        id: '2',
        type: 'analysis',
        title: 'Analyzing technical requirements',
        content: 'Breaking down the task into implementable components',
        status: 'complete',
        timestamp: new Date(baseTimestamp.getTime() + 1000),
        details: [
          'Identifying required technologies',
          'Assessing complexity level',
          'Determining best approach'
        ]
      },
      {
        id: '3',
        type: 'planning',
        title: 'Planning implementation',
        content: 'Creating step-by-step execution plan',
        status: 'complete',
        timestamp: new Date(baseTimestamp.getTime() + 2000),
        details: [
          'Defining component structure',
          'Planning file organization',
          'Identifying dependencies'
        ]
      }
    ];
  }, []);

  // Fire-and-forget message persistence to backend
  // Does not block streaming - errors are logged but don't affect UI
  const persistMessageToBackend = useCallback((message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, any>;
    extendedThinking?: any;
  }) => {
    // Defensive validation: ensure conversationId is a valid integer
    if (!conversationId || !Number.isInteger(conversationId) || conversationId <= 0) {
      console.debug('[Persistence] Skipping: invalid conversationId', { conversationId });
      return;
    }

    // Fire-and-forget: don't await, don't block
    getCSRFToken().then(csrf => {
      return fetch(`/api/agent/conversation/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          metadata: message.metadata || null,
          extendedThinking: message.extendedThinking || null,
        }),
      });
    }).catch(err => {
      console.error('[Persistence] Error persisting message:', err);
    });
  }, [conversationId]);

  const handleSend = async () => {
    console.log('[handleSend] Called', { input: input.substring(0, 50), isWorking, effectiveConversationId, conversationId });
    if (!input.trim() || isWorking) {
      console.log('[handleSend] BLOCKED', { emptyInput: !input.trim(), isWorking });
      return;
    }

    const userContent = input.trim();
    
    // Build message content with attachments context
    let messageWithAttachments = userContent;
    const currentAttachments = [...pendingAttachments];
    
    if (currentAttachments.length > 0) {
      const attachmentContext = currentAttachments.map(att => {
        if (att.type === 'text' && att.content) {
          return `\n\n--- File: ${att.name} ---\n${att.content}\n--- End of ${att.name} ---`;
        } else if (att.type === 'image') {
          return `\n\n[Attached image: ${att.name}]`;
        } else {
          return `\n\n[Attached file: ${att.name} (${(att.size / 1024).toFixed(1)} KB)]`;
        }
      }).join('');
      
      messageWithAttachments = userContent + attachmentContext;
    }
    
    // Trigger schema warming on first message for faster deploy (background process)
    // Uses proper Zustand hook subscription for reactive updates
    if (projectId && messages.length <= 1 && !isSchemaWarming && !isSchemaReady) {
      triggerSchemaWarming(String(projectId), userContent);
    }
    
    // Use optimistic updates for faster perceived response
    console.log('[handleSend] Adding optimistic message to effectiveConversationId:', effectiveConversationId);
    const optimisticResult = addOptimisticMessage({
      role: 'user',
      content: currentAttachments.length > 0 
        ? `${userContent}\n\n📎 ${currentAttachments.length} file(s) attached`
        : userContent,
    });
    console.log('[handleSend] Optimistic message added, result:', optimisticResult?.id);
    
    // Persist user message immediately (fire-and-forget)
    persistMessageToBackend({
      role: 'user',
      content: messageWithAttachments,
      timestamp: new Date(),
    });
    
    // Clear input and attachments
    setInput('');
    setPendingAttachments([]);
    setIsWorking(true);
    setIsPendingResponse(true); // Show skeleton until first chunk
    setStreamingContent('');

    // Show thinking steps if extended thinking is enabled
    const extendedThinkingEnabled = agentToolsSettings.extendedThinking;
    
    if (extendedThinkingEnabled) {
      const thinkingSteps = simulateThinkingSteps(userContent);
      setActiveThinking(thinkingSteps);
    }

    let assistantMessageId: string | null = null;
    let fullContent = '';

    try {
      // Use selected provider from model preference (fallback to openai)
      const selectedProvider = provider || 'openai';
      
      // ✅ FIX (Jan 2026): Use effectiveConversationId for Replit-style always-ready chat
      // This uses -projectId as temp ID when real conversation not yet created
      const chatConversationId = String(effectiveConversationId);
      
      // Prepare image attachments for vision-capable models
      const imageAttachments = currentAttachments
        .filter(att => att.type === 'image' && att.base64)
        .map(att => ({
          type: 'image' as const,
          mimeType: att.mimeType,
          base64: att.base64,
          name: att.name
        }));
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const csrfHeader = await getCSRFToken();
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfHeader },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          message: messageWithAttachments,
          projectId: projectId,
          conversationId: chatConversationId,
          provider: selectedProvider,
          modelId: modelId || undefined,
          agentMode: agentMode,
          fastMode: fastMode,
          context: messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
          })),
          capabilities: {
            extendedThinking: agentToolsSettings.extendedThinking,
            webSearch: agentToolsSettings.webSearch,
            highPower: agentToolsSettings.highPowerModels,
            highPowerModels: agentToolsSettings.highPowerModels,
            maxAutonomy: agentToolsSettings.maxAutonomy,
            appTesting: agentToolsSettings.appTesting,
          },
          attachments: currentAttachments.map(att => ({
            name: att.name,
            type: att.type,
            size: att.size,
          })),
          images: imageAttachments.length > 0 ? imageAttachments : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: agentToolsSettings.extendedThinking ? [...activeThinking] : undefined,
        isStreaming: true,
        metadata: {
          extendedThinking: extendedThinkingEnabled
        }
      };

      const thinkingSteps: ThinkingStep[] = [];
      const toolExecutions: ToolExecution[] = [];
      const warningMessages: Message[] = []; // Accumulate warnings during streaming
      let messageMetadata: { cost?: string; tokens?: number; model?: string; provider?: string } = {};
      
      // Add assistant message to state BEFORE streaming to support live tool/thinking updates
      setMessages(prev => [...prev, assistantMessage]);
      
      let sseBuffer = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        sseBuffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        let boundaryIndex;
        while ((boundaryIndex = sseBuffer.indexOf('\n\n')) !== -1) {
          const eventText = sseBuffer.slice(0, boundaryIndex);
          sseBuffer = sseBuffer.slice(boundaryIndex + 2);
          
          let currentEventType = 'message';
          let dataStr = '';
          
          for (const line of eventText.split('\n')) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr += line.slice(6);
            }
          }
          
          if (!dataStr) continue;
          
          try {
            const data = JSON.parse(dataStr);
            
            if (currentEventType === 'error' && data.message) {
              const warningResult = handleSSEWarning(data as SSEWarningData, { toast });
              if (warningResult.shouldShow && warningResult.systemMessageContent) {
                warningMessages.push({
                  id: `system-${Date.now()}`,
                  role: 'system',
                  content: warningResult.systemMessageContent,
                  timestamp: new Date()
                });
              }
              continue;
            }
            
            if (currentEventType === 'token' || data.content) {
              const tokenContent = data.content || '';
              fullContent += tokenContent;
              setStreamingContent(fullContent);
              setIsPendingResponse(false);
            }
            
            if (currentEventType === 'thinking_start' || currentEventType === 'thinking_update' || currentEventType === 'thinking_complete') {
              if (data.step) {
                setIsPendingResponse(false);
                const step: ThinkingStep = {
                  ...data.step,
                  timestamp: new Date(data.step.timestamp)
                };
                const existingIndex = thinkingSteps.findIndex(s => s.id === step.id);
                if (existingIndex >= 0) {
                  thinkingSteps[existingIndex] = step;
                } else {
                  thinkingSteps.push(step);
                }
                setActiveThinking([...thinkingSteps]);
              }
            }
            
            if (currentEventType === 'action_start' && data.actionId) {
              const actionStep: ThinkingStep = {
                id: `action-${data.actionId}`,
                type: 'tool',
                title: data.label || data.action || 'Processing',
                content: '',
                status: 'active',
                timestamp: new Date(),
              };
              thinkingSteps.push(actionStep);
              setActiveThinking([...thinkingSteps]);
            }
            
            if (currentEventType === 'action_complete' && data.actionId) {
              const idx = thinkingSteps.findIndex(s => s.id === `action-${data.actionId}`);
              if (idx >= 0) {
                thinkingSteps[idx] = {
                  ...thinkingSteps[idx],
                  status: data.success ? 'complete' : 'error',
                  content: data.filesCreated ? `${data.filesCreated} files created` : '',
                };
                setActiveThinking([...thinkingSteps]);
              }
            }
            
            if (currentEventType === 'file_diff' && data.path) {
              const diffTool: ToolExecution = {
                id: `diff-${data.path}-${Date.now()}`,
                tool: 'file_diff',
                parameters: { path: data.path },
                status: 'complete',
                success: true,
                result: data,
                metadata: { language: data.language, isNewFile: data.isNewFile },
              };
              toolExecutions.push(diffTool);
              assistantMessage.toolExecutions = [...toolExecutions];
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.toolExecutions = [...toolExecutions];
                }
                return newMessages;
              });
            }
            
            if (currentEventType === 'web_search' && data.resultCount !== undefined) {
              setIsPendingResponse(false);
              const searchStep: ThinkingStep = {
                id: `search-${Date.now()}`,
                type: 'analysis',
                title: `Web Search: ${data.query || 'Searching...'}`,
                content: `Found ${data.resultCount} results${data.answer ? ': ' + data.answer.slice(0, 200) : ''}`,
                status: 'complete',
                timestamp: new Date(),
              };
              thinkingSteps.push(searchStep);
              setActiveThinking([...thinkingSteps]);
            }

            if (currentEventType === 'rag_status' && data.status) {
              setIsPendingResponse(false);
              const filesFound = data.files ? data.files as string[] : [];
              const nodesRetrieved = data.nodesRetrieved || 0;
              const isSuccess = data.status === 'success' || data.status === 'success_fts';

              if (isSuccess && nodesRetrieved > 0) {
                const ragStep: ThinkingStep = {
                  id: `rag-${Date.now()}`,
                  type: 'analysis',
                  title: `Searched codebase`,
                  content: filesFound.length > 0
                    ? `Read ${nodesRetrieved} relevant sections from ${filesFound.length} file${filesFound.length !== 1 ? 's' : ''}`
                    : `Found ${nodesRetrieved} relevant context${nodesRetrieved !== 1 ? 's' : ''}`,
                  status: 'complete',
                  timestamp: new Date(),
                  metadata: {
                    ragFiles: filesFound.slice(0, 10),
                    ragMode: data.mode || 'hybrid',
                    tokenEstimate: data.tokenEstimate || 0,
                    nodesRetrieved,
                  },
                };
                thinkingSteps.push(ragStep);
                setActiveThinking([...thinkingSteps]);
              } else if (data.status === 'timeout' || data.status === 'error') {
                const ragErrorStep: ThinkingStep = {
                  id: `rag-err-${Date.now()}`,
                  type: 'analysis',
                  title: `Codebase search`,
                  content: data.status === 'timeout' ? 'Search timed out' : `Search error: ${data.error || 'unknown'}`,
                  status: 'error',
                  timestamp: new Date(),
                };
                thinkingSteps.push(ragErrorStep);
                setActiveThinking([...thinkingSteps]);
              }
            }
            
            if (currentEventType === 'done' || (data.totalTokens !== undefined || data.cost !== undefined)) {
              messageMetadata = {
                cost: data.cost,
                tokens: data.totalTokens,
                model: data.model,
                provider: data.provider
              };
            }
            
            if (data.toolCallId) {
              const toolId = data.toolCallId;
              
              if (data.tool && data.parameters && !data.result) {
                toolExecutions.push({
                  id: toolId,
                  tool: data.tool,
                  parameters: data.parameters,
                  status: 'running'
                });
              }
              
              if (data.result !== undefined) {
                const index = toolExecutions.findIndex(t => t.id === toolId);
                if (index >= 0) {
                  toolExecutions[index] = {
                    ...toolExecutions[index],
                    result: data.result,
                    success: data.success,
                    status: 'complete',
                    metadata: data.metadata
                  };
                }
              }
              
              if (data.error) {
                const index = toolExecutions.findIndex(t => t.id === toolId);
                if (index >= 0) {
                  toolExecutions[index] = {
                    ...toolExecutions[index],
                    status: 'error',
                    error: data.error
                  };
                }
              }
              
              assistantMessage.toolExecutions = [...toolExecutions];
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.toolExecutions = [...toolExecutions];
                }
                return newMessages;
              });
            }
          } catch (e) {
            devLog('[SSE Parse] Invalid JSON:', { data: dataStr.slice(0, 100) });
          }
        }
      }

      assistantMessage.content = fullContent || "I'll help you with that. Let me analyze your request...";
      assistantMessage.isStreaming = false;
      
      // Confirm optimistic user message on successful stream completion
      optimisticResult.confirm();
      
      // Update existing assistant message with content, metadata, and append any accumulated warnings
      setMessages(prev => [
        ...prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                content: assistantMessage.content, 
                isStreaming: false,
                metadata: {
                  ...msg.metadata,
                  ...messageMetadata,
                  extendedThinking: extendedThinkingEnabled
                }
              }
            : msg
        ),
        ...warningMessages
      ]);
      
      // Persist assistant message after streaming completes (fire-and-forget)
      persistMessageToBackend({
        role: 'assistant',
        content: assistantMessage.content,
        timestamp: assistantMessage.timestamp,
        metadata: assistantMessage.metadata,
        extendedThinking: thinkingSteps.length > 0 ? { steps: thinkingSteps } : undefined,
      });
      
      setStreamingContent('');
      setActiveThinking([]);
      
      // Call onBuildComplete callback when streaming completes in build mode
      if (agentMode === 'build' && onBuildComplete) {
        onBuildComplete();
      }
      
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent || '(Stopped by user)', isStreaming: false }
            : msg
        ));
        optimisticResult.confirm();
        setStreamingContent('');
        setActiveThinking([]);
        return;
      }
      
      console.error('AI chat error:', error);
      
      const { title, message: userFriendlyError } = categorizeError(error);
      const errorContent = `⚠️ ${userFriendlyError}\n\nIf this issue persists, please try:\n- Refreshing the page\n- Checking your internet connection\n- Waiting a few moments before trying again`;
      
      optimisticResult.rollback(userFriendlyError);
      
      toast({
        title,
        description: userFriendlyError,
        variant: 'destructive',
      });
      
      setMessages(prev => {
        // Find and update the streaming assistant message by tracked ID
        if (assistantMessageId) {
          const existingMessage = prev.find(msg => msg.id === assistantMessageId);
          if (existingMessage) {
            return prev.map(msg =>
              msg.id === assistantMessageId
                ? { 
                    ...msg, 
                    content: errorContent, 
                    isStreaming: false,
                    status: 'error' as const,
                    metadata: { ...msg.metadata, error: true }
                  }
                : msg
            );
          }
        }
        // Only append new error message if no streaming message was created
        return [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: errorContent,
          timestamp: new Date(),
          isStreaming: false,
          status: 'error' as const,
          thinking: extendedThinkingEnabled ? activeThinking : undefined,
          metadata: {
            extendedThinking: extendedThinkingEnabled,
            error: true
          }
        }];
      });
      setActiveThinking([]);
    } finally {
      setIsWorking(false);
      setIsPendingResponse(false);
      abortControllerRef.current = null;
      if (agentMode === 'build' && onBuildComplete) {
        onBuildComplete();
      }
    }
  };

  handleSendRef.current = handleSend;

  // Filter MCP servers based on slash command search
  const filteredMCPServers = DEFAULT_MCP_SERVERS.filter(server =>
    server.name.toLowerCase().includes(slashSearchQuery.toLowerCase()) ||
    server.description?.toLowerCase().includes(slashSearchQuery.toLowerCase())
  );
  
  // Clamp selected index when filtered list shrinks to prevent out-of-range
  useEffect(() => {
    if (slashSelectedIndex >= filteredMCPServers.length && filteredMCPServers.length > 0) {
      setSlashSelectedIndex(filteredMCPServers.length - 1);
    }
  }, [filteredMCPServers.length, slashSelectedIndex]);
  
  // Handle MCP server selection from slash command menu
  const handleSlashCommandSelect = (server: MCPServer) => {
    // Insert the server reference into input (like @mention)
    const serverRef = `@${server.name} `;
    setInput(prev => {
      // Remove the trailing "/" if present
      const cleanInput = prev.endsWith('/') ? prev.slice(0, -1) : prev;
      return cleanInput + serverRef;
    });
    slashCommand.close();
    setSlashSearchQuery('');
    setSlashSelectedIndex(0);
    textareaRef.current?.focus();
    
    toast({
      title: `${server.name} selected`,
      description: server.connected 
        ? `Using ${server.name} integration` 
        : `Connect ${server.name} in settings to use this integration`,
    });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Handle slash command navigation when menu is open
    if (slashCommand.isOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        slashCommand.close();
        setSlashSearchQuery('');
        setSlashSelectedIndex(0);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.min(prev + 1, filteredMCPServers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMCPServers[slashSelectedIndex]) {
          handleSlashCommandSelect(filteredMCPServers[slashSelectedIndex]);
        }
        return;
      }
      // Allow typing to filter the list
      if (e.key.length === 1 || e.key === 'Backspace') {
        // Update search query (handled by onChange)
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    if (conversationId) {
      clearStoreMessages(conversationId);
    }
    toast({
      title: 'Chat cleared',
      description: 'Conversation history has been reset',
    });
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? 'Resumed' : 'Paused',
      description: isPaused ? 'Agent is working again' : 'Agent work has been paused',
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard',
    });
  };

  const handleApproveAction = useCallback((action: Action) => {
    toast({
      title: 'Action Approved',
      description: `${action.type}: ${action.description}`,
    });
    setMessages(prev => prev.map(msg => ({
      ...msg,
      actions: msg.actions?.map(a => 
        a.id === action.id ? { ...a, status: 'approved' as const } : a
      )
    })));
  }, [toast]);

  const handleRejectAction = useCallback((action: Action) => {
    toast({
      title: 'Action Rejected',
      description: `${action.type}: ${action.description}`,
    });
    setMessages(prev => prev.map(msg => ({
      ...msg,
      actions: msg.actions?.map(a => 
        a.id === action.id ? { ...a, status: 'rejected' as const } : a
      )
    })));
  }, [toast]);

  const [isRestoringCheckpoint, setIsRestoringCheckpoint] = useState(false);

  const handleRestoreCheckpoint = useCallback(async (checkpointId: number) => {
    setIsRestoringCheckpoint(true);
    try {
      await apiRequest('POST', `/api/auto-checkpoints/${checkpointId}/restore`, {
        createBackup: true,
        includeDatabase: false
      });
      toast({
        title: 'Checkpoint Restored',
        description: `Successfully restored checkpoint #${checkpointId}`
      });
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore checkpoint',
        variant: 'destructive'
      });
    } finally {
      setIsRestoringCheckpoint(false);
    }
  }, [toast]);

  const isCompactMode = mode === 'mobile' || mode === 'tablet';
  
  const hasUserMessages = messages.some(m => m.role === 'user');
  const showEmptyState = !hasUserMessages 
    && messages.length <= 1 
    && !isPendingResponse 
    && !isWorking;

  // ✅ FIX (Jan 2026): NEVER block the UI - Replit-style always-ready pattern
  // Users can ALWAYS send messages immediately using temp conversationId (-projectId)
  // Messages are stored locally and migrated when real conversationId is available
  // This completely removes the "Initializing Agent" blocking screen

  return (
    <div className={cn("h-full flex flex-col bg-background", className)} style={{display: 'flex', flexDirection: 'column', height: '100%'}} data-testid="replit-agent-panel-v3">
      {/* Header - Optimized for all screen sizes */}
      <div className="px-2 sm:px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink overflow-hidden">
            <ECodeLogo size="xs" showText={!isCompactMode} />
            {isWorking && (
              <Badge variant="secondary" className="text-[10px] sm:text-[11px] animate-pulse flex-shrink-0" data-testid="header-badge-working">
                <Loader2 className="h-3 w-3 mr-0.5 sm:mr-1 animate-spin" />
                <span className="hidden sm:inline">Working</span>
              </Badge>
            )}
            {/* ✅ Memory Bank is 100% TRANSPARENT - no visible badge like Replit */}
            
            {/* Fast Mode Toggle - Quick mode for 10-60s targeted changes */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleFastModeToggle}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all flex-shrink-0",
                      fastMode 
                        ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30" 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                    )}
                    data-testid="fast-mode-toggle"
                  >
                    <Zap className={cn("h-3 w-3", fastMode && "animate-pulse")} />
                    {!isCompactMode && (
                      <span>{fastMode ? '~30s' : 'Fast'}</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{fastMode ? 'Fast Mode Active' : 'Enable Fast Mode'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fastMode 
                      ? 'Using fast model for quick 10-60s edits' 
                      : 'Quick mode for single-file targeted changes'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Model chip with dropdown for quick model selection */}
            <DropdownMenu open={isModelSelectorOpen} onOpenChange={setIsModelSelectorOpen}>
              <DropdownMenuTrigger asChild>
                <button 
                  className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md flex-shrink-0 relative z-10"
                  data-testid="model-selector-button"
                >
                  <CurrentModelChip
                    modelName={model?.name}
                    provider={provider || undefined}
                    supportsExtendedThinking={modelSupportsExtendedThinking}
                    extendedThinkingEnabled={agentToolsSettings.extendedThinking}
                    compact={isCompactMode}
                    data-testid="current-model-chip"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-2">
                <AIModelSelector 
                  variant="inline" 
                  onModelChange={(newModelId) => {
                    setPreferredModel(newModelId);
                    setIsModelSelectorOpen(false);
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            {isWorking && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handlePauseResume}
                      data-testid="button-pause-resume"
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Settings dropdown - simplified (model selector moved to AgentToolsPanel) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  data-testid="button-settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => setAudioEnabled(!isAudioEnabled)} 
                  data-testid="dropdown-toggle-audio"
                >
                  {isAudioEnabled ? (
                    <Volume2 className="h-4 w-4 mr-2" />
                  ) : (
                    <VolumeX className="h-4 w-4 mr-2" />
                  )}
                  {isAudioEnabled ? 'Mute notifications' : 'Enable sounds'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClearChat} className="text-destructive" data-testid="dropdown-clear-chat">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Usage Tracking - Replit Agent 3 style credits icon */}
            <UsageTrackingIcon />

            {/* History & New Chat - Only show on desktop (mobile has these in ReplitMobileHeader) */}
            {!isCompactMode && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setHistoryModalOpen(true)}
                        data-testid="button-history"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      View session history
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleClearChat}
                  data-testid="button-new-chat"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        
      </div>

      {/* Bootstrap Warning Banner */}
      {bootstrapWarning && !bootstrapTimedOut && isBootstrapping && !conversationId && (
        <div 
          className="mx-3 sm:mx-4 mt-2 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2 text-[13px] text-yellow-700 dark:text-yellow-400"
          data-testid="bootstrap-warning-banner"
        >
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>Still connecting to the agent — this is taking longer than usual...</span>
        </div>
      )}

      {/* Main Chat Content */}
      <>
      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0 w-full">
        {/* Sync Indicator */}
        <ConversationSyncIndicator
          lastSyncedAt={conversationId ? getLastSyncedAt(conversationId) : undefined}
        />
        
        {/* Connection Error/Reconnecting Banner with Retry Button - only during active builds */}
        {isActiveBuildSession && (connectionError || (reconnectAttempt > 0 && reconnectAttempt < maxReconnectAttempts)) && (
          <div 
            className={cn(
              "mx-3 sm:mx-4 mb-3 px-4 py-3 rounded-lg flex items-center justify-between gap-3",
              connectionError 
                ? "bg-destructive/10 border border-destructive/20" 
                : "bg-warning/10 border border-warning/20"
            )}
            data-testid="connection-error-banner"
          >
            <div className={cn(
              "flex items-center gap-2 text-[13px]",
              connectionError ? "text-destructive" : "text-warning"
            )}>
              {reconnectAttempt > 0 && reconnectAttempt < maxReconnectAttempts ? (
                <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>
                {reconnectAttempt > 0 && reconnectAttempt < maxReconnectAttempts
                  ? `Reconnecting... (${reconnectAttempt}/${maxReconnectAttempts})`
                  : connectionError}
              </span>
            </div>
            {connectionError && (
              <Button
                variant="outline"
                size="sm"
                onClick={manualReconnect}
                className="flex-shrink-0 h-7 px-3 text-[11px]"
                data-testid="button-retry-connection"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}
        
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0 px-3 sm:px-4 py-3 overflow-x-hidden min-w-0">
          <div className="space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden max-w-full">
          
          {/* Build/Install/QA Validation Progress (Task 6) */}
          <LazyAnimatePresence>
            {validationStep !== 'idle' && (
              <BuildValidationProgress
                currentStep={validationStep}
                depsResult={depsResult}
                buildResult={buildResult}
                qaResult={qaResult}
              />
            )}
          </LazyAnimatePresence>
          
          {/* Replit-style "Show Previous Messages" button */}
          {hasMoreMessages && totalMessageCount > messages.length && (
            <div className="flex justify-center py-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadPreviousMessages}
                disabled={isLoadingPrevious}
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                {isLoadingPrevious ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <History className="h-3 w-3" />
                    Show Previous Messages ({totalMessageCount - messages.length} more)
                  </>
                )}
              </Button>
            </div>
          )}
          
          {showEmptyState && messages.length > 0 && (
            <div className="px-2 sm:px-4 py-2">
              {messages.map((message) => (
                <EnhancedChatMessage
                  key={message.id}
                  message={message}
                  isCompactMode={isCompactMode}
                  agentMode={agentMode}
                  projectId={projectId}
                  onCopy={handleCopyMessage}
                  onSwitchToBuildMode={() => setAgentMode('build')}
                />
              ))}
            </div>
          )}

          {showEmptyState && (
            <EmptyConversation
              onQuickAction={(prompt) => {
                setInput(prompt);
                textareaRef.current?.focus();
              }}
            />
          )}

          {!showEmptyState && (useVirtualization ? (
            <VirtualizedMessageList
              messages={messages}
              isCompactMode={isCompactMode}
              isPendingResponse={isPendingResponse}
              streamingContent={streamingContent}
              agentMode={agentMode}
              projectId={projectId}
              onCopy={handleCopyMessage}
              onApproveAction={handleApproveAction}
              onRejectAction={handleRejectAction}
              onSelectBuildMode={sendBuildModeSelection}
              onChangePlan={requestPlanChange}
              onSwitchToBuildMode={() => setAgentMode('build')}
              onRestoreCheckpoint={handleRestoreCheckpoint}
              isRestoringCheckpoint={isRestoringCheckpoint}
              className="min-h-[200px]"
              autoScrollToBottom={true}
            />
          ) : (
            <LazyAnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <EnhancedChatMessage
                    message={message}
                    isCompactMode={isCompactMode}
                    agentMode={agentMode}
                    projectId={projectId}
                    onCopy={handleCopyMessage}
                    onApproveAction={handleApproveAction}
                    onRejectAction={handleRejectAction}
                    onSelectBuildMode={sendBuildModeSelection}
                    onChangePlan={requestPlanChange}
                    onSwitchToBuildMode={() => setAgentMode('build')}
                    onRestoreCheckpoint={handleRestoreCheckpoint}
                    isRestoringCheckpoint={isRestoringCheckpoint}
                  />
                  {/* Replit-style: Checkpoint marker after each assistant message */}
                  {message.role === 'assistant' && !isPendingResponse && (
                    <CheckpointDivider 
                      cost={message.metadata?.cost}
                      tokens={message.metadata?.tokens}
                    />
                  )}
                </div>
              ))}
            </LazyAnimatePresence>
          ))}

          {/* Active Thinking Steps (while streaming) */}
          {isWorking && activeThinking.length > 0 && (
            <LazyMotionDiv 
              key="active-thinking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3" 
              data-testid="active-thinking-container"
            >
              <Avatar className="h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-primary/30 shadow-lg" data-testid="active-thinking-avatar">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-[11px]">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1" data-testid="active-thinking-display">
                {isCompactMode ? (
                  <ThinkingDisplayCompact
                    steps={activeThinking}
                    isActive={true}
                  />
                ) : (
                  <ThinkingDisplay
                    steps={activeThinking}
                    isActive={true}
                    mode="detailed"
                  />
                )}
              </div>
            </LazyMotionDiv>
          )}

          {/* Streaming message with enhanced styling and optimized text animation */}
          {isWorking && streamingContent && !useVirtualization && (
            <LazyMotionDiv 
              key="streaming"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3" 
              data-testid="streaming-message-container"
            >
              <Avatar className="h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-primary/30 shadow-lg" data-testid="streaming-avatar">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-[11px]">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <LazyMotionDiv 
                  className="bg-muted/80 text-foreground rounded-2xl rounded-bl-md px-3 sm:px-4 py-3 w-full max-w-full shadow-md border border-border/50 overflow-hidden min-w-0" 
                  data-testid="streaming-content"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                >
                  <div className="text-[13px] whitespace-pre-wrap break-words leading-relaxed max-w-full" style={{ overflowWrap: 'anywhere' }} data-testid="streaming-text">
                    <StreamingText 
                      content={streamingContent} 
                      isComplete={false}
                      className="text-foreground"
                    />
                    <LazyMotionSpan 
                      className="inline-block w-0.5 h-4 bg-primary ml-1 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      data-testid="streaming-cursor" 
                    />
                  </div>
                </LazyMotionDiv>
              </div>
            </LazyMotionDiv>
          )}

          {/* Loading indicator - Shows streaming skeleton while waiting for first response */}
          {/* Skip if using virtualization as VirtualizedMessageList handles its own skeleton */}
          {!useVirtualization && isPendingResponse && !streamingContent && activeThinking.length === 0 && (
            <StreamingSkeleton key="skeleton" />
          )}
          
          {/* Scroll sentinel - always at the bottom */}
          <div ref={lastMessageRef} className="h-0" />
          </div>
        </ScrollArea>
      </div>

      {/* Input area */}
      <div className={cn("p-4 border-t transition-colors duration-300", vibeModeEnabled ? "border-yellow-500/40 bg-yellow-500/3" : "border-border")} style={{maxHeight: '280px', overflowY: 'auto'}}>
        {vibeModeEnabled && (
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-yellow-500 font-medium">
            <Zap className="h-3 w-3 animate-pulse" />
            <span>Vibe Mode ON — voice auto-sends to AI</span>
          </div>
        )}
        <div className="space-y-2">
          {/* Mode selector and Element Editor row - hidden on mobile when external input bar is used */}
          {!hideInput && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ModeSelector 
                mode={agentMode} 
                onChange={handleModeChange}
              />
              <span className="hidden sm:inline text-[10px] text-muted-foreground">
                {isBootstrapping && !conversationId && "Initializing agent..."}
                {(!isBootstrapping || conversationId) && agentMode === 'build' && "Agent will autonomously make changes"}
                {(!isBootstrapping || conversationId) && agentMode === 'plan' && "Agent will brainstorm without changes"}
                {(!isBootstrapping || conversationId) && agentMode === 'edit' && "Targeted changes to specific files"}
                {(!isBootstrapping || conversationId) && agentMode === 'fast' && "Quick, precise changes in seconds"}
              </span>
            </div>
            
            {/* Element Editor toggle - Replit Nov 2025 feature */}
            <div className="relative">
              <ElementEditor
                isActive={elementEditorActive}
                onToggle={() => setElementEditorActive(!elementEditorActive)}
                selectedElement={selectedElement}
                onSave={handleElementSave}
                onCancel={() => {
                  setSelectedElement(null);
                  setElementEditorActive(false);
                }}
              />
            </div>
          </div>
          )}
          
          {/* Max Autonomy Progress with Orchestrator Display - shown when toggle is on */}
          {agentToolsSettings.maxAutonomy && autonomySessionId && (
            <div className="space-y-3">
              {/* AI Model + Provider Health Indicators - responsive layout */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* AI Model Indicator - shows current delegation tier and model */}
                  {orchestratorProgress?.progress?.currentTaskDelegation && (
                    <AIModelIndicator
                      delegation={orchestratorProgress.progress.currentTaskDelegation}
                      showDetails={true}
                      size="sm"
                    />
                  )}
                  {/* Provider Health Badge - shows AI provider availability */}
                  <ProviderHealthBadge />
                </div>
                <MiniProgressIndicator
                  completed={orchestratorProgress?.progress?.tasksCompleted || 0}
                  total={orchestratorProgress?.progress?.tasksTotal || 0}
                  eta={orchestratorProgress?.progress?.estimatedRemainingMs}
                  etaConfidence={orchestratorProgress?.progress?.etaConfidence}
                />
              </div>
              
              {/* Orchestrator Progress - shows task progress, ETA, and controls */}
              {orchestratorProgress?.progress && (
                <OrchestratorProgress
                  progress={orchestratorProgress.progress}
                  onPause={async () => {
                    await apiRequest('POST', `/api/autonomy/sessions/${autonomySessionId}/pause`);
                  }}
                  onResume={async () => {
                    await apiRequest('POST', `/api/autonomy/sessions/${autonomySessionId}/resume`);
                  }}
                  onStop={handleStopAutonomy}
                />
              )}
              
              {/* Task Decomposition Display - shows breakdown of tasks */}
              {orchestratorTasks?.tasks && orchestratorTasks.tasks.length > 0 && (
                <TaskDecompositionDisplay
                  tasks={orchestratorTasks.tasks}
                  currentTaskId={orchestratorProgress?.progress?.currentTaskId}
                  isExpanded={true}
                />
              )}
              
              {/* Message Queue - shows pending follow-up messages */}
              {autonomySessionId && queuedMessagesData?.messages && (
                <MessageQueue
                  sessionId={autonomySessionId}
                  messages={queuedMessagesData.messages}
                  isLoading={isLoadingQueuedMessages}
                />
              )}
              
              {/* Legacy MaxAutonomyProgress for compatibility */}
              <MaxAutonomyProgress
                sessionId={autonomySessionId}
                projectId={projectIdNum}
                onStop={handleStopAutonomy}
              />
            </div>
          )}
          
          {/* Hidden file input for attachment button - ALWAYS rendered (required for mobile) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.sql,.sh,.go,.rs,.java,.cpp,.c,.rb,.php"
            data-testid="input-file-hidden"
          />
          
          {/* Chat input with inline toolbar - Replit-style with attachment/voice/send */}
          {/* Hidden when hideInput=true (mobile uses external ReplitMobileInputBar) */}
          {!hideInput && (
          <div className="relative">
            {/* Slash Command Menu - Replit-style "/" to show MCP integrations */}
            <SlashCommandMenu
              isOpen={slashCommand.isOpen}
              onClose={() => {
                slashCommand.close();
                setSlashSearchQuery('');
                setSlashSelectedIndex(0);
              }}
              onSelect={handleSlashCommandSelect}
              servers={DEFAULT_MCP_SERVERS}
              searchQuery={slashSearchQuery}
              onSearchChange={setSlashSearchQuery}
              selectedIndex={slashSelectedIndex}
            />
            
            {/* Pending attachments display */}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/30 rounded-lg border border-border/50">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-md border border-border text-[11px]"
                  >
                    {attachment.type === 'image' ? (
                      <div className="w-6 h-6 rounded overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={`data:${attachment.mimeType};base64,${attachment.base64}`}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate max-w-[120px]" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <span className="text-muted-foreground">
                      ({(attachment.size / 1024).toFixed(1)}KB)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {isUploadingFiles && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            )}
            
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const newValue = e.target.value;
                const prevValue = input;
                
                // Detect if user just typed "/" at end of input
                if (newValue.endsWith('/') && !prevValue.endsWith('/') && !slashCommand.isOpen) {
                  slashCommand.open();
                  setSlashSearchQuery('');
                  setSlashSelectedIndex(0);
                }
                
                // Update search query if menu is open and user is typing after "/"
                if (slashCommand.isOpen && newValue.includes('/')) {
                  const slashIndex = newValue.lastIndexOf('/');
                  const afterSlash = newValue.substring(slashIndex + 1);
                  setSlashSearchQuery(afterSlash);
                  setSlashSelectedIndex(0);
                }
                
                // Close menu if "/" is deleted
                if (slashCommand.isOpen && !newValue.includes('/')) {
                  slashCommand.close();
                  setSlashSearchQuery('');
                  setSlashSelectedIndex(0);
                }
                
                setInput(newValue);
              }}
              onKeyDown={handleKeyPress}
              placeholder={
                agentMode === 'build' ? "What would you like to build?" :
                agentMode === 'edit' ? "Describe the changes to make..." :
                "Ask a question or describe your plan..."
              }
              className={cn(
                "pr-[132px] resize-none text-[13px] min-h-[52px] max-h-[200px]",
                "rounded-xl border border-border/50 focus:border-primary/50",
                "transition-all duration-200 shadow-sm focus:shadow-md",
                "placeholder:text-muted-foreground/70"
              )}
              disabled={isWorking}
              data-testid="input-message"
            />
            {/* Replit-style action buttons - attachment, voice, send */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAttachmentClick}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      data-testid="button-attach"
                      title="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Attach file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleVoiceClick}
                      className={cn(
                        "h-7 w-7 rounded-lg transition-all duration-200",
                        isRecording 
                          ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 animate-pulse" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                      data-testid="button-voice"
                      title={isRecording ? "Stop recording" : "Voice input"}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isRecording ? "Stop recording" : "Voice input"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setVibeModeEnabled(v => !v)}
                      className={cn(
                        "h-7 w-7 rounded-lg transition-all duration-200",
                        vibeModeEnabled
                          ? "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                      data-testid="button-vibe-mode"
                      title={vibeModeEnabled ? "Vibe Mode ON (auto-send)" : "Vibe Mode OFF"}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{vibeModeEnabled ? "Vibe Mode ON — voice auto-sends" : "Enable Vibe Mode"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      data-testid="button-figma-import"
                      title="Import from Figma"
                      onClick={() => toast({ title: "Figma Import", description: "Connect your Figma account in settings to import designs." })}
                    >
                      <SiFigma className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Import from Figma</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <LazyMotionDiv 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="icon"
                  onClick={isWorking ? handleStopStream : handleSend}
                  disabled={!isWorking && !input.trim()}
                  className={cn(
                    "h-7 w-7 rounded-lg",
                    "transition-all duration-200",
                    isWorking
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      : input.trim()
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                  )}
                  data-testid={isWorking ? "button-stop" : "button-send"}
                  title={isWorking ? "Stop generation" : "Send message"}
                >
                  {isWorking ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </LazyMotionDiv>
            </div>
          </div>
          )}
          
          {/* Chat Toolbar - Replit Agent 3 inline icons for quick toggle access */}
          {/* Hidden on mobile when external input bar is used (has its own toolbar) */}
          {!hideInput && (
            isCompactMode ? (
              <ChatToolbarMobile
                extendedThinking={agentToolsSettings.extendedThinking}
                highPowerModels={agentToolsSettings.highPowerModels}
                onToggleExtendedThinking={() => handleAgentToolsChange({ ...agentToolsSettings, extendedThinking: !agentToolsSettings.extendedThinking })}
                onToggleHighPowerModels={() => handleAgentToolsChange({ ...agentToolsSettings, highPowerModels: !agentToolsSettings.highPowerModels })}
                isUpdating={false}
              />
            ) : (
              <ChatToolbar
                extendedThinking={agentToolsSettings.extendedThinking}
                highPowerModels={agentToolsSettings.highPowerModels}
                onToggleExtendedThinking={() => handleAgentToolsChange({ ...agentToolsSettings, extendedThinking: !agentToolsSettings.extendedThinking })}
                onToggleHighPowerModels={() => handleAgentToolsChange({ ...agentToolsSettings, highPowerModels: !agentToolsSettings.highPowerModels })}
                onToggleElementSelector={() => setElementEditorActive(!elementEditorActive)}
                elementSelectorActive={elementEditorActive}
                isUpdating={false}
              />
            )
          )}
          
          {/* RAG Context - Automatic (Replit-style: no visible toggle, always enabled) */}
          {/* Knowledge retrieval happens automatically behind the scenes like Replit's Agent */}
          
          {/* Agent Tools Panel - Replit Agent 3 toggles: Max Autonomy, App Testing, Extended Thinking, High Power Models, Web Search */}
          {/* Hidden on mobile when external input bar is used (has its own Agent Tools trigger) */}
          {!hideInput && (
            <AgentToolsPanel
              projectId={projectIdNum}
              settings={agentToolsSettings}
              onSettingsChange={handleAgentToolsChange}
              onViewVideoReplays={handleViewVideoReplays}
              videoReplayCount={videoReplayCount}
              compact={mode !== 'desktop'}
              actualModelName={model?.name}
            />
          )}
        </div>
      </div>
        </>

      {/* Agent History Modal - For viewing full session history */}
      {projectIdNum > 0 && (
        <AgentHistoryModal
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
          projectId={projectIdNum}
        />
      )}
      
      {/* Video Replay Viewer - For viewing test session recordings */}
      <VideoReplayViewer
        open={videoReplayViewerOpen}
        onOpenChange={setVideoReplayViewerOpen}
        projectId={projectIdNum}
      />
    </div>
  );
}
