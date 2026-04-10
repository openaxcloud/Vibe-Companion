import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Mail, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await apiRequest("POST", "/api/resend-verification");
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and spam folder.",
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to resend verification email.";
      const isRateLimited = msg.includes("RATE_LIMITED") || msg.includes("Too many");
      toast({
        title: isRateLimited ? "Please wait" : "Failed to send",
        description: isRateLimited
          ? "You've requested too many verification emails. Please try again later."
          : msg,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5">
      <div className="flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Please verify your email address (<strong>{user.email}</strong>) to access all features.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 h-7 px-3 text-xs border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200"
          onClick={handleResend}
          disabled={sending}
        >
          {sending ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="h-3 w-3 mr-1" />
              Resend email
            </>
          )}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
