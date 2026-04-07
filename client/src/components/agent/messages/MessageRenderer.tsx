/**
 * Message Renderer
 * Main dispatcher for rendering different message types
 * Production-grade component matching Replit's architecture
 */

import { useState, useRef, useCallback } from 'react';
import { Bot, User, DollarSign, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentMessage } from './types';
import { ThinkingMessage } from './ThinkingMessage';
import { TaskMessage } from './TaskMessage';
import { ActionMessage } from './ActionMessage';
import { RichMessageContent } from './RichMessageContent';
import { VibingAnimation } from './VibingAnimation';
import { MultiFileDiff } from './FileDiffViewer';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface MessageRendererProps {
  message: AgentMessage;
  onApproveAction?: (action: any) => void;
  onRejectAction?: (action: any) => void;
}

/** Strip markdown so TTS doesn't read ```, **, # etc. */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Hook that manages TTS playback for a single message. */
function useTTS(text: string) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (utterRef.current) {
      window.speechSynthesis?.cancel();
      utterRef.current = null;
    }
    setState('idle');
  }, []);

  /** Try OpenAI TTS first, fallback to browser speechSynthesis. */
  const speak = useCallback(async () => {
    if (state === 'playing' || state === 'loading') {
      stop();
      return;
    }

    const clean = stripMarkdown(text);
    if (!clean) return;

    setState('loading');

    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: clean, voice: 'alloy' }),
      });

      if (!res.ok) throw new Error('TTS API unavailable');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setState('playing');
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setState('idle');
      };

      await audio.play();
    } catch {
      // Fallback: browser Web Speech API (free, no API key needed)
      if (!('speechSynthesis' in window)) {
        toast({ description: 'Text-to-speech not available on this browser.', variant: 'destructive' });
        setState('idle');
        return;
      }

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean.slice(0, 2000));
      utter.lang = 'fr-FR';
      utter.rate = 1.05;
      utterRef.current = utter;

      utter.onstart = () => setState('playing');
      utter.onend = () => { utterRef.current = null; setState('idle'); };
      utter.onerror = () => { utterRef.current = null; setState('idle'); };

      window.speechSynthesis.speak(utter);
    }
  }, [state, text, stop]);

  return { state, speak, stop };
}

export function MessageRenderer({ message, onApproveAction, onRejectAction }: MessageRendererProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const { state: ttsState, speak } = useTTS(message.content || '');

  // System messages (progress, notifications)
  if (isSystem) {
    return (
      <div className="px-4 py-2" data-testid="system-message">
        <div className={cn(
          "text-[11px] flex items-center gap-2",
          message.type === 'progress' ? "text-[var(--ecode-accent)]" : "text-[var(--ecode-text-secondary)]"
        )}>
          {message.content}
        </div>
        {message.progress && (
          <div className="mt-2 w-full bg-[var(--ecode-surface)] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${message.progress.percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // Main message container
  return (
    <div
      className={cn(
        "group flex gap-3 px-3 md:px-4 py-4 border-b border-[var(--ecode-border)] max-w-full",
        isUser && "bg-[var(--ecode-surface-secondary)]",
        isUser ? "agent-message-user" : "agent-message-assistant"
      )}
      data-testid={`message-${message.role}-${message.id}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Bot className="h-5 w-5 md:h-4 md:w-4 text-white" />
        </div>
      )}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 md:w-7 md:h-7 rounded-full bg-[var(--ecode-surface)] border border-[var(--ecode-border)] flex items-center justify-center">
          <User className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text)]" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Main text content with rich markdown formatting */}
        {message.content && (
          <RichMessageContent content={message.content} />
        )}

        {/* Thinking Process */}
        {!isUser && message.thinking && message.thinking.steps.length > 0 && (
          <ThinkingMessage
            steps={message.thinking.steps}
            isStreaming={message.thinking.isStreaming}
            totalTokens={message.thinking.totalTokens}
            thinkingTime={message.thinking.thinkingTime}
          />
        )}

        {/* Tasks */}
        {!isUser && message.tasks && message.tasks.length > 0 && (
          <TaskMessage tasks={message.tasks} />
        )}

        {/* Actions */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <ActionMessage
            actions={message.actions}
            onApprove={onApproveAction}
            onReject={onRejectAction}
          />
        )}

        {/* Checkpoint Diffs */}
        {!isUser && message.checkpoint && message.checkpoint.diff.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-[var(--ecode-border)]" />
              <span className="text-[11px] font-medium text-[var(--ecode-text-secondary)]">
                Checkpoint: {message.checkpoint.name}
              </span>
              <div className="h-px flex-1 bg-[var(--ecode-border)]" />
            </div>
            <MultiFileDiff diffs={message.checkpoint.diff} />
          </div>
        )}

        {/* Error Display */}
        {message.error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <div className="font-medium text-[13px] text-red-800 dark:text-red-200">
                Error: {message.error.message}
              </div>
            </div>
            {message.error.stack && (
              <pre className="mt-2 text-[11px] font-mono text-red-700 dark:text-red-300 overflow-x-auto">
                {message.error.stack}
              </pre>
            )}
            {message.error.recoverable && (
              <div className="mt-2 text-[11px] text-red-700 dark:text-red-300">
                This error is recoverable. The agent can continue.
              </div>
            )}
          </div>
        )}

        {/* Metadata + TTS button row */}
        <div className="flex items-center justify-between pt-1">
          {/* Metadata (Tokens, Time, Model, Cost) */}
          {!isUser && (message.metadata || message.pricing) ? (
            <div className="flex flex-wrap gap-3 border-t border-[var(--ecode-border)] pt-2">
              {message.metadata?.tokensUsed !== undefined && (
                <span className="text-[11px] text-[var(--ecode-text-secondary)] flex items-center gap-1">
                  <span className="font-medium">{message.metadata.tokensUsed.toLocaleString()}</span>
                  <span>tokens</span>
                </span>
              )}
              {message.pricing && (
                <span className="text-[11px] text-[var(--ecode-text-secondary)] flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {message.pricing.costInDollars}
                  </span>
                  <span className="text-[var(--ecode-text-tertiary)]">
                    ({message.pricing.complexity})
                  </span>
                </span>
              )}
              {message.metadata?.executionTimeMs !== undefined && (
                <span className="text-[11px] text-[var(--ecode-text-secondary)]">
                  <span className="font-medium">{message.metadata.executionTimeMs}</span>ms
                </span>
              )}
              {message.metadata?.model && (
                <span className="text-[11px] text-[var(--ecode-text-secondary)] font-mono">
                  {message.metadata.model}
                </span>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* TTS button — assistant messages only, appears on hover */}
          {!isUser && message.content && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-all",
                ttsState === 'idle'
                  ? "opacity-0 group-hover:opacity-100 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface)]"
                  : "opacity-100 text-primary"
              )}
              title={ttsState === 'playing' ? 'Arrêter la lecture' : 'Lire à voix haute'}
              onClick={speak}
            >
              {ttsState === 'loading' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : ttsState === 'playing' ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
