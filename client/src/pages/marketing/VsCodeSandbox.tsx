import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

export default function VsCodeSandbox() {
  const comparisons = [
    {
      feature: "AI Code Generation",
      eCode: "GPT-4.1 + Claude built-in",
      codesandbox: "Not available",
      advantage: "eCode"
    },
    {
      feature: "Backend Support",
      eCode: "Full backend with database",
      codesandbox: "Limited backend (serverless)",
      advantage: "eCode"
    },
    {
      feature: "Deployment",
      eCode: "Production deployments",
      codesandbox: "Preview deployments",
      advantage: "eCode"
    },
    {
      feature: "Frontend Development",
      eCode: "Full support",
      codesandbox: "Excellent support",
      advantage: "both"
    },
    {
      feature: "Collaboration",
      eCode: "Real-time collaboration",
      codesandbox: "Real-time collaboration",
      advantage: "both"
    },
    {
      feature: "Templates",
      eCode: "AI-generated templates",
      codesandbox: "Large template library",
      advantage: "codesandbox"
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
            E-Code Platform vs CodeSandbox
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground max-w-3xl mx-auto px-4 sm:px-0">
            Full-stack platform vs frontend-focused editor
          </p>
        </div>

        <Card className="mb-8 sm:mb-12" data-testid="card-comparison-table">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-[15px] sm:text-xl">Feature Comparison</CardTitle>
            <CardDescription className="text-[13px]">
              How E-Code Platform compares to CodeSandbox
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-comparison">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">Feature</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">E-Code Platform</th>
                    <th className="text-left p-2 sm:p-4 font-semibold text-[11px] sm:text-[13px]">CodeSandbox</th>
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
                          {item.advantage === "codesandbox" || item.advantage === "both" ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] sm:text-[13px]">{item.codesandbox}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Build Full-Stack Apps with AI</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground mb-3 sm:mb-4">
              E-Code Platform supports both frontend and backend development
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
