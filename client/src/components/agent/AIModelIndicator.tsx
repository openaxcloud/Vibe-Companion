import { Cpu, Zap, Sparkles, Brain, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ModelTier = 'fast' | 'balanced' | 'quality';

export interface DelegationInfo {
  tier: ModelTier;
  model: string;
  provider: string;
  reason?: string;
  taskComplexity?: number;
  estimatedTokens?: number;
}

interface AIModelIndicatorProps {
  delegation: DelegationInfo;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TIER_CONFIG: Record<ModelTier, {
  label: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  description: string;
}> = {
  fast: {
    label: 'Fast',
    icon: Zap,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Quick responses for simple tasks'
  },
  balanced: {
    label: 'Balanced',
    icon: Cpu,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Good balance of speed and quality'
  },
  quality: {
    label: 'Quality',
    icon: Sparkles,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Best quality for complex tasks'
  }
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'text-emerald-600 dark:text-emerald-400',
  anthropic: 'text-orange-600 dark:text-orange-400',
  google: 'text-blue-600 dark:text-blue-400',
  xai: 'text-gray-600 dark:text-gray-400',
  moonshot: 'text-indigo-600 dark:text-indigo-400'
};

function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    moonshot: 'Moonshot'
  };
  return names[provider.toLowerCase()] || provider;
}

function getModelDisplayName(model: string): string {
  // OpenAI — real models (ModelFarm-compatible first)
  if (model === 'gpt-4o-mini') return 'GPT-4o Mini';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model.includes('o4-mini')) return 'o4-mini';
  if (model.includes('o3-mini')) return 'o3-mini';
  if (model.includes('o3')) return 'o3';
  if (model.includes('o1-mini')) return 'o1-mini';
  if (model.includes('o1')) return 'o1';
  if (model.includes('gpt-4.1-nano')) return 'GPT-4.1 Nano';
  if (model.includes('gpt-4.1-mini')) return 'GPT-4.1 Mini';
  if (model.includes('gpt-4.1')) return 'GPT-4.1';
  if (model.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
  if (model.includes('gpt-4.1')) return 'GPT-4.1';
  if (model.includes('gpt-4.1-nano')) return 'GPT-4.1 Nano';
  if (model.includes('gpt-4.1-mini')) return 'GPT-4.1 Mini';
  if (model.includes('gpt-4.1')) return 'GPT-4.1';
  // Anthropic — real models
  if (model.includes('claude-opus-4')) return 'Claude Opus 4';
  if (model.includes('claude-sonnet-4')) return 'Claude Sonnet 4';
  if (model.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
  if (model.includes('claude-opus')) return 'Claude Opus';
  if (model.includes('claude-sonnet')) return 'Claude Sonnet';
  if (model.includes('claude-haiku')) return 'Claude Haiku';
  // Google Gemini — real models
  if (model.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
  if (model.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (model.includes('gemini-2.0-flash-lite')) return 'Gemini 2.0 Flash Lite';
  if (model.includes('gemini-2.0-flash')) return 'Gemini 2.0 Flash';
  if (model.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
  if (model.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
  // xAI Grok — real models
  if (model.includes('grok-3-fast')) return 'Grok 3 Fast';
  if (model.includes('grok-3-mini')) return 'Grok 3 Mini';
  if (model.includes('grok-3')) return 'Grok 3';
  // Moonshot AI — real models
  if (model.includes('moonshot-v1-128k')) return 'Kimi 128K';
  if (model.includes('moonshot-v1-32k')) return 'Kimi 32K';
  if (model.includes('moonshot-v1-8k')) return 'Kimi 8K';
  if (model.includes('kimi-k2')) return 'Kimi K2';
  return model;
}

export function AIModelIndicator({
  delegation,
  showDetails = true,
  size = 'md',
  className
}: AIModelIndicatorProps) {
  const tierConfig = TIER_CONFIG[delegation.tier] || TIER_CONFIG.balanced;
  const TierIcon = tierConfig.icon;
  const providerColor = PROVIDER_COLORS[delegation.provider.toLowerCase()] || 'text-gray-600';
  
  const sizeClasses = {
    sm: 'text-[11px]',
    md: 'text-[13px]',
    lg: 'text-base'
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(tierConfig.bgColor, tierConfig.color, "gap-1", sizeClasses[size], className)}
              data-testid="badge-model-tier"
            >
              <TierIcon className={iconSizes[size]} />
              {tierConfig.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{getModelDisplayName(delegation.model)}</p>
            <p className="text-[11px] text-muted-foreground">{tierConfig.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
            "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring",
            tierConfig.bgColor,
            "border-transparent",
            sizeClasses[size],
            className
          )}
          data-testid="button-model-indicator"
        >
          <TierIcon className={cn(iconSizes[size], tierConfig.color)} />
          <span className={cn("font-medium", tierConfig.color)}>
            {tierConfig.label}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={providerColor}>
            {getModelDisplayName(delegation.model)}
          </span>
          <ChevronDown className={cn(iconSizes[size], "text-muted-foreground ml-1")} />
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72" data-testid="menu-model-details">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          AI Model Details
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Tier</span>
            <Badge variant="outline" className={cn(tierConfig.bgColor, tierConfig.color, "gap-1")}>
              <TierIcon className="h-3 w-3" />
              {tierConfig.label}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Provider</span>
            <span className={cn("text-[13px] font-medium", providerColor)}>
              {getProviderDisplayName(delegation.provider)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Model</span>
            <span className="text-[13px] font-medium">
              {getModelDisplayName(delegation.model)}
            </span>
          </div>
          
          {delegation.taskComplexity !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Task Complexity</span>
              <span className="text-[13px] font-medium">{delegation.taskComplexity}/10</span>
            </div>
          )}
          
          {delegation.estimatedTokens !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Est. Tokens</span>
              <span className="text-[13px] font-medium">{delegation.estimatedTokens.toLocaleString()}</span>
            </div>
          )}
          
          {delegation.reason && (
            <>
              <DropdownMenuSeparator />
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Delegation Reason
                </div>
                <p className="text-[11px] text-foreground">
                  {delegation.reason}
                </p>
              </div>
            </>
          )}
        </div>
        
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <p className="text-[11px] text-muted-foreground">
            {tierConfig.description}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AIModelBadge({ 
  tier, 
  model,
  className 
}: { 
  tier: ModelTier; 
  model: string;
  className?: string;
}) {
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.balanced;
  const TierIcon = tierConfig.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(tierConfig.bgColor, tierConfig.color, "gap-1 text-[11px]", className)}
      data-testid="badge-model-mini"
    >
      <TierIcon className="h-3 w-3" />
      {getModelDisplayName(model)}
    </Badge>
  );
}
