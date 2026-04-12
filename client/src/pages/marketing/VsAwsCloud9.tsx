import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

export default function VsAwsCloud9() {
  const comparisons = [
    {
      feature: "Setup Complexity",
      eCode: "Zero configuration needed",
      aws: "Requires AWS account setup",
      advantage: "eCode"
    },
    {
      feature: "AI Development",
      eCode: "Built-in GPT-4.1 + Claude",
      aws: "Not available",
      advantage: "eCode"
    },
    {
      feature: "Pricing Model",
      eCode: "Simple, transparent pricing",
      aws: "Complex AWS billing",
      advantage: "eCode"
    },
    {
      feature: "Deployment",
      eCode: "One-click deployment",
      aws: "Manual AWS service configuration",
      advantage: "eCode"
    },
    {
      feature: "AWS Integration",
      eCode: "Available via API",
      aws: "Native AWS integration",
      advantage: "aws"
    },
    {
      feature: "Enterprise Support",
      eCode: "Available",
      aws: "Extensive AWS support",
      advantage: "aws"
    }
  ];

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-7xl">
        <Link href="/compare">
          <Button variant="ghost" className="mb-4 sm:mb-6 min-h-[44px]" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Comparisons
          </Button>
        </Link>

        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            E-Code Platform vs AWS Cloud9
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground max-w-3xl mx-auto px-4 sm:px-0">
            Modern development platform vs traditional cloud IDE
          </p>
        </div>

        <Card className="mb-8 sm:mb-12" data-testid="card-comparison-table">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-[15px] sm:text-xl">Feature Comparison</CardTitle>
            <CardDescription className="text-[13px]">
              How E-Code Platform compares to AWS Cloud9
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-comparison">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">Feature</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">E-Code Platform</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">AWS Cloud9</th>
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
                          {item.advantage === "aws" || item.advantage === "both" ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] sm:text-[13px]">{item.aws}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 sm:mb-12" data-testid="card-advantages">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-[15px] sm:text-xl">Why Choose E-Code Platform Over Cloud9</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div data-testid="advantage-simple">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Simpler to Get Started</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  No AWS account needed. Start coding in seconds without navigating complex cloud services.
                </p>
              </div>
              <div data-testid="advantage-ai">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Modern AI Features</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Built-in AI code generation with the latest models. Cloud9 doesn't offer AI assistance.
                </p>
              </div>
              <div data-testid="advantage-pricing">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Predictable Pricing</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Simple pricing with no surprise AWS bills. Know exactly what you'll pay each month.
                </p>
              </div>
              <div data-testid="advantage-deploy">
                <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Faster Deployment</h3>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground">
                  Deploy to production with one click. No need to configure EC2, load balancers, or other AWS services.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Modern Development, Simplified</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground mb-3 sm:mb-4">
              Get the power of cloud development without the complexity of AWS
            </p>
            <Link href="/register">
              <Button size="lg" className="min-h-[44px]" data-testid="button-get-started">
                Get Started Free
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
