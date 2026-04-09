import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { 
  ChevronUp, Paperclip, Mic, SlidersHorizontal, ArrowUp, Loader2,
  Hammer, MessageSquare, Pencil, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashCommandMenu, DEFAULT_MCP_SERVERS, type MCPServer } from '../ai/SlashCommandMenu';
import { AgentToolsBottomSheet } from '../ai/AgentToolsBottomSheet';
import type { AgentToolsSettings } from '@/hooks/useAgentTools';
import { useKeyboardHeight } from '@/hooks/use-keyboard';

type AgentMode = 'build' | 'plan' | 'edit' | 'fast';

interface ReplitMobileInputBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onAttach?: () => void;
  onVoice?: () => void;
  onQuickActions?: () => void;
  onSettings?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isWorking?: boolean;
  agentMode?: string;
  onModeChange?: (mode: string) => void;
  onSlashCommand?: () => void;
  onSlashSelect?: (server: MCPServer) => void;
  agentToolsSettings?: AgentToolsSettings;
  onAgentToolsSettingsChange?: (settings: AgentToolsSettings) => void;
  isRecording?: boolean;
  isUploadingFiles?: boolean;
  pendingAttachmentsCount?: number;
}


export const ReplitMobileInputBar = memo(function ReplitMobileInputBar({
  placeholder,
  value = "",
  onChange,
  onSubmit,
  onAttach,
  onVoice,
  onQuickActions,
  onSettings,
  disabled = false,
  isLoading = false,
  isWorking = false,
  agentMode = 'build',
  onModeChange,
  onSlashCommand,
  onSlashSelect,
  agentToolsSettings,
  onAgentToolsSettingsChange,
  isRecording = false,
  isUploadingFiles = false,
  pendingAttachmentsCount = 0,
}: ReplitMobileInputBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [showAgentTools, setShowAgentTools] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyboardHeight = useKeyboardHeight();

  const defaultSettings: AgentToolsSettings = {
    maxAutonomy: false,
    appTesting: true,
    extendedThinking: false,
    highPowerModels: false,
    webSearch: true,
    imageGeneration: true,
  };
  const effectiveSettings = agentToolsSettings ?? defaultSettings;

  // Sync external value prop with internal state
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Dynamic placeholder based on agentMode
  const dynamicPlaceholder = placeholder || (
    agentMode === 'build' ? "What would you like to build?" :
    agentMode === 'edit' ? "Describe the changes to make..." :
    agentMode === 'chat' ? "Ask a question..." :
    "Make, test, iterate..."
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const prevValue = inputValue;
    
    // Detect "/" input for slash commands
    if (newValue.endsWith('/') && !prevValue.endsWith('/') && !showSlashMenu) {
      setShowSlashMenu(true);
      setSlashSearchQuery('');
      setSlashSelectedIndex(0);
      onSlashCommand?.();
    }
    
    // Update search query if slash menu is open
    if (showSlashMenu && newValue.includes('/')) {
      const slashIndex = newValue.lastIndexOf('/');
      const afterSlash = newValue.substring(slashIndex + 1);
      setSlashSearchQuery(afterSlash);
      setSlashSelectedIndex(0);
    }
    
    // Close menu if "/" is deleted
    if (showSlashMenu && !newValue.includes('/')) {
      setShowSlashMenu(false);
      setSlashSearchQuery('');
      setSlashSelectedIndex(0);
    }
    
    setInputValue(newValue);
    onChange?.(newValue);
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [onChange, inputValue, showSlashMenu, onSlashCommand]);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim() && !disabled && !isLoading && !isWorking) {
      onSubmit?.(inputValue.trim());
      setInputValue("");
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  }, [inputValue, disabled, isLoading, isWorking, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle slash menu navigation
    if (showSlashMenu) {
      const filteredServers = DEFAULT_MCP_SERVERS.filter(server =>
        server.name.toLowerCase().includes(slashSearchQuery.toLowerCase()) ||
        server.description?.toLowerCase().includes(slashSearchQuery.toLowerCase())
      );
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashSearchQuery('');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.min(prev + 1, filteredServers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredServers[slashSelectedIndex]) {
          handleSlashSelect(filteredServers[slashSelectedIndex]);
        }
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, showSlashMenu, slashSearchQuery, slashSelectedIndex]);

  const handleSlashSelect = useCallback((server: MCPServer) => {
    // Remove the "/" and any search query from input
    const slashIndex = inputValue.lastIndexOf('/');
    const beforeSlash = slashIndex > 0 ? inputValue.substring(0, slashIndex) : '';
    setInputValue(beforeSlash + `@${server.name} `);
    setShowSlashMenu(false);
    setSlashSearchQuery('');
    setSlashSelectedIndex(0);
    onSlashSelect?.(server);
    inputRef.current?.focus();
  }, [inputValue, onSlashSelect]);

  const handleBuildModeClick = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setShowBuildMenu(prev => !prev);
  }, []);

  const selectMode = useCallback((mode: AgentMode) => {
    onModeChange?.(mode);
    setShowBuildMenu(false);
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [onModeChange]);

  // Mode configurations matching ModeSelector.tsx
  const modes = [
    {
      id: 'build' as AgentMode,
      label: 'Build',
      icon: Hammer,
      description: 'Make, test, iterate autonomously',
      badge: 'Auto',
      color: 'emerald'
    },
    {
      id: 'plan' as AgentMode,
      label: 'Plan',
      icon: MessageSquare,
      description: 'Ask questions, plan your work',
      color: 'blue'
    },
    {
      id: 'edit' as AgentMode,
      label: 'Edit',
      icon: Pencil,
      description: 'Targeted changes to specific files',
      color: 'purple'
    },
    {
      id: 'fast' as AgentMode,
      label: 'Fast',
      icon: Zap,
      description: 'Quick, precise changes in seconds',
      badge: 'Speed',
      color: 'amber'
    }
  ];

  const currentMode = modes.find(m => m.id === agentMode) || modes[0];
  const CurrentModeIcon = currentMode.icon;

  const hasContent = inputValue.trim().length > 0;
  const isDisabled = disabled || isLoading || isWorking;

  return (
    <div 
      className="fixed left-0 right-0 z-40 px-3 pb-2 mobile-safe-bottom"
      style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '56px' }}
    >
      {/* Slash Command Menu - appears above input */}
      <SlashCommandMenu
        isOpen={showSlashMenu}
        onClose={() => {
          setShowSlashMenu(false);
          setSlashSearchQuery('');
          setSlashSelectedIndex(0);
        }}
        onSelect={handleSlashSelect}
        servers={DEFAULT_MCP_SERVERS}
        searchQuery={slashSearchQuery}
        onSearchChange={setSlashSearchQuery}
        selectedIndex={slashSelectedIndex}
      />
      
      <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={dynamicPlaceholder}
            disabled={isDisabled}
            rows={1}
            className={cn(
              "w-full px-4 pt-3 pb-12 text-[9px] resize-none bg-transparent",
              "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
              "focus:outline-none min-h-[48px] max-h-[120px]",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            data-testid="input-agent-message"
          />
          
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handleBuildModeClick}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all touch-manipulation",
                  currentMode.color === 'emerald' && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
                  currentMode.color === 'blue' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
                  currentMode.color === 'purple' && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
                  currentMode.color === 'amber' && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                  "active:scale-95"
                )}
                data-testid="button-build-mode"
              >
                <CurrentModeIcon className="h-3.5 w-3.5" />
                <span>{currentMode.label}</span>
                <ChevronUp className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showBuildMenu && "rotate-180"
                )} />
              </button>

              <button
                onClick={onAttach}
                disabled={isUploadingFiles}
                className={cn(
                  "p-2 rounded-lg active:scale-95 transition-all touch-manipulation relative",
                  isUploadingFiles 
                    ? "bg-primary/10 dark:bg-primary/20" 
                    : pendingAttachmentsCount > 0
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "active:bg-gray-100 dark:active:bg-[#2A2A2A]"
                )}
                data-testid="button-attach"
              >
                {isUploadingFiles ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Paperclip className={cn(
                    "h-4 w-4",
                    pendingAttachmentsCount > 0 ? "text-primary" : "text-gray-500 dark:text-gray-400"
                  )} />
                )}
                {pendingAttachmentsCount > 0 && !isUploadingFiles && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                    {pendingAttachmentsCount > 9 ? '9+' : pendingAttachmentsCount}
                  </span>
                )}
              </button>

              <button
                onClick={onVoice}
                className={cn(
                  "p-2 rounded-lg active:scale-95 transition-all touch-manipulation",
                  isRecording 
                    ? "bg-red-500/10 dark:bg-red-500/20" 
                    : "active:bg-gray-100 dark:active:bg-[#2A2A2A]"
                )}
                data-testid="button-voice"
              >
                <Mic className={cn(
                  "h-4 w-4",
                  isRecording 
                    ? "text-red-500 animate-pulse" 
                    : "text-gray-500 dark:text-gray-400"
                )} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAgentTools(true)}
                className={cn(
                  "p-2 rounded-lg active:bg-gray-100 dark:active:bg-[#2A2A2A] active:scale-95 transition-all touch-manipulation",
                  effectiveSettings.maxAutonomy && "bg-amber-100 dark:bg-amber-900/30"
                )}
                data-testid="button-agent-tools"
              >
                <SlidersHorizontal className={cn(
                  "h-4 w-4",
                  effectiveSettings.maxAutonomy 
                    ? "text-amber-600 dark:text-amber-400" 
                    : "text-gray-500 dark:text-gray-400"
                )} />
              </button>

              <button
                onClick={handleSubmit}
                disabled={!hasContent || isDisabled}
                className={cn(
                  "p-2 rounded-lg transition-all active:scale-95 touch-manipulation",
                  hasContent && !isDisabled
                    ? "bg-[#F59E0B] active:bg-[#D97706] text-white"
                    : "bg-gray-100 dark:bg-[#2A2A2A] text-gray-400"
                )}
                data-testid="button-send"
              >
                {isWorking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {showBuildMenu && (
          <div className="border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
            <div className="p-2 space-y-1">
              {modes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = agentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => selectMode(mode.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left rounded-lg transition-colors touch-manipulation flex items-center gap-3",
                      isActive
                        ? mode.color === 'emerald' ? "bg-emerald-100 dark:bg-emerald-900/30" :
                          mode.color === 'blue' ? "bg-blue-100 dark:bg-blue-900/30" :
                          mode.color === 'purple' ? "bg-purple-100 dark:bg-purple-900/30" :
                          "bg-amber-100 dark:bg-amber-900/30"
                        : "active:bg-gray-100 dark:active:bg-[#2A2A2A]"
                    )}
                    data-testid={`mode-${mode.id}`}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg",
                      mode.color === 'emerald' && "bg-emerald-200 dark:bg-emerald-800/50",
                      mode.color === 'blue' && "bg-blue-200 dark:bg-blue-800/50",
                      mode.color === 'purple' && "bg-purple-200 dark:bg-purple-800/50",
                      mode.color === 'amber' && "bg-amber-200 dark:bg-amber-800/50"
                    )}>
                      <ModeIcon className={cn(
                        "h-4 w-4",
                        mode.color === 'emerald' && "text-emerald-600 dark:text-emerald-400",
                        mode.color === 'blue' && "text-blue-600 dark:text-blue-400",
                        mode.color === 'purple' && "text-purple-600 dark:text-purple-400",
                        mode.color === 'amber' && "text-amber-600 dark:text-amber-400"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-[13px]",
                          isActive 
                            ? mode.color === 'emerald' ? "text-emerald-700 dark:text-emerald-400" :
                              mode.color === 'blue' ? "text-blue-700 dark:text-blue-400" :
                              mode.color === 'purple' ? "text-purple-700 dark:text-purple-400" :
                              "text-amber-700 dark:text-amber-400"
                            : "text-gray-800 dark:text-gray-200"
                        )}>{mode.label}</span>
                        {mode.badge && (
                          <span className={cn(
                            "px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase text-white",
                            mode.color === 'emerald' && "bg-emerald-500",
                            mode.color === 'amber' && "bg-amber-500"
                          )}>{mode.badge}</span>
                        )}
                        {isActive && (
                          <span className={cn(
                            "w-2 h-2 rounded-full ml-auto",
                            mode.color === 'emerald' && "bg-emerald-500",
                            mode.color === 'blue' && "bg-blue-500",
                            mode.color === 'purple' && "bg-purple-500",
                            mode.color === 'amber' && "bg-amber-500"
                          )} />
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {mode.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AgentToolsBottomSheet
        open={showAgentTools}
        onOpenChange={setShowAgentTools}
        settings={effectiveSettings}
        onSettingsChange={onAgentToolsSettingsChange ?? (() => {})}
      />
    </div>
  );
});
