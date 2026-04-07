import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { ECodeLogo } from '@/components/ECodeLogo';

export default function ResetPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Invalid link',
        description: 'This reset link is invalid or has expired. Please request a new one.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please make sure both passwords are identical.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to reset password.';
      const isExpired = msg.includes('expired') || msg.includes('TOKEN_EXPIRED');
      const isUsed = msg.includes('already been used') || msg.includes('TOKEN_USED');
      toast({
        title: isExpired ? 'Link expired' : isUsed ? 'Link already used' : 'Reset failed',
        description: isExpired
          ? 'This reset link has expired. Please request a new one.'
          : isUsed
          ? 'This reset link has already been used. Please request a new one.'
          : msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-gray-50/50 to-background dark:from-background dark:via-gray-900/50 dark:to-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <ECodeLogo className="h-8 w-auto" />
          </div>
          <Card className="border border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">Invalid reset link</CardTitle>
              <CardDescription>This password reset link is missing a token and cannot be used.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-3">
              <Link href="/forgot-password">
                <Button className="w-full">Request a new reset link</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gray-50/50 to-background dark:from-background dark:via-gray-900/50 dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ECodeLogo className="h-8 w-auto" />
        </div>

        <Card className="border border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {success ? 'Password reset!' : 'Set new password'}
            </CardTitle>
            <CardDescription>
              {success
                ? 'Your password has been updated. Redirecting you to login…'
                : 'Choose a strong password with at least 8 characters.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {success ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <Link href="/login">
                  <Button className="mt-2">Go to login now</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={8}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting password…
                    </>
                  ) : (
                    'Set new password'
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                    Request a new reset link
                  </Link>
                </div>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Back to login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
