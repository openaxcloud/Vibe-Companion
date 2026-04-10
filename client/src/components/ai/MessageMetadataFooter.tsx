/**
 * Message Metadata Footer Component
 * Displays model, tokens, cost, latency with expandable details
 * Phase 1 UX Enhancement - Nov 2025
 */

import { useState } from 'react';
import { 
  Brain, Globe, Clock, Coins, ChevronDown, ChevronUp, 
  Cpu, Zap, BarChart3, Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cost?: string;
  latency?: number;
  extendedThinking?: boolean;
  webSearchUsed?: boolean;
  cacheHit?: boolean;
  streamingDuration?: number;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

interface MessageMetadataFooterProps {
  metadata: MessageMetadata;
  messageId: string;
  compact?: boolean;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(2)}M`;
}

export function MessageMetadataFooter({ 
  metadata, 
  messageId,
  compact = false,
  className 
}: MessageMetadataFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasDetailedInfo = metadata.promptTokens !== undefined || 
                          metadata.completionTokens !== undefined ||
                          metadata.latency !== undefined ||
                          metadata.finishReason !== undefined ||
                          metadata.cacheHit !== undefined;

  if (!metadata) return null;

  const hasAnyMetadata = metadata.model || metadata.tokens || metadata.cost || 
                         metadata.extendedThinking || metadata.webSearchUsed;

  if (!hasAnyMetadata) return null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn("space-y-1.5", className)} data-testid={`metadata-footer-${messageId}`}>
        {/* Compact Summary Row */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
          {/* Model Badge */}
          {metadata.model && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className="text-[9px] sm:text-[10px] px-1.5 py-0 h-5 gap-1 font-normal"
                    data-testid={`metadata-model-${messageId}`}
                  >
                    <Cpu className="h-2.5 w-2.5" />
                    {compact ? metadata.model.split('-').pop() : metadata.model}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">
                  {metadata.provider && <p className="font-medium">{metadata.provider}</p>}
                  <p>{metadata.model}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Extended Thinking Badge */}
          {metadata.extendedThinking && (
            <Badge 
              variant="outline" 
              className="text-[9px] sm:text-[10px] px-1.5 py-0 h-5 gap-1 border-purple-500/30 text-purple-600 dark:text-purple-400"
              data-testid={`metadata-thinking-${messageId}`}
            >
              <Brain className="h-2.5 w-2.5" />
              {!compact && 'Thinking'}
            </Badge>
          )}

          {/* Web Search Badge */}
          {metadata.webSearchUsed && (
            <Badge 
              variant="outline" 
              className="text-[9px] sm:text-[10px] px-1.5 py-0 h-5 gap-1 border-sky-500/30 text-sky-600 dark:text-sky-400"
              data-testid={`metadata-websearch-${messageId}`}
            >
              <Globe className="h-2.5 w-2.5" />
              {!compact && 'Web'}
            </Badge>
          )}

          {/* Cache Hit Badge */}
          {metadata.cacheHit && (
            <Badge 
              variant="outline" 
              className="text-[9px] sm:text-[10px] px-1.5 py-0 h-5 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              data-testid={`metadata-cache-${messageId}`}
            >
              <Zap className="h-2.5 w-2.5" />
              {!compact && 'Cached'}
            </Badge>
          )}

          {/* Tokens */}
          {metadata.tokens !== undefined && metadata.tokens > 0 && (
            <span className="flex items-center gap-1" data-testid={`metadata-tokens-${messageId}`}>
              <BarChart3 className="h-2.5 w-2.5" />
              {formatTokens(metadata.tokens)}
            </span>
          )}

          {/* Latency */}
          {metadata.latency !== undefined && (
            <span className="flex items-center gap-1" data-testid={`metadata-latency-${messageId}`}>
              <Timer className="h-2.5 w-2.5" />
              {formatDuration(metadata.latency)}
            </span>
          )}

          {/* Cost */}
          {metadata.cost && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" data-testid={`metadata-cost-${messageId}`}>
              <Coins className="h-2.5 w-2.5" />
              {metadata.cost}
            </span>
          )}

          {/* Expand Toggle */}
          {hasDetailedInfo && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 ml-auto hover:bg-muted"
                data-testid={`button-expand-metadata-${messageId}`}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded Details */}
        <CollapsibleContent>
          <div className="pt-2 border-t border-border/50 space-y-2 text-[10px] sm:text-[11px] text-muted-foreground" data-testid={`metadata-details-${messageId}`}>
            {/* Token Breakdown */}
            {(metadata.promptTokens !== undefined || metadata.completionTokens !== undefined) && (
              <div className="flex items-center justify-between gap-4" data-testid={`metadata-detail-tokens-${messageId}`}>
                <span className="text-muted-foreground/70">Token Breakdown</span>
                <div className="flex items-center gap-3">
                  {metadata.promptTokens !== undefined && (
                    <span className="flex items-center gap-1" data-testid={`metadata-detail-promptTokens-${messageId}`}>
                      <span className="text-muted-foreground/60">In:</span>
                      <span className="font-medium">{formatTokens(metadata.promptTokens)}</span>
                    </span>
                  )}
                  {metadata.completionTokens !== undefined && (
                    <span className="flex items-center gap-1" data-testid={`metadata-detail-completionTokens-${messageId}`}>
                      <span className="text-muted-foreground/60">Out:</span>
                      <span className="font-medium">{formatTokens(metadata.completionTokens)}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Latency Details */}
            {metadata.streamingDuration !== undefined && (
              <div className="flex items-center justify-between gap-4" data-testid={`metadata-detail-streamingDuration-${messageId}`}>
                <span className="text-muted-foreground/70">Streaming Duration</span>
                <span className="font-medium">{formatDuration(metadata.streamingDuration)}</span>
              </div>
            )}

            {/* Finish Reason */}
            {metadata.finishReason && (
              <div className="flex items-center justify-between gap-4" data-testid={`metadata-detail-finishReason-${messageId}`}>
                <span className="text-muted-foreground/70">Finish Reason</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-4",
                    metadata.finishReason === 'stop' && "border-emerald-500/30 text-emerald-600",
                    metadata.finishReason === 'length' && "border-amber-500/30 text-amber-600",
                    metadata.finishReason === 'content_filter' && "border-red-500/30 text-red-600",
                    metadata.finishReason === 'tool_calls' && "border-blue-500/30 text-blue-600"
                  )}
                >
                  {metadata.finishReason.replace('_', ' ')}
                </Badge>
              </div>
            )}

            {/* Provider & Model Full Name */}
            {metadata.provider && metadata.model && (
              <div className="flex items-center justify-between gap-4" data-testid={`metadata-detail-fullModel-${messageId}`}>
                <span className="text-muted-foreground/70">Full Model</span>
                <span className="font-medium font-mono text-[9px]">{metadata.provider}/{metadata.model}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default MessageMetadataFooter;
