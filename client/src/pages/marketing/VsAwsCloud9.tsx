import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonTable } from "./Compare";

const features = [
  { feature: "Zero setup required", ecode: true, other: false },
  { feature: "AI coding agent", ecode: true, other: false },
  { feature: "Instant deployment", ecode: true, other: false },
  { feature: "Free tier available", ecode: true, other: false },
  { feature: "Real-time collaboration", ecode: true, other: true },
  { feature: "Built-in terminal", ecode: true, other: true },
  { feature: "50+ languages", ecode: true, other: true },
  { feature: "Team management", ecode: true, other: true },
  { feature: "No AWS account needed", ecode: true, other: false },
  { feature: "Mobile friendly", ecode: true, other: false },
];

export default function VsAwsCloud9() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="vs-cloud9-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Compare</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">E-Code vs AWS Cloud9</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto">E-Code offers a more accessible cloud IDE with AI-powered coding, instant deployment, and no AWS account required.</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <ComparisonTable competitor="AWS Cloud9" features={features} />
        </div>
        <div className="max-w-2xl mx-auto text-center mt-16">
          <h2 className="text-2xl font-bold mb-4">Ready to switch?</h2>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-switch">Start building for free <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
