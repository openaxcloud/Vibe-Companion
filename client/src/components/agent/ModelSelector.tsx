import { Check, ChevronsUpDown, Sparkles, Zap, Brain, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type ModelCategory = 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot';

interface Model {
  id: string;
  name: string;
  description: string;
  category: ModelCategory;
  tier: 'standard' | 'high-power';
  capabilities: {
    extendedThinking: boolean;
    codeGeneration: boolean;
    maxTokens: number;
    speed: 'fast' | 'medium' | 'slow';
    cost: 'low' | 'medium' | 'high';
  };
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

const PROVIDER_CONFIG: Record<ModelCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
}> = {
  openai:    { label: 'OpenAI',       icon: Sparkles, color: 'text-green-500'  },
  anthropic: { label: 'Anthropic',    icon: Brain,    color: 'text-orange-500' },
  google:    { label: 'Google Gemini',icon: Zap,      color: 'text-blue-500'   },
  xai:       { label: 'xAI / Grok',  icon: Cpu,      color: 'text-purple-500' },
  moonshot:  { label: 'Moonshot / Kimi', icon: Zap,  color: 'text-cyan-500'   },
};

const PROVIDER_ORDER: ModelCategory[] = ['openai', 'anthropic', 'google', 'xai', 'moonshot'];

export function ModelSelector({ selectedModel, onModelChange, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['/api/agent/models'],
  });

  const models: Model[] = modelsData?.models || [];
  const selected = models.find(m => m.id === selectedModel);

  const selectedConfig = selected ? PROVIDER_CONFIG[selected.category] : null;
  const SelectedIcon = selectedConfig?.icon || Cpu;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between w-full sm:w-[280px]", className)}
          data-testid="button-select-model"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {selected && selectedConfig && (
              <span className={selectedConfig.color}>
                <SelectedIcon className="h-4 w-4" />
              </span>
            )}
            <span className="truncate">
              {selected ? selected.name : 'Select model...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[90vw] sm:w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." data-testid="input-search-models" />
          <CommandEmpty>No models found.</CommandEmpty>

          {PROVIDER_ORDER.map(category => {
            const categoryModels = models.filter(m => m.category === category);
            if (categoryModels.length === 0) return null;

            const config = PROVIDER_CONFIG[category];
            const CategoryIcon = config.icon;

            return (
              <CommandGroup key={category} heading={config.label}>
                {categoryModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 p-3"
                    data-testid={`model-option-${model.id}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4',
                            selectedModel === model.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <CategoryIcon className={cn("h-4 w-4", config.color)} />
                        <span className="font-medium text-[13px]">{model.name}</span>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        {model.capabilities.extendedThinking && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Brain className="h-3 w-3 mr-0.5" />
                            Thinking
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            model.capabilities.speed === 'fast' && "border-green-500 text-green-500",
                            model.capabilities.speed === 'medium' && "border-yellow-500 text-yellow-500",
                            model.capabilities.speed === 'slow' && "border-red-500 text-red-500"
                          )}
                        >
                          {model.capabilities.speed}
                        </Badge>
                        {model.tier === 'high-power' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            Pro
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground ml-6 leading-tight">
                      {model.description}
                    </p>
                    <div className="flex gap-2 ml-6 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{model.capabilities.maxTokens.toLocaleString()} tokens</span>
                      <span>•</span>
                      <span>Cost: {model.capabilities.cost}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
