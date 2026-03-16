import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Check, AlertCircle } from "lucide-react";

export default function AcceptInvite() {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [inviteInfo, setInviteInfo] = useState<{ projectId: string; projectName: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.token) return;
    fetch(`/api/invite/${params.token}`)
      .then(res => {
        if (!res.ok) throw new Error("Invalid or expired invite link");
        return res.json();
      })
      .then(data => {
        setInviteInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Failed to load invite");
        setLoading(false);
      });
  }, [params.token]);

  const handleAccept = async () => {
    if (!params.token) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/invite/${params.token}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to accept invite");
      }
      const data = await res.json();
      setLocation(`/project/${data.projectId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setAccepting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0079F2]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-2">Invalid Invite</h2>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-4">{error}</p>
          <Button onClick={() => setLocation("/dashboard")} className="bg-[#0079F2] hover:bg-[#0068D6] text-white" data-testid="button-go-dashboard">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0079F2]/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-[#0079F2]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-2">Join Project</h2>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-1">You've been invited to collaborate on</p>
          <p className="text-base font-medium text-[var(--ide-text)] mb-4">{inviteInfo?.projectName || "a project"}</p>
          <p className="text-xs text-[var(--ide-text-muted)] mb-4">Sign in or create an account to accept this invitation</p>
          <Button onClick={() => setLocation(`/login?redirect=/invite/${params.token}`)} className="bg-[#0079F2] hover:bg-[#0068D6] text-white w-full" data-testid="button-login-to-accept">
            Sign In to Join
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0079F2]/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-[#0079F2]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-2">Join Project</h2>
        <p className="text-sm text-[var(--ide-text-secondary)] mb-1">You've been invited to collaborate on</p>
        <p className="text-base font-medium text-[var(--ide-text)] mb-1">{inviteInfo?.projectName || "a project"}</p>
        <p className="text-xs text-[var(--ide-text-muted)] mb-6">Role: {inviteInfo?.role || "editor"}</p>
        <Button onClick={handleAccept} disabled={accepting} className="bg-[#0CCE6B] hover:bg-[#0AB85E] text-black w-full font-medium" data-testid="button-accept-invite">
          {accepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          Accept Invitation
        </Button>
      </div>
    </div>
  );
}
