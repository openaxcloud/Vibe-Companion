import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Send, Mic, Paperclip } from 'lucide-react';

interface ReplitMobileInputBarProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  isWorking?: boolean;
  agentMode?: string;
  onModeChange?: (mode: string) => void;
  onSlashCommand?: () => void;
  agentToolsSettings?: any;
  onAgentToolsSettingsChange?: (settings: any) => void;
  onAttach?: () => void;
  onVoice?: () => void;
  isRecording?: boolean;
  isUploadingFiles?: boolean;
  pendingAttachmentsCount?: number;
}

export function ReplitMobileInputBar({
  placeholder = "Ask the AI agent...",
  onSubmit,
  isWorking,
  onAttach,
  onVoice,
  isRecording,
  pendingAttachmentsCount,
}: ReplitMobileInputBarProps) {
  const [value, setValue] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect virtual keyboard via visualViewport API
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardVisible(heightDiff > 150);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Scroll input into view when keyboard opens
  const handleFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }, []);

  const handleSubmit = () => {
    if (value.trim() && !isWorking) {
      onSubmit(value.trim());
      setValue('');
      // Auto-resize textarea back to 1 row
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-40 px-3 pt-1 bg-gradient-to-t from-[var(--ide-bg)] via-[var(--ide-bg)] to-transparent transition-[bottom] duration-200",
        keyboardVisible ? "bottom-0" : "bottom-[52px]"
      )}
      style={{
        paddingBottom: keyboardVisible
          ? '8px'
          : 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="flex items-end gap-2 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-2xl px-3 py-2 shadow-lg">
        {onAttach && (
          <button
            onClick={onAttach}
            className="w-8 h-8 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors shrink-0 relative"
          >
            <Paperclip className="w-4 h-4" />
            {(pendingAttachmentsCount ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0079F2] text-white text-[8px] flex items-center justify-center">
                {pendingAttachmentsCount}
              </span>
            )}
          </button>
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInput}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          className="flex-1 bg-transparent text-[13px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none resize-none min-h-[32px] max-h-[120px] py-1 mobile-scroll"
          style={{ scrollbarWidth: 'none' }}
        />
        <div className="flex items-center gap-1 shrink-0">
          {onVoice && (
            <button
              onClick={onVoice}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                isRecording ? 'bg-red-500 text-white' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || isWorking}
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded-full transition-all',
              value.trim() && !isWorking
                ? 'bg-[#0079F2] text-white'
                : 'text-[var(--ide-text-muted)]'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
