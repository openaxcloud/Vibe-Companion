/**
 * BuildModeSelector - E-Code Build Mode Selection Dialog
 * Premium dark theme with E-Code orange branding
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Paintbrush,
  Hammer,
  Clock,
  ChevronRight,
  Code,
  Sparkles,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BuildMode = 'design-first' | 'full-app' | 'continue-planning';

interface BuildModeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: BuildMode) => void;
  featureList?: string[];
  projectName?: string;
}

interface BuildOption {
  id: BuildMode;
  title: string;
  description: string;
  icon: typeof Paintbrush;
  badge?: string;
  timeEstimate: string;
  features: string[];
  color: 'orange' | 'green';
  recommended?: boolean;
}

const buildOptions: BuildOption[] = [
  {
    id: 'design-first',
    title: 'Start with a design',
    description: 'See your app design first, then add functionality',
    icon: Paintbrush,
    badge: 'Visual First',
    timeEstimate: '~3 minutes',
    features: [
      'Quick clickable prototype',
      'See UI before building',
      'Iterate on design',
      'Build functionality later'
    ],
    color: 'orange',
    recommended: false
  },
  {
    id: 'full-app',
    title: 'Build the full app',
    description: 'Complete working application from the start',
    icon: Hammer,
    badge: 'Recommended',
    timeEstimate: '~10 minutes',
    features: [
      'Full-stack development',
      'Working MVP immediately',
      'Backend + Frontend',
      'Database integration'
    ],
    color: 'green',
    recommended: true
  }
];

function AnimatedDot({ color, delay, isActive }: { color: string; delay: number; isActive: boolean }) {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isActive, delay]);
  
  const dotColors: Record<string, string> = {
    orange: 'bg-[var(--ecode-accent)]',
    green: 'bg-emerald-500'
  };
  
  return (
    <span 
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full transition-all duration-300",
        visible ? dotColors[color] || 'bg-[var(--ecode-accent)]' : 'opacity-30 bg-current',
        visible && "animate-pulse"
      )}
    />
  );
}

export function BuildModeSelector({
  open,
  onOpenChange,
  onSelectMode,
  featureList = [],
  projectName
}: BuildModeSelectorProps) {
  const [hoveredOption, setHoveredOption] = useState<BuildMode | null>(null);
  const [activeAnimations, setActiveAnimations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setActiveAnimations({ 'design-first': true, 'full-app': true });
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setActiveAnimations({});
    }
  }, [open]);

  const getColorClasses = (color: string, type: 'bg' | 'border' | 'text' | 'icon') => {
    const colors: Record<string, Record<string, string>> = {
      orange: {
        bg: 'bg-[var(--ecode-accent)]/5',
        border: 'border-[var(--ecode-accent)]/20 hover:border-[var(--ecode-accent)]/50',
        text: 'text-[var(--ecode-accent)]',
        icon: 'bg-[var(--ecode-accent)]/10'
      },
      green: {
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500/20 hover:border-emerald-500/50',
        text: 'text-emerald-500',
        icon: 'bg-emerald-500/10'
      }
    };
    return colors[color]?.[type] || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-[var(--ecode-surface)] border-[var(--ecode-border)]" data-testid="build-mode-selector-dialog">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-[var(--ecode-accent)]/10 to-[var(--ecode-accent)]/5 border-b border-[var(--ecode-border)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[var(--ecode-accent)]/15">
              <Sparkles className="h-5 w-5 text-[var(--ecode-accent)]" />
            </div>
            <DialogTitle className="text-[15px] font-semibold text-[var(--ecode-text)]">
              How do you want to continue?
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] text-[var(--ecode-text-muted)]">
            {projectName && <span className="font-medium text-[var(--ecode-text-secondary)]">{projectName}: </span>}
            Choose your preferred build approach
          </DialogDescription>
          
          {featureList.length > 0 && (
            <div className="mt-4 p-3 bg-[var(--ecode-surface-secondary)] rounded-lg border border-[var(--ecode-border)]">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-[var(--ecode-text-muted)]" />
                <span className="text-[11px] font-medium text-[var(--ecode-text-muted)]">Feature list created</span>
                <Badge className="text-[10px] bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)] border-[var(--ecode-accent)]/20">{featureList.length} features</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {featureList.slice(0, 5).map((feature, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-[var(--ecode-border)] text-[var(--ecode-text-secondary)]">
                    {feature}
                  </Badge>
                ))}
                {featureList.length > 5 && (
                  <Badge variant="outline" className="text-[10px] border-[var(--ecode-border)] text-[var(--ecode-text-muted)]">
                    +{featureList.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {buildOptions.map((option) => {
              const Icon = option.icon;
              const isHovered = hoveredOption === option.id;
              
              return (
                <button
                  key={option.id}
                  onClick={() => onSelectMode(option.id)}
                  onMouseEnter={() => setHoveredOption(option.id)}
                  onMouseLeave={() => setHoveredOption(null)}
                  className={cn(
                    "relative text-left p-4 rounded-xl border-2 transition-all duration-200",
                    "bg-[var(--ecode-surface-secondary)] hover:shadow-lg hover:shadow-[var(--ecode-accent)]/5 hover:scale-[1.02]",
                    getColorClasses(option.color, 'border'),
                    isHovered && "bg-[var(--ecode-surface-hover)]"
                  )}
                  data-testid={`build-option-${option.id}`}
                >
                  {option.recommended && (
                    <div className="absolute -top-2.5 right-4">
                      <Badge className="text-[10px] px-2 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        ✨ {option.badge}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      getColorClasses(option.color, 'icon')
                    )}>
                      <Icon className={cn("h-5 w-5", getColorClasses(option.color, 'text'))} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[13px] text-[var(--ecode-text)]">{option.title}</h3>
                        {!option.recommended && option.badge && (
                          <Badge className="text-[10px] bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)] border-[var(--ecode-accent)]/20">
                            {option.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--ecode-text-muted)] mb-3">
                        {option.description}
                      </p>
                      
                      <div className="flex items-center gap-1 mb-3">
                        <Clock className="h-3 w-3 text-[var(--ecode-text-muted)]" />
                        <span className="text-[11px] text-[var(--ecode-text-muted)]">{option.timeEstimate}</span>
                      </div>
                      
                      <ul className="space-y-1.5">
                        {option.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-[11px] text-[var(--ecode-text-secondary)]">
                            <AnimatedDot 
                              color={option.color} 
                              delay={i * 150} 
                              isActive={activeAnimations[option.id] || false} 
                            />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[var(--ecode-border)]">
            <Button
              variant="ghost"
              onClick={() => onSelectMode('continue-planning')}
              className="w-full justify-start text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]"
              data-testid="button-continue-planning"
            >
              <Code className="h-4 w-4 mr-2" />
              Continue planning - refine feature list first
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BuildModeSelector;
