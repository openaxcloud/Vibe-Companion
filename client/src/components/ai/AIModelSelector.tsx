import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Cpu, Zap, CheckCircle2 } from 'lucide-react';
import { SiOpenai, SiGoogle } from 'react-icons/si';
import { RAGToggle, RAGStatusBadge, useRAGStats } from './RAGControls';

const AnthropicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.541h6.912l1.368 3.541h3.744L10.44 3.541zm-.456 10.295l2.304-5.975 2.304 5.975z"/>
  </svg>
);

const XAIIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M3 3l8.5 9.5L3 21h2l7-7 7 7h2l-8.5-8.5L19 3h-2l-6 6-6-6z"/>
  </svg>
);

const MoonshotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  costPer1kTokens?: number;
  available?: boolean;
}

interface AIModelSelectorProps {
  variant?: 'inline' | 'card' | 'hero';
  className?: string;
  onModelChange?: (modelId: string) => void;
  showRAGControls?: boolean;
  sessionId?: string;
  onRAGToggle?: (enabled: boolean) => void;
}

const OpenHandsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const ClaudeAgentIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1.27c.34-.6.99-1 1.73-1a2 2 0 1 1 0 4c-.74 0-1.39-.4-1.73-1H20a7 7 0 0 1-7 7v1.27c.6.34 1 .99 1 1.73a2 2 0 1 1-4 0c0-.74.4-1.39 1-1.73V16a7 7 0 0 1-7-7H2.73c-.34.6-.99 1-1.73 1a2 2 0 1 1 0-4c.74 0 1.39.4 1.73 1H4a7 7 0 0 1 7-7V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm0 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
  </svg>
);

const getProviderIcon = (provider: string) => {
  const icons: Record<string, React.ElementType> = {
    openai: SiOpenai,
    anthropic: AnthropicIcon,
    gemini: SiGoogle,
    xai: XAIIcon,
    moonshot: MoonshotIcon,
    openhands: OpenHandsIcon,
    'claude-agent': ClaudeAgentIcon,
    default: Cpu
  };
  return icons[provider] || icons.default;
};

const getProviderColor = (provider: string) => {
  const colors: Record<string, string> = {
    openai: 'bg-green-500',
    anthropic: 'bg-orange-500',
    gemini: 'bg-blue-500',
    xai: 'bg-purple-500',
    moonshot: 'bg-cyan-500',
    openhands: 'bg-emerald-500',
    'claude-agent': 'bg-amber-600',
    default: 'bg-gray-500'
  };
  return colors[provider] || colors.default;
};

