import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ECodeLogo } from '@/components/ECodeLogo';

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Error', description: 'Please enter your email address.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/forgot-password', { email });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gray-50/50 to-background dark:from-background dark:via-gray-900/50 dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ECodeLogo className="h-8 w-auto" />
        </div>

        <Card className="border border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {submitted ? 'Check your email' : 'Reset your password'}
            </CardTitle>
            <CardDescription>
              {submitted
                ? 'If an account exists with that email, you will receive a reset link shortly.'
                : 'Enter your email and we will send you a link to reset your password.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground text-center">
                  Check your inbox (and spam folder) for a reset link. It expires in 2 hours.
                </p>
                <Button variant="outline" className="w-full mt-2" onClick={() => setSubmitted(false)}>
                  Try a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3 w-3" />
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
