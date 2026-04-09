import { useState, useCallback, memo, forwardRef, useMemo } from 'react';
import { LazyMotionDiv, LazyMotionSpan, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  Copy, 
  Check, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Loader2,
  Bot,
  User
} from 'lucide-react';
import { ThinkingDisplay, ThinkingDisplayCompact, ThinkingStep } from './ThinkingDisplay';
import { ToolExecutionList } from './ToolExecutionDisplay';
import { AgentWall } from '@/components/agent/AgentWall';
import { MessageMetadataFooter } from './MessageMetadataFooter';
import { 
  TaskMessage, 
  ActionMessage, 
  RichMessageContent,
  type Task,
  type Action
} from '@/components/agent/messages';
import { extractAndFormatTasks, containsPlanOrTasks } from '@/lib/task-extractor';
import {
  InlineWorkingIndicator,
  InlineSearchIndicator,
  InlineAppType,
  InlinePlanCard,
  InlineBuildOptions,
  InlineBuildProgressCard,
  InlineCompleteIndicator,
  InlineErrorIndicator,
  InlineFileOperation,
  InlineTerminalOutput,
  InlineCodeBlock,
  InlineThinkingStep,
  InlineAgentAction,
  InlineDependencyInstall,
  InlineProgressTimeline,
  InlineCheckpoint,
  InlineTaskListEnhanced,
  InlinePreviewWindow,
  type BuildMode,
  type FileOperationType,
  type ProgressEvent
} from './InlineBuildProgress';
import type { Message, AutonomousBuildMode } from '@/stores/agentConversationStore';
import { CheckpointCard } from './CheckpointCard';

interface EnhancedChatMessageProps {
  message: Message;
  isCompactMode?: boolean;
  onCopy?: (content: string) => void;
  onRetry?: () => void;
  onApproveAction?: (action: Action) => void;
  onRejectAction?: (action: Action) => void;
  onSelectBuildMode?: (mode: AutonomousBuildMode) => void;
  onChangePlan?: () => void;
  onFileClick?: (filePath: string) => void;
  onRefreshPreview?: () => void;
  onOpenPreviewExternal?: () => void;
  onRestoreCheckpoint?: (checkpointId: number) => void;
  isRestoringCheckpoint?: boolean;
}

type EnhancedChatMessageRef = HTMLDivElement;

const springConfig = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 1
};

const messageVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: springConfig
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

