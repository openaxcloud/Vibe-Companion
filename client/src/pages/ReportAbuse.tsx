import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ReportAbuse() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast({ title: "Report submitted", description: "Thank you. Our team will review this within 24 hours." });
  };

  return (
    <PublicLayout>
      <div className="min-h-screen py-20">
        <div className="container-responsive max-w-2xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 mb-4">
              <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--ecode-text)] dark:text-white mb-4" data-testid="text-report-abuse-title">Report Abuse</h1>
            <p className="text-[var(--ecode-text-secondary)] dark:text-slate-300">
              If you've encountered content or behavior that violates our terms of service, please let us know.
            </p>
          </div>

          {submitted ? (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="p-8 text-center">
                <p className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2" data-testid="text-report-success">Report Received</p>
                <p className="text-[var(--ecode-text-secondary)] dark:text-slate-300">Our trust and safety team will review your report within 24 hours. You may receive a follow-up email if we need additional information.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Your Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" required data-testid="input-report-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">URL of Content</Label>
                    <Input id="url" type="url" placeholder="https://e-code.ai/..." required data-testid="input-report-url" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" placeholder="Please describe the issue in detail..." rows={5} required data-testid="input-report-description" />
                  </div>
                  <Button type="submit" className="w-full" data-testid="button-submit-report">Submit Report</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