export function AIModelSelector({ 
  variant = 'inline', 
  className = '', 
  onModelChange,
  showRAGControls = false, // Replit-style: RAG is automatic, no user toggle needed
  sessionId,
  onRAGToggle
}: AIModelSelectorProps) {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const { data: ragStats } = useRAGStats();

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery<{ models: AIModel[] }>({
    queryKey: ['/api/models'],
  });

  // Fetch user's preferred model (may fail on public pages - that's OK)
  const { data: preferredData, isLoading: preferredLoading } = useQuery<{ preferredModel: string | null; availableModels: number }>({
    queryKey: ['/api/models/preferred'],
    staleTime: 30000, // Cache for 30s
    retry: false, // Don't retry on auth failures (public pages)
  });

  // Mutation to save preferred model
  const savePreferredModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest('POST', '/api/models/preferred', { modelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/models/preferred'] });
      toast({
        title: 'Success',
        description: 'AI model preference saved successfully',
      });
    },
    onError: (error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.message?.includes('Not authenticated')) {
        return;
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to save model preference',
        variant: 'destructive',
      });
    }
  });

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    savePreferredModelMutation.mutate(modelId);
    onModelChange?.(modelId);

    const modelObj = availableModels.find((m: AIModel) => m.id === modelId);
    if (modelObj) {
      if (modelObj.provider === 'openhands') {
        try {
          localStorage.setItem('ai-agent-provider', 'openhands');
        } catch {}
      } else if (modelObj.provider === 'goose') {
        try {
          localStorage.setItem('ai-agent-provider', 'goose');
        } catch {}
      } else if (modelObj.provider === 'claude-agent') {
        try {
          localStorage.setItem('ai-agent-provider', 'claude-agent');
        } catch {}
      } else {
        const providerMap: Record<string, string> = {
          openai: 'gpt',
          anthropic: 'claude',
          gemini: 'gemini',
          google: 'gemini',
          xai: 'gpt',
          moonshot: 'gpt',
        };
        const aiPanelProvider = providerMap[modelObj.provider] || 'claude';
        try {
          localStorage.setItem('ai-preferred-model', aiPanelProvider);
          localStorage.setItem('ai-agent-provider', 'builtin');
        } catch {}
      }
    }
  };

  const currentModel = selectedModel || preferredData?.preferredModel || null;
  const availableModels = (modelsData?.models || []).filter(
    (m: AIModel, i: number, arr: AIModel[]) => arr.findIndex((n: AIModel) => n.id === m.id) === i
  );

  if (modelsLoading || preferredLoading) {
    return <Skeleton className="h-10 sm:h-12 w-full" />;
  }

  if (availableModels.length === 0) {
    return (
      <Card className="border-yellow-500 bg-surface-solid">
        <CardContent className="p-3 sm:p-4">
          <p className="text-[11px] sm:text-[13px] text-yellow-600 dark:text-yellow-500">
            No AI providers configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, XAI_API_KEY, or MOONSHOT_API_KEY.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
              <h3 className="font-semibold text-[13px] sm:text-base">AI Model Selection</h3>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">
              Choose your preferred AI model for code generation ({availableModels.length} available)
            </p>
            <Select value={currentModel || undefined} onValueChange={handleModelChange}>
              <SelectTrigger className="w-full min-h-[44px]" data-testid="select-ai-model">
                <SelectValue placeholder="Select AI model..." />
              </SelectTrigger>
              <SelectContent 
                className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-[min(600px,95vw)] max-h-[60vh] overflow-y-auto"
                position="popper"
                sideOffset={4}
              >
                {availableModels.map((model) => {
                  const ProviderIcon = getProviderIcon(model.provider);
                  const providerColor = getProviderColor(model.provider);
                  const isAvailable = model.available !== false;
                  return (
                    <SelectItem 
                      key={model.id} 
                      value={model.id} 
                      data-testid={`select-model-${model.id}`}
                      disabled={!isAvailable}
                      className={`${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''} py-2`}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${providerColor}`} />
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-medium text-[13px] flex items-center gap-2">
                            {model.name}
                            {model.supportsStreaming && isAvailable && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Stream</Badge>
                            )}
                            {!isAvailable && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">N/A</Badge>}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">{model.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentModel && (
              <div className="flex items-center gap-2 text-[11px] sm:text-[13px] text-green-600 dark:text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Model preference saved</span>
              </div>
            )}
            
            {showRAGControls && (
              <div className="pt-3 mt-3 border-t border-border">
                <RAGToggle 
                  sessionId={sessionId} 
                  onToggle={onRAGToggle}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Hero variant - Large, prominent display for homepage
  // ✅ MOBILE-RESPONSIVE (Nov 24, 2025): Stack header on mobile, adjust sizes, hide descriptions on xs screens
  if (variant === 'hero') {
    const currentModelData = availableModels.find(m => m.id === currentModel);
    const ProviderIcon = currentModelData ? getProviderIcon(currentModelData.provider) : Sparkles;
    const providerColor = currentModelData ? getProviderColor(currentModelData.provider) : 'bg-orange-500';

    return (
      <div className={`space-y-2 sm:space-y-3 ${className}`} data-testid="ai-model-selector-hero-container">
        {/* Header: Stack on mobile, side-by-side on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid="ai-model-selector-hero-header">
          <div className="flex items-center gap-2 text-white/90">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-[13px] sm:text-base font-semibold">Choose Your AI Model</span>
          </div>
          <div className="flex items-center gap-2">
            {showRAGControls && ragStats?.isAvailable && (
              <RAGStatusBadge 
                isAvailable={ragStats.isAvailable} 
                enabled={true} 
                className="bg-surface-tertiary-solid border-border"
              />
            )}
            <Badge variant="secondary" className="bg-surface-tertiary-solid text-white border-border w-fit">
              {availableModels.length} models
            </Badge>
          </div>
        </div>
        
        <Select value={currentModel || undefined} onValueChange={handleModelChange}>
          <SelectTrigger 
            className="w-full h-12 sm:h-14 bg-white dark:bg-gray-900 dark:bg-gray-900 text-foreground border-2 border-white/40 hover:border-white/60 transition-all shadow-lg"
            data-testid="select-ai-model-hero"
          >
            {currentModelData ? (
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${providerColor} shrink-0`} />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-semibold text-[13px] sm:text-base truncate">{currentModelData.name}</div>
                  {/* Hide description on mobile, show on sm+ */}
                  <div className="hidden sm:block text-[11px] text-muted-foreground truncate">{currentModelData.description}</div>
                </div>
                {currentModelData.supportsStreaming && (
                  <Badge variant="secondary" className="text-[11px] shrink-0">
                    <Zap className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Streaming</span>
                  </Badge>
                )}
              </div>
            ) : (
              <SelectValue placeholder="Select your preferred AI model..." />
            )}
          </SelectTrigger>
          <SelectContent 
            className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-[min(650px,95vw)] max-h-[60vh] overflow-y-auto"
            position="popper"
            sideOffset={4}
          >
            {availableModels.map((model) => {
              const ModelIcon = getProviderIcon(model.provider);
              const modelColor = getProviderColor(model.provider);
              const isAvailable = model.available !== false;
              return (
                <SelectItem 
                  key={model.id} 
                  value={model.id} 
                  data-testid={`select-model-${model.id}`}
                  disabled={!isAvailable}
                  className={`${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''} py-2.5`}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div 
                      className={`w-8 h-8 rounded-full ${modelColor} flex items-center justify-center shrink-0`}
                      data-testid={`provider-icon-${model.provider}`}
                    >
                      <ModelIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-[13px] flex items-center gap-2 flex-wrap">
                        <span>{model.name}</span>
                        {model.supportsStreaming && isAvailable && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Zap className="h-3 w-3 mr-0.5" />Stream
                          </Badge>
                        )}
                        {!isAvailable && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">N/A</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">{model.description}</div>
                      {model.costPer1kTokens && (
                        <div className="text-[9px] text-muted-foreground/70 mt-0.5">
                          ${model.costPer1kTokens.toFixed(4)} / 1K tokens
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {currentModelData && (
          <div className="flex items-center gap-2 text-[11px] sm:text-[13px] text-muted-foreground bg-surface-solid rounded-md px-2 sm:px-3 py-1.5 sm:py-2">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400 shrink-0" />
            <span className="truncate">Using {currentModelData.name} for code generation</span>
          </div>
        )}
      </div>
    );
  }

  // Inline variant - Compact for settings dropdown
  return (
    <div className={`space-y-1 ${className}`}>
      <Select value={currentModel || undefined} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full h-8 text-[11px] bg-surface-solid border-border" data-testid="select-ai-model-inline">
          <SelectValue placeholder="Select model..." />
        </SelectTrigger>
        <SelectContent className="w-56 max-h-[300px]">
          {availableModels.map((model) => {
            const providerColor = getProviderColor(model.provider);
            const isAvailable = model.available !== false;
            return (
              <SelectItem 
                key={model.id} 
                value={model.id} 
                data-testid={`select-model-${model.id}`}
                disabled={!isAvailable}
                className={!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${providerColor}`} />
                  <span className="truncate text-[11px] font-medium">{model.name}</span>
                  {!isAvailable && <span className="text-[10px] text-red-500 shrink-0">N/A</span>}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