export const EnhancedChatMessage = memo(forwardRef<EnhancedChatMessageRef, EnhancedChatMessageProps>(function EnhancedChatMessage({
  message,
  isCompactMode = false,
  onCopy,
  onRetry,
  onApproveAction,
  onRejectAction,
  onSelectBuildMode,
  onChangePlan,
  onFileClick,
  onRefreshPreview,
  onOpenPreviewExternal,
  onRestoreCheckpoint,
  isRestoringCheckpoint
}, ref) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedBuildMode, setSelectedBuildMode] = useState<AutonomousBuildMode | null>(null);
  
  const handleCopy = useCallback(async () => {
    try {
      if (onCopy) {
        onCopy(message.content);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = message.content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  }, [message.content, onCopy]);

  const handleSelectBuildMode = useCallback((mode: BuildMode) => {
    setSelectedBuildMode(mode as AutonomousBuildMode);
    onSelectBuildMode?.(mode as AutonomousBuildMode);
  }, [onSelectBuildMode]);
  
  const isUser = message.role === 'user';
  const isError = message.status === 'error' || message.metadata?.error;
  const hasThinking = message.thinking && message.thinking.length > 0;
  const hasTools = message.toolExecutions && message.toolExecutions.length > 0;
  const hasStructuredTasks = message.tasks && message.tasks.length > 0;
  const hasActions = message.actions && message.actions.length > 0;
  const isAutonomousMessage = message.type?.startsWith('autonomous_');
  const autonomousPayload = message.autonomousPayload;
  
  // Extract tasks from message content when no structured tasks exist (Replit-like task extraction)
  const extractedTasks = useMemo(() => {
    // Only extract from assistant messages that look like plans
    if (isUser || hasStructuredTasks || isAutonomousMessage) return [];
    if (!message.content || message.content.length < 50) return [];
    if (!containsPlanOrTasks(message.content)) return [];
    
    const isComplete = (message.status as string) === 'complete' || message.status === 'sent';
    const tasks = extractAndFormatTasks(message.content, isComplete);
    
    // Only return if we found meaningful tasks (at least 2)
    return tasks.length >= 2 ? tasks : [];
  }, [message.content, message.status, isUser, hasStructuredTasks, isAutonomousMessage]);
  
  const hasTasks = hasStructuredTasks || extractedTasks.length > 0;
  const displayTasks = hasStructuredTasks ? message.tasks : extractedTasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status
  })) as Task[];
  
  return (
    <LazyMotionDiv
      ref={ref}
      layout
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "flex gap-2 sm:gap-3 group w-full min-w-0 max-w-full overflow-hidden",
        isUser && "flex-row-reverse"
      )}
      data-testid={`enhanced-message-${message.id}`}
      data-message-role={message.role}
    >
      {isUser ? (
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 ring-1 ring-offset-1 ring-offset-background ring-muted-foreground/20 shadow-sm">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 ring-1 sm:ring-2 ring-offset-1 sm:ring-offset-2 ring-offset-background ring-primary/30 shadow-md">
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
            <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "flex-1 space-y-2 min-w-0",
        isUser && "flex flex-col items-end"
      )}>
        {hasThinking && hasTools && !isCompactMode && (
          <LazyMotionDiv
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full"
            data-testid={`enhanced-agent-wall-${message.id}`}
          >
            <AgentWall
              thinkingSteps={message.thinking!}
              toolExecutions={message.toolExecutions!}
              isActive={!!message.isStreaming}
              result={
                !message.isStreaming && message.toolExecutions!.length > 0
                  ? {
                      summary: `Completed ${message.toolExecutions!.filter(t => t.status === 'complete' && t.success).length} of ${message.toolExecutions!.length} actions`,
                      filesCreated: message.toolExecutions!
                        .filter(t => t.tool === 'create_file' && t.status === 'complete')
                        .map(t => t.parameters?.path)
                        .filter(Boolean),
                      filesModified: message.toolExecutions!
                        .filter(t => t.tool === 'edit_file' && t.status === 'complete')
                        .map(t => t.parameters?.path)
                        .filter(Boolean),
                      commandsRun: message.toolExecutions!
                        .filter(t => t.tool === 'run_command' && t.status === 'complete').length,
                      errors: message.toolExecutions!
                        .filter(t => t.status === 'error' || (t.status === 'complete' && t.success === false))
                        .map(t => t.error || `${t.tool} failed`)
                        .filter(Boolean),
                    }
                  : undefined
              }
            />
          </LazyMotionDiv>
        )}

        {hasThinking && !(hasThinking && hasTools && !isCompactMode) && (
          <div className="collapsible-content expanded w-full">
            <div>
              {isCompactMode ? (
                <ThinkingDisplayCompact
                  steps={message.thinking!}
                  isActive={message.isStreaming}
                />
              ) : (
                <ThinkingDisplay
                  steps={message.thinking!}
                  isActive={message.isStreaming}
                  mode="detailed"
                />
              )}
            </div>
          </div>
        )}

        <LazyMotionDiv 
          className={cn(
            "group/msg relative rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 transition-all duration-200",
            "min-h-[36px] sm:min-h-[44px] min-w-0",
            "overflow-hidden w-full max-w-full min-w-0",
            isUser
              ? cn(
                  "bg-primary text-primary-foreground",
                  "shadow-lg shadow-primary/20",
                  "rounded-br-md"
                )
              : isError
                ? cn(
                    "bg-destructive/10 text-destructive border border-destructive/20",
                    "shadow-lg shadow-destructive/10",
                    "rounded-bl-md"
                  )
                : cn(
                    "bg-card text-card-foreground border border-border",
                    "shadow-sm",
                    "rounded-bl-md"
                  ),
            "group-hover:shadow-lg transition-shadow duration-300"
          )}
          data-testid={`enhanced-message-content-${message.id}`}
          whileHover={{ scale: 1.005 }}
          transition={{ duration: 0.2 }}
        >
          {!isUser && message.content ? (
            <RichMessageContent content={message.content} />
          ) : (
            <p 
              className={cn(
                "text-[13px] whitespace-pre-wrap break-words leading-relaxed max-w-full min-w-0 w-full",
                isError && "text-destructive"
              )}
              style={{ overflowWrap: 'anywhere' }}
              data-testid={`enhanced-message-text-${message.id}`}
            >
              {message.content}
            </p>
          )}

          {message.isStreaming && (
            <LazyMotionSpan 
              className="inline-block w-0.5 h-4 bg-current ml-1 align-middle"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}

          <LazyAnimatePresence>
            <LazyMotionDiv 
              className={cn(
                "absolute -top-2 flex gap-1",
                isUser ? "-left-2" : "-right-2",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-full shadow-sm",
                  "bg-background/95 hover:bg-background",
                  "border border-border/50"
                )}
                onClick={handleCopy}
                data-testid={`enhanced-button-copy-${message.id}`}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              
              {isError && onRetry && (
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-full shadow-sm",
                    "bg-background/95 hover:bg-background",
                    "border border-border/50"
                  )}
                  onClick={onRetry}
                  data-testid={`enhanced-button-retry-${message.id}`}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </LazyMotionDiv>
          </LazyAnimatePresence>
        </LazyMotionDiv>

        {hasTasks && displayTasks && displayTasks.length > 0 && (
          <LazyMotionDiv 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full mt-2"
            data-testid={`enhanced-tasks-${message.id}`}
          >
            <TaskMessage tasks={displayTasks} />
          </LazyMotionDiv>
        )}

        {hasActions && (
          <LazyMotionDiv 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full mt-2"
            data-testid={`enhanced-actions-${message.id}`}
          >
            <ActionMessage 
              actions={message.actions as Action[]}
              onApprove={onApproveAction}
              onReject={onRejectAction}
            />
          </LazyMotionDiv>
        )}

        {hasTools && !(hasThinking && hasTools && !isCompactMode) && (
          <LazyMotionDiv 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="w-full mt-2"
            data-testid={`enhanced-tool-executions-${message.id}`}
          >
            <div 
              className="flex items-center gap-2 cursor-pointer py-1"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid={`enhanced-tools-toggle-${message.id}`}
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                {message.toolExecutions!.length} tool execution{message.toolExecutions!.length !== 1 ? 's' : ''}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className={cn("collapsible-content", isExpanded && "expanded")}>
              <div>
                <ToolExecutionList 
                  toolExecutions={message.toolExecutions!} 
                  showFilters={false}
                  compact={true}
                />
              </div>
            </div>
          </LazyMotionDiv>
        )}

        {/* Autonomous Workspace Inline Components - Replit-style */}
        {isAutonomousMessage && autonomousPayload && (
          <LazyMotionDiv
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full mt-2"
            data-testid={`enhanced-autonomous-${message.id}`}
          >
            {/* Search indicator */}
            {message.type === 'autonomous_search' && autonomousPayload.searchQuery && (
              <InlineSearchIndicator query={autonomousPayload.searchQuery} />
            )}

            {/* App type indicator */}
            {autonomousPayload.appType && (
              <InlineAppType appType={autonomousPayload.appType} />
            )}

            {/* Plan card with features - show when featureList OR planText exists */}
            {message.type === 'autonomous_plan' && (
              (autonomousPayload.featureList && autonomousPayload.featureList.length > 0) || autonomousPayload.planText
            ) && (
              <InlinePlanCard
                title={autonomousPayload.planTitle || "I'll include the following features:"}
                features={autonomousPayload.featureList || []}
                planText={autonomousPayload.planText}
                onChangePlan={onChangePlan}
              />
            )}

            {/* Build mode options */}
            {message.type === 'autonomous_build_options' && (
              <InlineBuildOptions
                onSelectMode={handleSelectBuildMode}
                selectedMode={selectedBuildMode || autonomousPayload.buildMode}
                disabled={autonomousPayload.phase === 'executing'}
              />
            )}

            {/* Build progress */}
            {message.type === 'autonomous_progress' && (
              <InlineBuildProgressCard
                phase={autonomousPayload.phase === 'complete' ? 'complete' : 
                       autonomousPayload.phase === 'executing' ? 'executing' : 'planning'}
                currentTask={autonomousPayload.currentTask}
                progress={autonomousPayload.progress || 0}
                tasks={autonomousPayload.tasks || []}
                planText={autonomousPayload.planText}
                isStreaming={message.isStreaming}
              />
            )}

            {/* Working indicator */}
            {message.type === 'autonomous_working' && (
              <InlineWorkingIndicator 
                message={message.content || 'Working...'} 
                status={autonomousPayload.agentStatus || 'working'}
                subMessage={autonomousPayload.subMessage}
              />
            )}

            {/* File operations - show file creates/edits/deletes */}
            {message.type === 'autonomous_file_operation' && autonomousPayload.fileOperation && (
              <InlineFileOperation
                operation={autonomousPayload.fileOperation.type as FileOperationType}
                filePath={autonomousPayload.fileOperation.path}
                language={autonomousPayload.fileOperation.language}
                linesChanged={autonomousPayload.fileOperation.linesChanged}
                preview={autonomousPayload.fileOperation.preview}
                status={autonomousPayload.fileOperation.status}
              />
            )}

            {/* Terminal output - show command executions */}
            {message.type === 'autonomous_terminal' && autonomousPayload.terminal && (
              <InlineTerminalOutput
                command={autonomousPayload.terminal.command}
                output={autonomousPayload.terminal.output}
                status={autonomousPayload.terminal.status}
                exitCode={autonomousPayload.terminal.exitCode}
                duration={autonomousPayload.terminal.duration}
              />
            )}

            {/* Code block - show code snippets */}
            {message.type === 'autonomous_code' && autonomousPayload.code && (
              <InlineCodeBlock
                code={autonomousPayload.code.content}
                language={autonomousPayload.code.language}
                filename={autonomousPayload.code.filename}
                action={autonomousPayload.code.action}
              />
            )}

            {/* Dependency installation */}
            {message.type === 'autonomous_dependencies' && autonomousPayload.dependencies && (
              <InlineDependencyInstall
                packages={autonomousPayload.dependencies.packages}
                status={autonomousPayload.dependencies.status}
                manager={autonomousPayload.dependencies.manager}
              />
            )}

            {/* Agent action - show specific actions */}
            {message.type === 'autonomous_action' && autonomousPayload.action && (
              <InlineAgentAction
                action={autonomousPayload.action.title}
                description={autonomousPayload.action.description}
                type={autonomousPayload.action.type}
              />
            )}

            {/* Thinking steps - show agent thought process */}
            {message.type === 'autonomous_thinking' && autonomousPayload.thinkingSteps && (
              <div className="space-y-1">
                {autonomousPayload.thinkingSteps.map((step: string, index: number) => (
                  <InlineThinkingStep
                    key={index}
                    step={step}
                    isActive={index === autonomousPayload.thinkingSteps!.length - 1 && message.isStreaming}
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* Complete indicator */}
            {message.type === 'autonomous_complete' && (
              <InlineCompleteIndicator 
                message={message.content || 'Build complete!'}
                projectUrl={autonomousPayload.projectUrl}
              />
            )}

            {/* Error indicator */}
            {message.type === 'autonomous_error' && (
              <InlineErrorIndicator 
                message={message.content || 'An error occurred'}
                details={autonomousPayload.errorDetails}
                onRetry={onRetry}
              />
            )}

            {/* Progress timeline - chronological activity feed */}
            {message.type === 'autonomous_timeline' && autonomousPayload.timeline && (
              <InlineProgressTimeline
                events={autonomousPayload.timeline.events}
                onFileClick={onFileClick}
                maxHeight={autonomousPayload.timeline.maxHeight}
              />
            )}

            {/* Checkpoint marker - milestone in chat */}
            {message.type === 'autonomous_checkpoint' && autonomousPayload.checkpoint && (
              <InlineCheckpoint
                title={autonomousPayload.checkpoint.title}
                description={autonomousPayload.checkpoint.description}
                checkpointNumber={autonomousPayload.checkpoint.number}
                completedTasks={autonomousPayload.checkpoint.completedTasks}
                totalTasks={autonomousPayload.checkpoint.totalTasks}
                eta={autonomousPayload.checkpoint.eta}
              />
            )}

            {/* Task list with progress */}
            {message.type === 'autonomous_task_list' && autonomousPayload.taskList && (
              <InlineTaskListEnhanced
                title={autonomousPayload.taskList.title}
                tasks={autonomousPayload.taskList.items}
                showProgress={autonomousPayload.taskList.showProgress}
                onFileClick={onFileClick}
                compact={autonomousPayload.taskList.compact}
              />
            )}

            {/* Live preview window */}
            {message.type === 'autonomous_preview' && autonomousPayload.preview && (
              <InlinePreviewWindow
                previewUrl={autonomousPayload.preview.url}
                title={autonomousPayload.preview.title}
                isLoading={autonomousPayload.preview.isLoading}
                isLive={autonomousPayload.preview.isLive}
                onRefresh={onRefreshPreview}
                onOpenExternal={onOpenPreviewExternal}
              />
            )}
          </LazyMotionDiv>
        )}

        {/* Auto-saved checkpoint card - inline in chat */}
        {message.type === 'auto_checkpoint_created' && message.autoCheckpoint && (
          <LazyMotionDiv
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CheckpointCard
              checkpointId={message.autoCheckpoint.id}
              aiSummary={message.autoCheckpoint.aiSummary}
              filesCount={message.autoCheckpoint.filesCount}
              createdAt={message.autoCheckpoint.createdAt}
              type={message.autoCheckpoint.type}
              onRestore={onRestoreCheckpoint}
              isRestoring={isRestoringCheckpoint}
            />
          </LazyMotionDiv>
        )}

        {message.metadata && !isUser && (
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <MessageMetadataFooter
              metadata={message.metadata}
              messageId={message.id}
              compact={isCompactMode}
            />
          </LazyMotionDiv>
        )}
      </div>
    </LazyMotionDiv>
  );
}));

export const StreamingSkeleton = memo(function StreamingSkeleton() {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex gap-2 sm:gap-3"
      data-testid="streaming-skeleton"
    >
      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-1 sm:ring-2 ring-offset-1 sm:ring-offset-2 ring-offset-background ring-primary/30 shadow-md">
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2 sm:space-y-3 max-w-[95%] sm:max-w-[85%] md:max-w-[80%]">
        <div className="bg-muted/80 rounded-xl sm:rounded-2xl rounded-bl-md px-3 py-3 sm:px-4 sm:py-4 shadow-md border border-border/50">
          <div className="space-y-1.5 sm:space-y-2">
            <LazyMotionDiv 
              className="h-2.5 sm:h-3 bg-muted-foreground/20 rounded-full w-3/4"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <LazyMotionDiv 
              className="h-2.5 sm:h-3 bg-muted-foreground/20 rounded-full w-1/2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
            <LazyMotionDiv 
              className="h-2.5 sm:h-3 bg-muted-foreground/20 rounded-full w-2/3"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        </div>
      </div>
    </LazyMotionDiv>
  );
});

