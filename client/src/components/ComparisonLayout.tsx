import { PublicNavbar } from "./layout/PublicNavbar";
import { PublicFooter } from "./layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Check, X, Minus } from "lucide-react";
import { useLocation } from "wouter";
import { ReactNode } from "react";

interface Feature {
  name: string;
  ecode: boolean | string;
  competitor: boolean | string;
}

interface ComparisonLayoutProps {
  competitorName: string;
  competitorLogo?: string | ReactNode;
  tagline: string;
  description: string;
  features: Feature[];
  ecodeAdvantages: string[];
  competitorAdvantages: string[];
}

export function ComparisonLayout({
  competitorName,
  competitorLogo,
  tagline,
  description,
  features,
  ecodeAdvantages,
  competitorAdvantages,
}: ComparisonLayoutProps) {
  const [location, navigate] = useLocation();

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-green-500" />
      ) : (
        <X className="h-5 w-5 text-red-500" />
      );
    }
    return <span className="text-[13px]">{value}</span>;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="flex items-center gap-4">
                  <img
                    src="/e-code-logo.svg"
                    alt="E-Code"
                    className="h-12 w-12"
                  />
                  <span className="text-4xl font-bold">E-Code</span>
                </div>
                <span className="text-3xl text-muted-foreground">vs</span>
                <div className="flex items-center gap-4">
                  {competitorLogo && (
                    typeof competitorLogo === 'string' ? (
                      <img
                        src={competitorLogo}
                        alt={competitorName}
                        className="h-12 w-12"
                      />
                    ) : (
                      competitorLogo
                    )
                  )}
                  <span className="text-4xl font-bold">{competitorName}</span>
                </div>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {tagline}
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8">
                {description}
              </p>
              
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate("/register")}
                  className="px-8"
                >
                  Get Started with E-Code
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/features")}
                  className="px-8"
                >
                  Explore Features
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Feature Comparison
            </h2>
            
            <div className="max-w-5xl mx-auto">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-6 py-4 font-semibold">
                        Feature
                      </th>
                      <th className="text-center px-6 py-4 font-semibold">
                        E-Code
                      </th>
                      <th className="text-center px-6 py-4 font-semibold">
                        {competitorName}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, index) => (
                      <tr
                        key={index}
                        className="border-b border-border hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-6 py-4">{feature.name}</td>
                        <td className="px-6 py-4 text-center">
                          {renderFeatureValue(feature.ecode)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {renderFeatureValue(feature.competitor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Advantages Section */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
              {/* E-Code Advantages */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-center">
                  Why Choose E-Code
                </h3>
                <div className="space-y-4">
                  {ecodeAdvantages.map((advantage, index) => (
                    <div
                      key={index}
                      className="flex gap-3 items-start p-4 rounded-lg bg-background border border-border"
                    >
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[13px]">{advantage}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitor Advantages */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-center">
                  When to Choose {competitorName}
                </h3>
                <div className="space-y-4">
                  {competitorAdvantages.map((advantage, index) => (
                    <div
                      key={index}
                      className="flex gap-3 items-start p-4 rounded-lg bg-background border border-border"
                    >
                      <Minus className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-[13px]">{advantage}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Build with E-Code?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join developers, learners, and creators building software with AI assistance.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="px-8"
              >
                Start Coding for Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/pricing")}
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}