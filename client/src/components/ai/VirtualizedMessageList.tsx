// @ts-nocheck
import { useRef, useEffect, useCallback, useMemo, memo, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { EnhancedChatMessage, StreamingSkeleton } from './EnhancedChatMessage';
import type { Message, AutonomousBuildMode } from '@/stores/agentConversationStore';
import type { Action } from '@/components/agent/messages';
import { LazyAnimatePresence } from '@/lib/motion';

interface VirtualizedMessageListProps {
  messages: Message[];
  isCompactMode?: boolean;
  isPendingResponse?: boolean;
  streamingContent?: string;
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
  className?: string;
  autoScrollToBottom?: boolean;
}

const ESTIMATED_MESSAGE_HEIGHT = 120;
const OVERSCAN_COUNT = 5;

export const VirtualizedMessageList = memo(forwardRef<HTMLDivElement, VirtualizedMessageListProps>(
  function VirtualizedMessageList({
    messages,
    isCompactMode = false,
    isPendingResponse = false,
    streamingContent = '',
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
    isRestoringCheckpoint,
    className,
    autoScrollToBottom = true,
  }, ref) {
    const parentRef = useRef<HTMLDivElement>(null);
    const lastMessageRef = useRef<string | null>(null);
    const isUserScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const allItems = useMemo(() => {
      const items = [...messages];
      if (isPendingResponse) {
        items.push({
          id: 'pending-skeleton',
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        });
      }
      return items;
    }, [messages, isPendingResponse]);

    const virtualizer = useVirtualizer({
      count: allItems.length,
      getScrollElement: () => parentRef.current,
      estimateSize: useCallback(() => ESTIMATED_MESSAGE_HEIGHT, []),
      overscan: OVERSCAN_COUNT,
      paddingStart: 16,
      paddingEnd: 16,
    });

    const handleScroll = useCallback(() => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      const parent = parentRef.current;
      if (!parent) return;

      const isNearBottom = parent.scrollHeight - parent.scrollTop - parent.clientHeight < 100;
      isUserScrollingRef.current = !isNearBottom;

      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    }, []);

    useEffect(() => {
      const lastMessage = messages[messages.length - 1];
      const lastMessageId = lastMessage?.id;
      
      if (
        autoScrollToBottom && 
        !isUserScrollingRef.current && 
        lastMessageId && 
        lastMessageId !== lastMessageRef.current
      ) {
        virtualizer.scrollToIndex(allItems.length - 1, {
          align: 'end',
          behavior: 'smooth',
        });
        lastMessageRef.current = lastMessageId;
      }
    }, [allItems.length, autoScrollToBottom, messages, virtualizer]);

    useEffect(() => {
      if (isPendingResponse && autoScrollToBottom && !isUserScrollingRef.current) {
        virtualizer.scrollToIndex(allItems.length - 1, {
          align: 'end',
          behavior: 'smooth',
        });
      }
    }, [isPendingResponse, allItems.length, autoScrollToBottom, virtualizer]);

    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, []);

    const virtualItems = virtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          "scroll-smooth scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
          className
        )}
        style={{ contain: 'strict' }}
        data-testid="virtualized-message-list"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <LazyAnimatePresence mode="popLayout">
            {virtualItems.map((virtualItem) => {
              const message = allItems[virtualItem.index];
              const isPendingSkeleton = message.id === 'pending-skeleton';

              return (
                <div
                  key={message.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isPendingSkeleton ? (
                    <StreamingSkeleton />
                  ) : (
                    <EnhancedChatMessage
                      message={message}
                      isCompactMode={isCompactMode}
                      onCopy={onCopy}
                      onRetry={onRetry}
                      onApproveAction={onApproveAction}
                      onRejectAction={onRejectAction}
                      onSelectBuildMode={onSelectBuildMode}
                      onChangePlan={onChangePlan}
                      onFileClick={onFileClick}
                      onRefreshPreview={onRefreshPreview}
                      onOpenPreviewExternal={onOpenPreviewExternal}
                      onRestoreCheckpoint={onRestoreCheckpoint}
                      isRestoringCheckpoint={isRestoringCheckpoint}
                    />
                  )}
                </div>
              );
            })}
          </LazyAnimatePresence>
        </div>
        
        {streamingContent && (
          <div 
            className="px-4 py-3 border-t border-border/50 bg-muted/30"
            data-testid="streaming-content-overlay"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-medium text-primary">AI</span>
              </div>
              <div className="flex-1 min-w-0">
                <StreamingText 
                  content={streamingContent} 
                  className="text-[13px] text-foreground"
                />
                <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
));