export const TypingIndicator = memo(function TypingIndicator({ text = "Thinking" }: { text?: string }) {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
      data-testid="typing-indicator"
    >
      <Avatar className="h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-primary/30 shadow-lg">
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
          <Sparkles className="h-4 w-4 animate-pulse" />
        </AvatarFallback>
      </Avatar>
      
      <div className="bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-md border border-border/50 flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground">{text}</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <LazyMotionSpan
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ 
                y: [0, -4, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15
              }}
            />
          ))}
        </div>
      </div>
    </LazyMotionDiv>
  );
});

export const EmptyConversation = memo(function EmptyConversation({ 
  onQuickAction 
}: { 
  onQuickAction?: (prompt: string) => void 
}) {
  const quickActions = [
    { label: "Build Dashboard", prompt: "Build a full-stack dashboard with real-time charts, data tables with sorting/filtering, user authentication, and dark mode support", icon: "📊" },
    { label: "Add Payments", prompt: "Add Stripe payment integration with subscription billing, usage tracking, and customer portal", icon: "💳" },
    { label: "Add Auth", prompt: "Implement user authentication with email/password, social login (Google, GitHub), session management, and protected routes", icon: "🔐" },
    { label: "Debug & Optimize", prompt: "Debug and fix all TypeScript errors, optimize performance bottlenecks, and add proper error handling throughout the codebase", icon: "🔧" },
  ];

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4"
      data-testid="empty-conversation"
    >
      <LazyMotionDiv
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={springConfig}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg"
      >
        <Sparkles className="h-8 w-8 text-primary" />
      </LazyMotionDiv>
      
      <h3 className="text-[15px] font-semibold mb-2">How can I help you today?</h3>
      <p className="text-[13px] text-muted-foreground text-center mb-6 max-w-sm">
        I can help you build, debug, and improve your code with transparent reasoning.
      </p>
      
      {onQuickAction && (
        <div className="grid grid-cols-2 gap-2 w-full max-w-md">
          {quickActions.map((action, i) => (
            <LazyMotionButton
              key={action.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onQuickAction(action.prompt)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl",
                "bg-muted/50 hover:bg-muted border border-border/50",
                "transition-all duration-200 hover:shadow-md",
                "text-left min-h-[44px]"
              )}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="text-[15px]">{action.icon}</span>
              <span className="text-[13px] font-medium">{action.label}</span>
            </LazyMotionButton>
          ))}
        </div>
      )}
    </LazyMotionDiv>
  );
});

export const ConversationSyncIndicator = memo(function ConversationSyncIndicator({
  isSyncing,
  lastSyncedAt,
  hasUnsyncedChanges
}: {
  isSyncing?: boolean;
  lastSyncedAt?: number;
  hasUnsyncedChanges?: boolean;
}) {
  const isVisible = isSyncing || hasUnsyncedChanges || lastSyncedAt;
  
  return (
    <div
      className={cn(
        "collapsible-content",
        isVisible && "expanded"
      )}
      data-testid="sync-indicator"
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-1.5 px-3 text-[11px]",
          "bg-muted/50 border-b border-border/50"
        )}
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-muted-foreground">Syncing conversation...</span>
          </>
        ) : hasUnsyncedChanges ? (
          <>
            <AlertCircle className="h-3 w-3 text-yellow-500" />
            <span className="text-muted-foreground">Unsaved changes</span>
          </>
        ) : lastSyncedAt ? (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">
              Saved {new Date(lastSyncedAt).toLocaleTimeString()}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
});

export default EnhancedChatMessage;
