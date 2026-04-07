import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Brain, Lightbulb, Sparkles, Zap, Cpu, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrentModelChipProps {
  modelName?: string;
  provider?: string;
  supportsExtendedThinking?: boolean;
  extendedThinkingEnabled?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

const getProviderIcon = (provider: string) => {
  const icons: Record<string, React.ElementType> = {
    openai: Brain,
    anthropic: Lightbulb,
    gemini: Sparkles,
    xai: Zap,
    groq: Zap,
    default: Cpu
  };
  return icons[provider] || icons.default;
};

const getProviderColor = (provider: string) => {
  const colors: Record<string, string> = {
    openai: 'text-green-500',
    anthropic: 'text-orange-500',
    gemini: 'text-blue-500',
    google: 'text-blue-500',
    xai: 'text-purple-500',
    groq: 'text-indigo-500',
    moonshot: 'text-cyan-500',
    default: 'text-gray-500'
  };
  return colors[provider] || colors.default;
};

export function CurrentModelChip({
  modelName,
  provider,
  supportsExtendedThinking,
  extendedThinkingEnabled,
  onClick,
  className,
  compact = false
}: CurrentModelChipProps) {
  const ProviderIcon = provider ? getProviderIcon(provider) : Cpu;
  const providerColor = provider ? getProviderColor(provider) : 'text-gray-500';
  
  // Show warning if extended thinking is enabled but model doesn't support it
  const showWarning = extendedThinkingEnabled && !supportsExtendedThinking;
  
  // Shorten model name for display (e.g., "gpt-4.1.2" → "GPT-4.1.2")
  const shortModelName = modelName 
    ? modelName.split('-').slice(0, 2).join('-').toUpperCase()
    : 'Select Model';

  const tooltipContent = showWarning
    ? `${modelName || 'Current model'} doesn't support Extended Thinking. Please select a compatible model or disable Extended Thinking.`
    : `Current AI Model: ${modelName || 'None selected'}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] cursor-pointer hover:bg-accent transition-colors",
              compact && "px-1.5",
              className
            )}
            onClick={onClick}
            data-testid="current-model-chip"
          >
            <ProviderIcon className={cn("h-3 w-3 pointer-events-none", !compact && "mr-1", providerColor)} />
            {!compact && <span className="max-w-20 truncate">{shortModelName}</span>}
            {showWarning && (
              <AlertCircle className="h-3 w-3 ml-1 text-yellow-500" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-[11px]">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