export interface StreamingTextProps {
  content: string;
  isComplete?: boolean;
  className?: string;
  typingSpeed?: number;
}

export const StreamingText = memo(function StreamingText({
  content,
  isComplete = false,
  className,
}: StreamingTextProps) {
  const displayedRef = useRef('');
  const indexRef = useRef(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const prevContentLenRef = useRef(0);

  useEffect(() => {
    if (isComplete) {
      displayedRef.current = content;
      indexRef.current = content.length;
      if (containerRef.current) {
        containerRef.current.textContent = content;
      }
      return;
    }

    const targetLength = content.length;
    const newCharsAvailable = targetLength - prevContentLenRef.current;
    prevContentLenRef.current = targetLength;

    const animate = (timestamp: number) => {
      if (indexRef.current >= targetLength) return;

      const elapsed = timestamp - lastTimeRef.current;
      const behind = targetLength - indexRef.current;

      let charsToAdd: number;
      if (behind > 200) {
        charsToAdd = Math.min(behind, 40);
      } else if (behind > 50) {
        charsToAdd = Math.min(behind, 8);
      } else {
        charsToAdd = Math.min(behind, 2);
      }

      if (elapsed >= 8 || behind > 100) {
        lastTimeRef.current = timestamp;
        indexRef.current += charsToAdd;
        displayedRef.current = content.slice(0, indexRef.current);

        if (containerRef.current) {
          containerRef.current.textContent = displayedRef.current;
        }
      }

      if (indexRef.current < targetLength) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [content, isComplete]);

  useEffect(() => {
    if (content.length < displayedRef.current.length) {
      displayedRef.current = '';
      indexRef.current = 0;
      prevContentLenRef.current = 0;
    }
  }, [content]);

  return (
    <span 
      ref={containerRef} 
      className={cn("whitespace-pre-wrap", className)}
      data-testid="streaming-text"
    >
      {displayedRef.current || content.slice(0, indexRef.current)}
    </span>
  );
});

export function useOptimisticMessages(
  messages: Message[],
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void
) {
  const pendingMessagesRef = useRef<Map<string, Message>>(new Map());

  const addOptimisticMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => {
    const optimisticId = message.id || `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      ...message,
      id: optimisticId,
      timestamp: new Date(),
      status: 'pending' as const,
    } as Message;

    pendingMessagesRef.current.set(optimisticId, optimisticMessage);
    setMessages(prev => [...prev, optimisticMessage]);

    return {
      id: optimisticId,
      confirm: (confirmedMessage?: Partial<Message>) => {
        pendingMessagesRef.current.delete(optimisticId);
        setMessages(prev => prev.map(m => 
          m.id === optimisticId 
            ? { ...m, ...confirmedMessage, status: 'sent' as const }
            : m
        ));
      },
      rollback: (error?: string) => {
        pendingMessagesRef.current.delete(optimisticId);
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...m, status: 'error' as const, error }
            : m
        ));
      },
      remove: () => {
        pendingMessagesRef.current.delete(optimisticId);
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
      },
    };
  }, [setMessages]);

  const getPendingCount = useCallback(() => {
    return pendingMessagesRef.current.size;
  }, []);

  return {
    addOptimisticMessage,
    getPendingCount,
    hasPendingMessages: pendingMessagesRef.current.size > 0,
  };
}

export function useDebouncedStreamingContent(initialContent: string = '', delay: number = 50) {
  const contentRef = useRef(initialContent);
  const displayedRef = useRef(initialContent);
  const frameRef = useRef<number | null>(null);
  const setDisplayedContent = useRef<((content: string) => void) | null>(null);

  const updateContent = useCallback((newContent: string) => {
    contentRef.current = newContent;
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      displayedRef.current = contentRef.current;
      if (setDisplayedContent.current) {
        setDisplayedContent.current(displayedRef.current);
      }
    });
  }, []);

  const getDisplayedContent = useCallback(() => {
    return displayedRef.current;
  }, []);

  const setCallback = useCallback((callback: (content: string) => void) => {
    setDisplayedContent.current = callback;
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    updateContent,
    getDisplayedContent,
    setCallback,
  };
}
