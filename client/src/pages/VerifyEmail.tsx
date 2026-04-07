import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { ECodeLogo } from '@/components/ECodeLogo';

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token was provided.');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const result = await apiRequest<{ message: string }>('POST', '/api/verify-email', { token });
        if (!cancelled) {
          setStatus('success');
          setMessage(result.message || 'Email verified successfully!');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          const msg = err?.message || 'Verification failed.';
          if (msg.includes('expired') || msg.includes('TOKEN_EXPIRED')) {
            setMessage('This verification link has expired. Please request a new one from your account settings.');
          } else if (msg.includes('Invalid') || msg.includes('INVALID_TOKEN')) {
            setMessage('This verification link is invalid. It may have already been used.');
          } else {
            setMessage(msg);
          }
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gray-50/50 to-background dark:from-background dark:via-gray-900/50 dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ECodeLogo className="h-8 w-auto" />
        </div>

        <Card className="border border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && 'Verifying your email...'}
              {status === 'success' && 'Email verified!'}
              {status === 'error' && 'Verification failed'}
            </CardTitle>
            <CardDescription>
              {status === 'loading' && 'Please wait while we verify your email address.'}
              {status === 'success' && 'Your email address has been confirmed.'}
              {status === 'error' && 'We could not verify your email address.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="flex flex-col items-center gap-4 py-4">
              {status === 'loading' && (
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              )}
              {status === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="text-sm text-muted-foreground text-center">{message}</p>
                  <Button className="mt-2" onClick={() => navigate('/')}>
                    Continue to E-Code
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
              {status === 'error' && (
                <>
                  <XCircle className="h-12 w-12 text-destructive" />
                  <p className="text-sm text-muted-foreground text-center">{message}</p>
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <Link href="/login">
                      <Button className="w-full">Go to login</Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
