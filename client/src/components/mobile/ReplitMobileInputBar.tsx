import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Send, Mic, Paperclip, ChevronDown, MessageSquare, Bot, Zap, Gauge, Rocket, Flame, Wrench, Globe, TestTube, Sparkles, Code2, MicOff, X, FileText, Image as ImageIcon, File as FileIcon, Brain, Cpu, Terminal, Check } from 'lucide-react';
import { OpenAILogo, AnthropicLogo, GeminiLogo, OpenHandsLogo, ClaudeAgentLogo, GooseLogo } from '@/components/icons/AIProviderLogos';

type AIMode = 'chat' | 'agent' | 'plan';
type AgentMode = 'economy' | 'power' | 'turbo';
type AIModel = 'claude' | 'gpt' | 'gemini' | 'openrouter' | 'perplexity' | 'mistral' | 'openhands' | 'goose';

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

const PROVIDER_META: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; groupKey: AIModel; isExternal: boolean; shortName: string }> = {
  openai:          { color: '#10A37F', icon: OpenAILogo,      groupKey: 'gpt',           isExternal: false, shortName: 'GPT' },
  anthropic:       { color: '#D4A27F', icon: AnthropicLogo,   groupKey: 'claude',        isExternal: false, shortName: 'Claude' },
  gemini:          { color: '#4285F4', icon: GeminiLogo,      groupKey: 'gemini',        isExternal: false, shortName: 'Gemini' },
  openhands:       { color: '#10B981', icon: OpenHandsLogo,   groupKey: 'openhands',     isExternal: true,  shortName: 'OpenHands' },
  goose:           { color: '#F97316', icon: GooseLogo,       groupKey: 'goose',         isExternal: true,  shortName: 'Goose' },
  'claude-agent':  { color: '#D4A27F', icon: ClaudeAgentLogo, groupKey: 'claude-agent' as AIModel, isExternal: true,  shortName: 'Agent SDK' },
};

interface AgentToolsConfig {
  liteMode: boolean;
  webSearch: boolean;
  appTesting: boolean;
  codeOptimizations: boolean;
  architect: boolean;
  turbo: boolean;
}

