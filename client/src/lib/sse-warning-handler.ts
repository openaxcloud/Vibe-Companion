/**
 * SSE Warning Handler
 * Centralizes handling of Server-Sent Events warning messages from AI streaming.
 * Used to notify users when context truncation occurs due to provider limits.
 */

export interface SSEWarningData {
  message: string;
  droppedCount?: number;
  originalSize?: number;
  finalSize?: number;
}

export interface SSEWarningHandlerOptions {
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

export interface SSEWarningResult {
  shouldShow: boolean;
  systemMessageContent?: string;
}

// De-duplication cache: tracks recently shown warnings by hash
const recentWarnings = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // Suppress identical warnings within 5 seconds

/**
 * Handles SSE warning events by:
 * 1. Showing a toast notification (transient alert)
 * 2. Returning system message content for the caller to persist
 * 
 * This dual approach ensures users are notified immediately while allowing
 * each component to correctly persist the warning in its message stream.
 * 
 * Includes de-duplication to prevent spam from repeated warnings.
 * 
 * @returns Object with shouldShow (false if deduplicated) and systemMessageContent
 */
export function handleSSEWarning(
  data: SSEWarningData,
  options: SSEWarningHandlerOptions
): SSEWarningResult {
  const { toast } = options;
  
  // De-duplication: create hash from warning data
  const warningHash = `${data.message}-${data.droppedCount || 0}`;
  const now = Date.now();
  const lastShown = recentWarnings.get(warningHash);
  
  if (lastShown && (now - lastShown) < DEDUP_WINDOW_MS) {
    // Skip duplicate warning within time window
    return { shouldShow: false };
  }
  
  // Update de-dup cache
  recentWarnings.set(warningHash, now);
  
  // Clean up old entries (keep cache small)
  if (recentWarnings.size > 10) {
    const entries = Array.from(recentWarnings.entries());
    entries.sort((a, b) => a[1] - b[1]);
    entries.slice(0, 5).forEach(([key]) => recentWarnings.delete(key));
  }
  
  const droppedText = data.droppedCount !== undefined 
    ? ` (${data.droppedCount} message${data.droppedCount > 1 ? 's' : ''} removed)`
    : '';

  const isQuotaError = data.message && (data.message.includes('429') || data.message.includes('quota') || data.message.includes('rate limit'));
  
  if (isQuotaError) {
    toast({
      title: 'AI temporarily unavailable',
      description: 'The AI service is busy. Your request will be retried automatically.',
      variant: 'default'
    });
  } else {
    toast({
      title: 'Context adjusted',
      description: `Older messages were trimmed to stay within limits.${droppedText}`,
      variant: 'default'
    });
  }
  
  // Build system message with safe optional field handling
  const sizeInfo = data.originalSize !== undefined && data.finalSize !== undefined
    ? `- **Original size**: ${formatBytes(data.originalSize)}
- **Reduced to**: ${formatBytes(data.finalSize)}
`
    : '';
  
  const countInfo = data.droppedCount !== undefined
    ? `- **Removed**: ${data.droppedCount} message${data.droppedCount > 1 ? 's' : ''}\n`
    : '';
  
  const systemMessageContent = `⚠️ **Context Truncation Notice**

Due to AI model limits, older messages were removed from the conversation history.

${sizeInfo}${countInfo}
Recent messages are preserved. The AI can still access your latest context.`;
  
  return {
    shouldShow: true,
    systemMessageContent
  };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
