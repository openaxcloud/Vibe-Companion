import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

export default function VsGitHubCodespaces() {
  const comparisons = [
    {
      feature: "AI-Powered Development",
      eCode: "GPT-5.1 + Claude Sonnet 4.5 built-in",
      github: "GitHub Copilot (additional cost)",
      advantage: "eCode"
    },
    {
      feature: "Deployment",
      eCode: "One-click deployment included",
      github: "Requires separate hosting setup",
      advantage: "eCode"
    },
    {
      feature: "Database",
      eCode: "Built-in PostgreSQL with GUI",
      github: "Manual setup required",
      advantage: "eCode"
    },
    {
      feature: "Pricing",
      eCode: "Free tier + affordable plans",
      github: "$10-$18/month per user",
      advantage: "eCode"
    },
    {
      feature: "Collaboration",
      eCode: "Real-time WebSocket collaboration",
      github: "Live Share integration",
      advantage: "both"
    },
    {
      feature: "GitHub Integration",
      eCode: "Full Git support",
      github: "Native GitHub integration",
      advantage: "github"
    }
  ];

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-7xl">
        {/* Back Button */}
        <Link href="/compare">
          <Button variant="ghost" className="mb-4 sm:mb-6 min-h-[44px]" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Comparisons
          </Button>
        </Link>

        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            E-Code Platform vs GitHub Codespaces
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground max-w-3xl mx-auto px-4 sm:px-0">
            Feature-by-feature comparison to help you choose the right platform
          </p>
        </div>

        {/* Comparison Table */}
        <Card className="mb-8 sm:mb-12" data-testid="card-comparison-table">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-[15px] sm:text-xl">Feature Comparison</CardTitle>
            <CardDescription className="text-[13px]">
              How E-Code Platform compares to GitHub Codespaces
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-comparison">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">Feature</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">E-Code Platform</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">GitHub Codespaces</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-comparison-${index}`}>
                      <td className="p-2 sm:p-4 font-medium text-[11px] sm:text-[13px]">{item.feature}</td>
                      <td className="p-2 sm:p-4">
                        <div className="flex items-start gap-1 sm:gap-2">
                          {item.advantage === "eCode" || item.advantage === "both" ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] sm:text-[13px]">{item.eCode}</span>
                        </div>
                      </td>
                      <td className="p-2 sm:p-4">
                        <div className="flex items-start gap-1 sm:gap-2">
                          {item.advantage === "github" || item.advantage === "both" ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] sm:text-[13px]">{item.github}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Key Advantages */}
        <Card className="mb-8 sm:mb-12" data-testid="card-advantages">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-[15px] sm:text-xl">Why Developers Choose E-Code Platform</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <div data-testid="advantage-allinone">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">All-in-One Platform</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Everything you need in one place: IDE, database, deployment, and AI assistance. No need to configure multiple services.
                </p>
              </div>
              <div data-testid="advantage-ai">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Better AI Integration</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Multiple AI models (GPT-5, Claude) built-in at no extra cost. Custom prompts and templates included.
                </p>
              </div>
              <div data-testid="advantage-setup">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Faster Setup</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Start coding in seconds. No configuration needed for database, authentication, or deployment.
                </p>
              </div>
              <div data-testid="advantage-cost">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Lower Cost</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  More generous free tier and lower pricing for premium features. No surprise bills for compute time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Ready to Switch?</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground mb-3 sm:mb-4">
              Import your GitHub repositories and start building in minutes
            </p>
            <Link href="/register">
              <Button size="lg" className="min-h-[44px]" data-testid="button-try-eCode">
                Try E-Code Platform Free
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
