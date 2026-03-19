import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Send, Mic, Paperclip, ChevronDown, MessageSquare, Bot, Zap, Gauge, Rocket, Flame, Wrench, Globe, TestTube, Sparkles, Code2, MicOff } from 'lucide-react';

type AIMode = 'chat' | 'agent' | 'plan';
type AgentMode = 'economy' | 'power' | 'turbo';

const AI_MODE_CONFIG = {
  chat: { label: 'Chat', icon: MessageSquare, color: 'var(--ide-text)' },
  agent: { label: 'Agent', icon: Bot, color: '#7C65CB' },
  plan: { label: 'Plan', icon: Zap, color: '#009118' },
};

const AGENT_MODE_CONFIG = {
  economy: { label: 'Eco', icon: Gauge, color: '#0CCE6B', desc: '1 cr' },
  power: { label: 'Pwr', icon: Rocket, color: '#0079F2', desc: '3 cr' },
  turbo: { label: 'Trb', icon: Flame, color: '#FF6B35', desc: '5 cr' },
};

interface AgentToolsConfig {
  liteMode: boolean;
  webSearch: boolean;
  appTesting: boolean;
  codeOptimizations: boolean;
  architect: boolean;
  turbo: boolean;
}

interface ReplitMobileInputBarProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  isWorking?: boolean;
  aiMode?: AIMode;
  onAIModeChange?: (mode: AIMode) => void;
  agentMode?: AgentMode;
  onAgentModeChange?: (mode: AgentMode) => void;
  agentToolsConfig?: AgentToolsConfig;
  onAgentToolsConfigChange?: (config: AgentToolsConfig) => void;
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
  aiMode = 'agent',
  onAIModeChange,
  agentMode = 'economy',
  onAgentModeChange,
  agentToolsConfig,
  onAgentToolsConfigChange,
  onAttach,
  onVoice,
  isRecording,
  pendingAttachmentsCount,
}: ReplitMobileInputBarProps) {
  const [value, setValue] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showAgentModeDropdown, setShowAgentModeDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (!showModeDropdown && !showAgentModeDropdown && !showToolsDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowModeDropdown(false);
        setShowAgentModeDropdown(false);
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showModeDropdown, showAgentModeDropdown, showToolsDropdown]);

  const handleFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }, []);

  const handleSubmit = () => {
    if (value.trim() && !isWorking) {
      onSubmit(value.trim());
      setValue('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const currentAIMode = AI_MODE_CONFIG[aiMode];
  const CurrentModeIcon = currentAIMode.icon;
  const currentAgentMode = AGENT_MODE_CONFIG[agentMode];
  const CurrentAgentIcon = currentAgentMode.icon;

  const toolsCount = agentToolsConfig
    ? [agentToolsConfig.webSearch, agentToolsConfig.appTesting, agentToolsConfig.codeOptimizations, agentToolsConfig.architect].filter(Boolean).length
    : 0;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-40 px-3 transition-[bottom] duration-200",
        keyboardVisible ? "bottom-0" : "bottom-[52px]"
      )}
      style={{
        paddingBottom: keyboardVisible
          ? '8px'
          : 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-2xl shadow-lg overflow-visible">
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
          className="w-full bg-transparent text-[13px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none resize-none min-h-[36px] max-h-[120px] px-3.5 pt-2.5 pb-1 mobile-scroll"
          style={{ scrollbarWidth: 'none' }}
          data-testid="mobile-chat-input"
        />

        <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => { e.stopPropagation(); setShowModeDropdown(!showModeDropdown); setShowAgentModeDropdown(false); setShowToolsDropdown(false); }}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--ide-surface)]"
                style={{ color: currentAIMode.color }}
                data-testid="mobile-mode-selector"
              >
                <CurrentModeIcon className="w-3 h-3" />
                {currentAIMode.label}
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>
              {showModeDropdown && (
                <div className="absolute bottom-full left-0 mb-1 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl overflow-hidden min-w-[120px] z-50" data-dropdown>
                  {(Object.entries(AI_MODE_CONFIG) as [AIMode, typeof AI_MODE_CONFIG.chat][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => { onAIModeChange?.(key); setShowModeDropdown(false); }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-[11px] font-medium transition-colors",
                          aiMode === key ? "bg-[var(--ide-surface)]" : "hover:bg-[var(--ide-surface)]/50"
                        )}
                        style={{ color: cfg.color }}
                        data-testid={`mobile-mode-${key}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {aiMode === 'agent' && (
              <>
                <div className="w-px h-3.5 bg-[var(--ide-border)]" />
                <div className="relative" data-dropdown>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAgentModeDropdown(!showAgentModeDropdown); setShowModeDropdown(false); setShowToolsDropdown(false); }}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--ide-surface)]"
                    style={{ color: currentAgentMode.color }}
                    data-testid="mobile-agent-mode-selector"
                  >
                    <CurrentAgentIcon className="w-3 h-3" />
                    {currentAgentMode.label}
                    <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                  </button>
                  {showAgentModeDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl overflow-hidden min-w-[150px] z-50" data-dropdown>
                      {(Object.entries(AGENT_MODE_CONFIG) as [AgentMode, typeof AGENT_MODE_CONFIG.economy][]).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => { onAgentModeChange?.(key); setShowAgentModeDropdown(false); }}
                            className={cn(
                              "flex items-center gap-2 w-full px-3 py-2 text-[11px] transition-colors",
                              agentMode === key ? "bg-[var(--ide-surface)]" : "hover:bg-[var(--ide-surface)]/50"
                            )}
                            data-testid={`mobile-agent-mode-${key}`}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                            <span className="font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                            <span className="text-[9px] text-[var(--ide-text-muted)] ml-auto">{cfg.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {agentToolsConfig && onAgentToolsConfigChange && (
                  <>
                    <div className="w-px h-3.5 bg-[var(--ide-border)]" />
                    <div className="relative" data-dropdown>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowToolsDropdown(!showToolsDropdown); setShowModeDropdown(false); setShowAgentModeDropdown(false); }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] transition-colors"
                        data-testid="mobile-agent-tools"
                      >
                        <Wrench className="w-3 h-3" />
                        {toolsCount > 0 && (
                          <span className="w-3.5 h-3.5 rounded-full bg-[#0079F2] text-white text-[8px] flex items-center justify-center leading-none">{toolsCount}</span>
                        )}
                      </button>
                      {showToolsDropdown && (
                        <div className="absolute bottom-full left-0 mb-1 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl overflow-hidden min-w-[170px] z-50" data-dropdown>
                          <div className="px-3 py-1.5 text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider border-b border-[var(--ide-border)]">Agent Tools</div>
                          {[
                            { key: 'webSearch' as const, label: 'Web Search', icon: Globe },
                            { key: 'appTesting' as const, label: 'App Testing', icon: TestTube },
                            { key: 'codeOptimizations' as const, label: 'Optimize', icon: Sparkles },
                            { key: 'architect' as const, label: 'Architect', icon: Code2 },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAgentToolsConfigChange({ ...agentToolsConfig, [key]: !agentToolsConfig[key] });
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[11px] transition-colors hover:bg-[var(--ide-surface)]/50"
                              data-testid={`mobile-tool-${key}`}
                            >
                              <Icon className="w-3 h-3 text-[var(--ide-text-muted)]" />
                              <span className="flex-1 text-left text-[var(--ide-text-secondary)]">{label}</span>
                              <div className={cn(
                                "w-7 h-3.5 rounded-full transition-colors relative",
                                agentToolsConfig[key] ? "bg-[#0079F2]" : "bg-[var(--ide-border)]"
                              )}>
                                <div className={cn(
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform",
                                  agentToolsConfig[key] ? "translate-x-3.5" : "translate-x-0.5"
                                )} />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {onAttach && (
              <button
                onClick={onAttach}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors relative"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {(pendingAttachmentsCount ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#0079F2] text-white text-[7px] flex items-center justify-center">{pendingAttachmentsCount}</span>
                )}
              </button>
            )}
            {onVoice && (
              <button
                onClick={onVoice}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]'
                )}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || isWorking}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full transition-all shadow-sm',
                value.trim() && !isWorking
                  ? 'bg-[#7C65CB] hover:bg-[#6B56B8] text-white shadow-[#7C65CB]/20'
                  : 'text-[var(--ide-text-muted)] opacity-30'
              )}
              data-testid="mobile-send-button"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
