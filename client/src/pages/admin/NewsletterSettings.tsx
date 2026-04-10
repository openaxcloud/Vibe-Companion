import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle, XCircle, AlertCircle, Send, Settings2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ECodeLoading } from '@/components/ECodeLoading';

export default function NewsletterSettings() {
  const { toast } = useToast();
  const [gandiStatus, setGandiStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkGandiStatus();
  }, []);

  const checkGandiStatus = async () => {
    try {
      const data = await apiRequest('GET', '/api/newsletter/test-gandi');
      setGandiStatus(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check Gandi email status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testEmailSending = async () => {
    setTesting(true);
    try {
      await apiRequest('POST', '/api/newsletter/test-send', { email: 'test@example.com' });
      toast({
        title: "Test Sent",
        description: "Check console logs for email output",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test email",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <ECodeLoading size="md" text="Loading..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Newsletter Email Configuration
          </CardTitle>
          <CardDescription>
            Manage email service integration for newsletter functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gandi Email Status */}
          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              Gandi Email Service
              {gandiStatus?.connected ? (
                <Badge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Configured
                </Badge>
              )}
            </h3>

            {gandiStatus && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <span className="font-medium">SMTP Host:</span>
                    <span className="ml-2 text-muted-foreground">{gandiStatus.config.host}</span>
                  </div>
                  <div>
                    <span className="font-medium">SMTP Port:</span>
                    <span className="ml-2 text-muted-foreground">{gandiStatus.config.port}</span>
                  </div>
                  <div>
                    <span className="font-medium">User Configured:</span>
                    <span className="ml-2">
                      {gandiStatus.config.userConfigured ? (
                        <Badge variant="outline" className="text-green-600">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600">No</Badge>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Password Configured:</span>
                    <span className="ml-2">
                      {gandiStatus.config.passConfigured ? (
                        <Badge variant="outline" className="text-green-600">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600">No</Badge>
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-[13px] text-muted-foreground mt-2">
                  {gandiStatus.message}
                </p>
              </div>
            )}

            {!gandiStatus?.connected && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  To enable email sending via Gandi, set these environment variables:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><code className="text-[11px] bg-muted px-1 py-0.5 rounded">GANDI_SMTP_USER</code> or <code className="text-[11px] bg-muted px-1 py-0.5 rounded">GANDI_EMAIL</code></li>
                    <li><code className="text-[11px] bg-muted px-1 py-0.5 rounded">GANDI_SMTP_PASS</code> or <code className="text-[11px] bg-muted px-1 py-0.5 rounded">GANDI_PASSWORD</code></li>
                    <li><code className="text-[11px] bg-muted px-1 py-0.5 rounded">FROM_EMAIL</code> (optional, defaults to noreply@e-code.ai)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Email Features */}
          <div className="space-y-4">
            <h3 className="text-[15px] font-semibold">Email Features</h3>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Enhanced Email Validation</p>
                    <p className="text-[13px] text-muted-foreground">E-Code design standards with typo suggestions</p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Send className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Welcome Email with Confirmation</p>
                    <p className="text-[13px] text-muted-foreground">Sent when users subscribe to newsletter</p>
                  </div>
                </div>
                <Badge variant={gandiStatus?.connected ? "success" : "secondary"}>
                  {gandiStatus?.connected ? "Active" : "Console Only"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Confirmation Success Email</p>
                    <p className="text-[13px] text-muted-foreground">Sent after email verification</p>
                  </div>
                </div>
                <Badge variant={gandiStatus?.connected ? "success" : "secondary"}>
                  {gandiStatus?.connected ? "Active" : "Console Only"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Test Actions */}
          <div className="flex gap-3">
            <Button onClick={checkGandiStatus} variant="outline">
              Refresh Status
            </Button>
            <Button onClick={testEmailSending} disabled={testing}>
              {testing ? "Testing..." : "Send Test Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          When Gandi is not configured, emails are logged to the console for development. 
          Newsletter subscriptions are still stored in the database and can be exported.
        </AlertDescription>
      </Alert>
    </div>
  );
}