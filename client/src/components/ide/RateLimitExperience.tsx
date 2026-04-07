import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Zap, Clock, ArrowRight, X } from 'lucide-react';
import { Link } from 'wouter';

export interface RateLimitInfo {
  tier: string;
  limit: number;
  retryAfter: number;
  message: string;
  upgradeUrl: string;
}

interface RateLimitContextType {
  rateLimitInfo: RateLimitInfo | null;
  showRateLimitModal: boolean;
  dismissModal: () => void;
  setRateLimitEvent: (info: RateLimitInfo) => void;
}

const RateLimitContext = createContext<RateLimitContextType | null>(null);

let pendingRateLimitEvent: RateLimitInfo | null = null;
const rateLimitListeners: Set<(info: RateLimitInfo) => void> = new Set();

export function subscribeToRateLimits(callback: (info: RateLimitInfo) => void): () => void {
  rateLimitListeners.add(callback);
  if (pendingRateLimitEvent) {
    callback(pendingRateLimitEvent);
    pendingRateLimitEvent = null;
  }
  return () => rateLimitListeners.delete(callback);
}

export function emitRateLimitEvent(info: RateLimitInfo) {
  if (rateLimitListeners.size === 0) {
    pendingRateLimitEvent = info;
  } else {
    rateLimitListeners.forEach(listener => listener(info));
  }
  const event = new CustomEvent('rateLimit', { detail: info });
  window.dispatchEvent(event);
}

export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within RateLimitProvider');
  }
  return context;
}

const tierConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  free: { color: 'text-gray-600', label: 'Free Plan', bgColor: 'bg-gray-100' },
  starter: { color: 'text-blue-600', label: 'Starter', bgColor: 'bg-blue-100' },
  pro: { color: 'text-purple-600', label: 'Pro', bgColor: 'bg-purple-100' },
  teams: { color: 'text-orange-600', label: 'Teams', bgColor: 'bg-orange-100' },
  enterprise: { color: 'text-emerald-600', label: 'Enterprise', bgColor: 'bg-emerald-100' },
};

export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const dismissedUntilRef = useRef<number>(0);

  const setRateLimitEvent = useCallback((info: RateLimitInfo) => {
    const now = Date.now();
    if (dismissedUntilRef.current > now) {
      return;
    }
    
    setRateLimitInfo(info);
    setCountdown(info.retryAfter);
    setShowRateLimitModal(true);
  }, []);

  const dismissModal = useCallback(() => {
    setShowRateLimitModal(false);
    dismissedUntilRef.current = Date.now() + (rateLimitInfo?.retryAfter || 5) * 1000;
  }, [rateLimitInfo]);

  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShowRateLimitModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const unsubscribe = subscribeToRateLimits(setRateLimitEvent);
    return unsubscribe;
  }, [setRateLimitEvent]);

  return (
    <RateLimitContext.Provider value={{ rateLimitInfo, showRateLimitModal, dismissModal, setRateLimitEvent }}>
      {children}
      <RateLimitModal 
        info={rateLimitInfo} 
        isOpen={showRateLimitModal} 
        countdown={countdown}
        onDismiss={dismissModal}
      />
    </RateLimitContext.Provider>
  );
}

interface RateLimitModalProps {
  info: RateLimitInfo | null;
  isOpen: boolean;
  countdown: number;
  onDismiss: () => void;
}

function RateLimitModal({ info, isOpen, countdown, onDismiss }: RateLimitModalProps) {
  if (!info) return null;

  const tier = tierConfig[info.tier] || tierConfig.free;
  const progressPercent = info.retryAfter > 0 ? ((info.retryAfter - countdown) / info.retryAfter) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent 
        className="sm:max-w-md border-0 shadow-2xl"
        data-testid="rate-limit-modal"
      >
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          data-testid="rate-limit-dismiss"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Clock className="h-7 w-7 text-orange-600 dark:text-orange-400" />
          </div>
          <DialogTitle className="text-xl font-semibold" data-testid="rate-limit-title">
            Request Limit Reached
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            You've reached your {tier.label} rate limit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`${tier.bgColor} ${tier.color}`}>
                {tier.label}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                {info.limit} requests/min
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>Limit reached</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Ready in</span>
              <span className="font-medium" data-testid="rate-limit-countdown">
                {countdown}s
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <p className="text-[13px] text-center text-muted-foreground px-4">
            Your code is safe and you can continue viewing. 
            Requests will resume automatically when the timer completes.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Link href={info.upgradeUrl} asChild>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              data-testid="rate-limit-upgrade-button"
            >
              <Zap className="h-4 w-4" />
              Upgrade for Higher Limits
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            onClick={onDismiss}
            className="w-full text-muted-foreground"
            data-testid="rate-limit-continue-button"
          >
            Continue with {tier.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RateLimitBanner() {
  const { rateLimitInfo, showRateLimitModal, dismissModal } = useRateLimit();
  const [countdown, setCountdown] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (rateLimitInfo && showRateLimitModal) {
      setCountdown(rateLimitInfo.retryAfter);
      setVisible(true);
    }
  }, [rateLimitInfo, showRateLimitModal]);

  useEffect(() => {
    if (countdown <= 0) {
      setVisible(false);
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  if (!visible || !rateLimitInfo) return null;

  const tier = tierConfig[rateLimitInfo.tier] || tierConfig.free;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-orange-50 dark:bg-orange-950/50 border-b border-orange-200 dark:border-orange-800 px-4 py-2"
      data-testid="rate-limit-banner"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-orange-600" />
          <span className="text-[13px] text-orange-800 dark:text-orange-200">
            Rate limit reached ({tier.label}). Ready in <strong>{countdown}s</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={rateLimitInfo.upgradeUrl}>
            <Button size="sm" variant="outline" className="text-[11px] h-7 border-orange-300 text-orange-700 hover:bg-orange-100">
              <Zap className="h-3 w-3 mr-1" />
              Upgrade
            </Button>
          </Link>
          <button 
            onClick={dismissModal}
            className="text-orange-600 hover:text-orange-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