interface AttachmentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
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
  isTranscribing?: boolean;
  isUploadingFiles?: boolean;
  pendingAttachmentsCount?: number;
  attachments?: AttachmentInfo[];
  onRemoveAttachment?: (id: string) => void;
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
  isTranscribing,
  pendingAttachmentsCount,
  attachments = [],
  onRemoveAttachment,
}: ReplitMobileInputBarProps) {
  const [value, setValue] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showAgentModeDropdown, setShowAgentModeDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
    try { const s = localStorage.getItem('ai-preferred-model'); if (s) return s as AIModel; } catch {}
    return 'claude';
  });
  const [agentProvider, setAgentProvider] = useState<'builtin' | 'openhands' | 'goose' | 'claude-agent'>(() => {
    try { const s = localStorage.getItem('ai-agent-provider'); if (s) return s as any; } catch {}
    return 'builtin';
  });
  const [liveModels, setLiveModels] = useState<Array<{id: string; name: string; provider: string; description: string}>>([]);

  useEffect(() => {
    fetch('/api/models', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data?.models && Array.isArray(data.models)) setLiveModels(data.models); })
      .catch(() => {});
  }, []);

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
    if (!showModeDropdown && !showAgentModeDropdown && !showToolsDropdown && !showProviderDropdown) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowModeDropdown(false);
        setShowAgentModeDropdown(false);
        setShowToolsDropdown(false);
        setShowProviderDropdown(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handler, true);
      document.addEventListener('touchend', handler, { passive: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler, true);
      document.removeEventListener('touchend', handler);
    };
  }, [showModeDropdown, showAgentModeDropdown, showToolsDropdown, showProviderDropdown]);

  const handleFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }, []);

  const canSend = (!isWorking) && (value.trim() || (pendingAttachmentsCount ?? 0) > 0);

  const handleSubmit = () => {
    if (canSend) {
      onSubmit(value.trim() || '(attached files)');
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

  const currentProviderDisplay = (() => {
    if (agentProvider !== 'builtin') {
      const extMeta: Record<string, { color: string; icon: typeof Sparkles; name: string }> = {
        'claude-agent': { color: '#D97F06', icon: Bot, name: 'Agent SDK' },
        openhands: { color: '#10B981', icon: Globe, name: 'OpenHands' },
        goose: { color: '#F97316', icon: Terminal, name: 'Goose' },
      };
      return extMeta[agentProvider] || { color: '#9CA3AF', icon: Cpu, name: agentProvider };
    }
    const modelMeta: Record<string, { color: string; icon: typeof Sparkles; name: string }> = {
      claude: { color: '#7C65CB', icon: Sparkles, name: 'Claude' },
      gpt: { color: '#0CCE6B', icon: Zap, name: 'GPT' },
      gemini: { color: '#4285F4', icon: Zap, name: 'Gemini' },
    };
    return modelMeta[selectedModel] || { color: '#9CA3AF', icon: Cpu, name: selectedModel };
  })();
  const ProviderIcon = currentProviderDisplay.icon;

  const toolsCount = agentToolsConfig
    ? [agentToolsConfig.webSearch, agentToolsConfig.appTesting, agentToolsConfig.codeOptimizations, agentToolsConfig.architect].filter(Boolean).length
    : 0;

  return (
    <div
      className="shrink-0 z-[55] px-3"
      style={{
        paddingBottom: '4px',
        paddingTop: '4px',
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

        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pb-1 pt-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {attachments.map((att) => {
              const AttIcon = att.type === 'image' ? ImageIcon : att.type === 'text' ? FileText : FileIcon;
              const sizeLabel = att.size < 1024 ? `${att.size}B` : att.size < 1024 * 1024 ? `${Math.round(att.size / 1024)}KB` : `${(att.size / (1024 * 1024)).toFixed(1)}MB`;
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-1 bg-[var(--ide-surface)] rounded-md px-2 py-1 shrink-0 max-w-[140px]"
                  data-testid={`attachment-chip-${att.id}`}
                >
                  <AttIcon className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                  <span className="text-[10px] text-[var(--ide-text-secondary)] truncate">{att.name}</span>
                  <span className="text-[8px] text-[var(--ide-text-muted)] shrink-0">{sizeLabel}</span>
                  {onRemoveAttachment && (
                    <button
                      onClick={() => onRemoveAttachment(att.id)}
                      className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-500/20 text-[var(--ide-text-muted)] hover:text-red-400 shrink-0 transition-colors"
                      data-testid={`remove-attachment-${att.id}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
          <div className="flex items-center gap-1 overflow-visible">
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => { e.stopPropagation(); setShowModeDropdown(!showModeDropdown); setShowAgentModeDropdown(false); setShowToolsDropdown(false); }}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--ide-surface)] select-none touch-manipulation"
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

            <div className="w-px h-3.5 bg-[var(--ide-border)]" />
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => { e.stopPropagation(); setShowProviderDropdown(!showProviderDropdown); setShowModeDropdown(false); setShowAgentModeDropdown(false); setShowToolsDropdown(false); }}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--ide-surface)] select-none touch-manipulation"
                style={{ color: currentProviderDisplay.color }}
                data-testid="mobile-provider-selector"
              >
                <ProviderIcon className="w-3 h-3" />
                {currentProviderDisplay.name}
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>
              {showProviderDropdown && (
                <div className="absolute bottom-full left-0 mb-1 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl overflow-hidden min-w-[200px] max-h-[320px] overflow-y-auto z-50" data-dropdown>
                  <div className="px-3 py-1.5 text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider border-b border-[var(--ide-border)]">AI Provider</div>
                  {liveModels.map(lm => {
                    const meta = PROVIDER_META[lm.provider];
                    if (!meta) return null;
                    const MdlIcon = meta.icon;
                    const isSelected = meta.isExternal
                      ? agentProvider === lm.provider
                      : agentProvider === 'builtin' && selectedModel === meta.groupKey;
                    return (
                      <button
                        key={lm.id}
                        onClick={() => {
                          if (meta.isExternal) {
                            setAgentProvider(lm.provider as 'openhands' | 'goose' | 'claude-agent');
                            try { localStorage.setItem('ai-agent-provider', lm.provider); } catch {}
                          } else {
                            setSelectedModel(meta.groupKey);
                            setAgentProvider('builtin');
                            try { localStorage.setItem('ai-preferred-model', meta.groupKey); localStorage.setItem('ai-agent-provider', 'builtin'); } catch {}
                          }
                          setShowProviderDropdown(false);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-2 text-[11px] transition-colors",
                          isSelected ? "bg-[var(--ide-surface)]" : "hover:bg-[var(--ide-surface)]/50"
                        )}
                        data-testid={`mobile-model-${lm.id}`}
                      >
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                          <MdlIcon className="w-3 h-3" style={{ color: meta.color }} />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 text-left">
                          <span className="font-medium text-[var(--ide-text)]">{lm.name}</span>
                          <span className="text-[9px] text-[var(--ide-text-muted)] truncate">{lm.description}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#0CCE6B]" />}
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
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-[var(--ide-surface)] select-none touch-manipulation"
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
                        className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] transition-colors select-none touch-manipulation"
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
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white dark:bg-gray-900 transition-transform",
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
                data-testid="mobile-attach-button"
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
                disabled={isTranscribing}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                  isRecording ? 'bg-red-500 text-white animate-pulse' : isTranscribing ? 'text-[#0079F2] animate-pulse opacity-70' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]'
                )}
                data-testid="mobile-voice-button"
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full transition-all shadow-sm',
                canSend
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
