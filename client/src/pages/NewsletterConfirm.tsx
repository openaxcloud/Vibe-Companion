import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function NewsletterConfirm() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmSubscription = async () => {
      const params = new URLSearchParams(window.location.search);
      const email = params.get('email');
      const token = params.get('token');

      if (!email || !token) {
        setStatus('error');
        setMessage('Invalid confirmation link');
        return;
      }

      try {
        const response = await fetch(`/api/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&format=json`, {
          headers: {
            Accept: 'application/json',
          },
        });

        let data: any = null;
        try {
          data = await response.json();
        } catch (_) {
          data = null;
        }

        if (response.ok && data?.success) {
          setStatus('success');
          setMessage(data.message || 'Email confirmed successfully!');
        } else {
          const errorMessage = data?.message || 'Failed to confirm email';
          setStatus('error');
          setMessage(errorMessage);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    setStatus('loading');
    setMessage('');
    confirmSubscription();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              {status === 'loading' && (
                <>
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Confirming your email...</h2>
                  <p className="text-muted-foreground">Please wait while we verify your subscription.</p>
                </>
              )}

              {status === 'success' && (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <h2 className="text-2xl font-bold mb-2" data-testid="text-success-title">Success!</h2>
                  <p className="text-muted-foreground mb-6" data-testid="text-success-message">{message}</p>
                  <p className="text-[13px] text-muted-foreground mb-6">
                    You'll now receive our newsletter with the latest updates, tutorials, and community stories.
                  </p>
                  <Button onClick={() => navigate('/')} className="w-full" data-testid="button-go-home-success">
                    Go to Homepage
                  </Button>
                </>
              )}

              {status === 'error' && (
                <>
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
                  <h2 className="text-2xl font-bold mb-2" data-testid="text-error-title">Oops!</h2>
                  <p className="text-muted-foreground mb-6" data-testid="text-error-message">{message}</p>
                  <Button onClick={() => navigate('/')} variant="outline" className="w-full" data-testid="button-go-home-error">
                    Back to Homepage
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}