import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface UserCredits {
  id: number;
  userId: number;
  monthlyCredits: string;
  remainingCredits: string;
  extraCredits: string;
  resetDate: string;
  updatedAt: string;
}

export function CreditBalance() {
  const { data: credits, isLoading } = useQuery<UserCredits>({
    queryKey: ['/api/user/credits'],
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading || !credits) {
    return null;
  }

  // Parse string values from database
  const monthlyCredits = parseFloat(credits.monthlyCredits);
  const remainingCredits = parseFloat(credits.remainingCredits);
  const extraCredits = parseFloat(credits.extraCredits);
  const totalCredits = monthlyCredits + extraCredits;
  const totalUsed = totalCredits - remainingCredits;
  const percentage = totalCredits > 0 ? (remainingCredits / totalCredits) * 100 : 0;
  const isLow = percentage < 20;
  
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer">
          <Zap className={`w-4 h-4 ${isLow ? 'text-destructive' : 'text-primary'}`} />
          <Badge variant={isLow ? 'destructive' : 'secondary'} className="font-mono">
            {remainingCredits.toFixed(0)} credits
          </Badge>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[13px] font-semibold">AI Credits</h4>
            <Badge variant="outline">Free Plan</Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-[13px]">
              <span>Used</span>
              <span className="font-medium">{totalUsed.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span>Remaining</span>
              <span className="font-medium">{remainingCredits.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span>Total</span>
              <span className="font-medium">{totalCredits.toFixed(2)}</span>
            </div>
          </div>
          
          <Progress value={percentage} className="h-2" />
          
          <p className="text-[11px] text-muted-foreground">
            {percentage < 10 && "⚠️ Credits running low. "}
            Credits reset monthly.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}