import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserX, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function NewsletterUnsubscribe() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill email from URL if available
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  });

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Unsubscribed",
          description: "You've been successfully unsubscribed from our newsletter.",
        });
        setTimeout(() => navigate('/'), 2000);
      } else {
        toast({
          title: "Error",
          description: data.message || 'Failed to unsubscribe',
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-red-100 dark:bg-red-900/20 rounded-full w-fit mb-4">
                <UserX className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Unsubscribe from Newsletter</CardTitle>
              <CardDescription>
                We're sorry to see you go. Enter your email below to unsubscribe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnsubscribe} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  variant="destructive"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Unsubscribe'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Homepage
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Changed your mind? You can always resubscribe from our homepage or blog.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}