import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentFailureBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.subscriptionStatus !== 'past_due' || dismissed) return null;

  return (
    <div className="relative bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 px-4 py-2.5">
      <div className="flex items-center justify-center gap-2 text-sm text-red-800 dark:text-red-200">
        <CreditCard className="h-4 w-4 shrink-0" />
        <span>
          Your last payment failed. Please update your payment method to keep your subscription active.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 h-7 px-3 text-xs border-red-300 dark:border-red-700 bg-white dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-800 dark:text-red-200"
          onClick={() => window.location.href = '/billing'}
        >
          <CreditCard className="h-3 w-3 mr-1" />
          Update payment
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
