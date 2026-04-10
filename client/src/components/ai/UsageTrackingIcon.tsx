import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Coins,
  TrendingUp,
  CreditCard,
  ExternalLink,
  Clock,
  Zap,
  Brain,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface UsageData {
  credits: {
    remaining: number;
    used: number;
    total: number;
    percentUsed: number;
  };
  currentPeriod: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  breakdown: {
    agentMessages: number;
    thinkingTokens: number;
    highPowerUsage: number;
    webSearches: number;
  };
  tier: 'free' | 'pro' | 'enterprise';
}

interface UsageTrackingIconProps {
  className?: string;
  variant?: 'icon' | 'badge' | 'detailed';
}

export function UsageTrackingIcon({ 
  className,
  variant = 'icon' 
}: UsageTrackingIconProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: usage, isLoading } = useQuery<UsageData>({
    queryKey: ['/api/usage/current'],
    refetchInterval: 60000,
  });

  const defaultUsage: UsageData = {
    credits: {
      remaining: 1000,
      used: 0,
      total: 1000,
      percentUsed: 0,
    },
    currentPeriod: {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 30,
    },
    breakdown: {
      agentMessages: 0,
      thinkingTokens: 0,
      highPowerUsage: 0,
      webSearches: 0,
    },
    tier: 'free',
  };

  const currentUsage = (usage?.credits ? usage : null) || defaultUsage;
  const isLowCredits = currentUsage.credits.percentUsed > 80;
  const isCriticalCredits = currentUsage.credits.percentUsed > 95;

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge className="bg-purple-600 text-white text-[10px]">Enterprise</Badge>;
      case 'pro':
        return <Badge className="bg-blue-600 text-white text-[10px]">Pro</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Free</Badge>;
    }
  };

  if (variant === 'badge') {
    return (
      <Badge 
        variant={isCriticalCredits ? "destructive" : isLowCredits ? "secondary" : "outline"}
        className={cn("gap-1 cursor-pointer", className)}
        onClick={() => setIsOpen(true)}
        data-testid="usage-badge"
      >
        <Coins className="h-3 w-3" />
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span>{currentUsage.credits.remaining.toLocaleString()}</span>
        )}
      </Badge>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-10 min-h-[44px] gap-1.5 px-3",
                  isCriticalCredits && "text-red-500",
                  isLowCredits && !isCriticalCredits && "text-amber-500",
                  className
                )}
                data-testid="usage-tracking-icon"
              >
                <Coins className={cn(
                  "h-4 w-4",
                  isCriticalCredits ? "text-red-500" : "text-amber-500"
                )} />
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="text-[11px] font-medium">
                    {currentUsage.credits.remaining.toLocaleString()}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Credits remaining</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-80 p-0" data-testid="usage-popover">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium">Usage & Credits</p>
                <p className="text-[11px] text-muted-foreground">
                  {currentUsage.currentPeriod.daysRemaining} days remaining
                </p>
              </div>
            </div>
            {getTierBadge(currentUsage.tier)}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Credits used</span>
              <span className="font-medium">
                {currentUsage.credits.used.toLocaleString()} / {currentUsage.credits.total.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={currentUsage.credits.percentUsed} 
              className={cn(
                "h-2",
                isCriticalCredits && "[&>div]:bg-red-500",
                isLowCredits && !isCriticalCredits && "[&>div]:bg-amber-500"
              )}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {currentUsage.credits.remaining.toLocaleString()} credits remaining
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Breakdown
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-[11px]">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium">{currentUsage.breakdown.agentMessages}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <Brain className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-muted-foreground">Thinking:</span>
                <span className="font-medium">{currentUsage.breakdown.thinkingTokens}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <Zap className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-muted-foreground">High Power:</span>
                <span className="font-medium">{currentUsage.breakdown.highPowerUsage}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-muted-foreground">Searches:</span>
                <span className="font-medium">{currentUsage.breakdown.webSearches}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Link href="/billing" className="flex-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-1.5 text-[11px]"
                data-testid="view-billing-btn"
              >
                <CreditCard className="h-3.5 w-3.5" />
                View Billing
              </Button>
            </Link>
            {currentUsage.tier !== 'enterprise' && (
              <Link href="/pricing" className="flex-1">
                <Button 
                  size="sm" 
                  className="w-full gap-1.5 text-[11px]"
                  data-testid="upgrade-btn"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Upgrade
                </Button>
              </Link>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default UsageTrackingIcon;
