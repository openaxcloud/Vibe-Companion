import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Users, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type InviteStatus = 'loading' | 'valid' | 'accepted' | 'expired' | 'error';

export default function AcceptInvite() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteInfo, setInviteInfo] = useState<{
    teamName?: string;
    inviterName?: string;
    email?: string;
    role?: string;
  }>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No invitation token provided.');
      return;
    }

    fetch(`/api/teams/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 410 || res.status === 404) {
            setStatus('expired');
            return;
          }
          throw new Error(data.error || 'Failed to validate invitation');
        }
        const data = await res.json();
        setInviteInfo({
          teamName: data.teamName || 'a team',
          inviterName: data.inviterName || 'A team member',
          email: data.email,
          role: data.role || 'member',
        });
        setStatus('valid');
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Could not validate this invitation.');
      });
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      sessionStorage.setItem('pendingInvite', token || '');
      setLocation(`/login?redirect=/invite/${token}`);
      return;
    }

    setStatus('loading');
    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const res = await fetch(`/api/teams/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setStatus('accepted');
      setTimeout(() => setLocation('/teams'), 2000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Could not accept invitation.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-acceptinvite">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Users className="h-6 w-6 text-violet-600" />
          </div>
          <CardTitle data-testid="text-invite-title">Team Invitation</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Validating your invitation...'}
            {status === 'valid' && `You've been invited to join ${inviteInfo.teamName}`}
            {status === 'accepted' && 'Welcome to the team!'}
            {status === 'expired' && 'This invitation has expired'}
            {status === 'error' && 'Something went wrong'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === 'valid' && (
            <>
              <div className="rounded-lg border p-4 space-y-2">
                {inviteInfo.inviterName && (
                  <p className="text-sm text-muted-foreground">
                    <strong>{inviteInfo.inviterName}</strong> invited you to join
                  </p>
                )}
                <p className="text-lg font-semibold">{inviteInfo.teamName}</p>
                {inviteInfo.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {inviteInfo.email}
                  </div>
                )}
                {inviteInfo.role && (
                  <p className="text-sm text-muted-foreground">
                    Role: <span className="capitalize font-medium">{inviteInfo.role}</span>
                  </p>
                )}
              </div>

              {!user && (
                <Alert>
                  <AlertDescription>
                    You need to sign in or create an account to accept this invitation.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                data-testid="button-accept-invite"
              >
                {user ? 'Accept Invitation' : 'Sign In to Accept'}
              </Button>
            </>
          )}

          {status === 'accepted' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-muted-foreground">
                You've successfully joined <strong>{inviteInfo.teamName}</strong>. Redirecting to your teams...
              </p>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-orange-500" />
              <p className="text-center text-muted-foreground">
                This invitation link has expired or has already been used. Please ask the team admin to send a new invitation.
              </p>
              <Button variant="outline" onClick={() => setLocation('/')} data-testid="button-go-home">
                Go to Homepage
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-center text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" onClick={() => setLocation('/')} data-testid="button-go-home">
                Go to Homepage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
