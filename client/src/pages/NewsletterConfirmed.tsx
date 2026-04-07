import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Confetti } from '../components/ui/confetti';

export default function NewsletterConfirmed() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get('success') === 'true';

  useEffect(() => {
    // Show confetti animation on success
    if (success) {
      const timer = setTimeout(() => {
        Confetti();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (!success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid Confirmation Link</CardTitle>
            <CardDescription>
              This confirmation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              If you're having trouble, please try subscribing again or contact our support team.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setLocation('/')} className="w-full">
                Go to Homepage
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/support')}
                className="w-full"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      
      <Card className="max-w-md w-full relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary animate-in zoom-in-50 duration-500" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              You're All Set!
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Your email has been confirmed successfully
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Welcome to E-Code Newsletter!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll receive our updates packed with:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Latest features and platform updates</li>
                  <li>Tips and tutorials from our community</li>
                  <li>Exclusive offers and early access</li>
                  <li>Inspiring creator stories</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Ready to start creating amazing things?
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/projects">
                <Button className="w-full group">
                  Start Creating
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            You can unsubscribe at any time from any newsletter email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}