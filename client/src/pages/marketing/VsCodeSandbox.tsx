import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonTable } from "./Compare";

const features = [
  { feature: "AI coding agent", ecode: true, other: false },
  { feature: "Backend support", ecode: true, other: true },
  { feature: "Database hosting", ecode: true, other: false },
  { feature: "Custom domain deployment", ecode: true, other: false },
  { feature: "50+ languages", ecode: true, other: false },
  { feature: "Real-time collaboration", ecode: true, other: true },
  { feature: "Git integration", ecode: true, other: true },
  { feature: "Free tier", ecode: true, other: true },
  { feature: "Terminal access", ecode: true, other: true },
  { feature: "Team billing", ecode: true, other: true },
];

export default function VsCodeSandbox() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="vs-codesandbox-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Compare</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">E-Code vs CodeSandbox</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto">E-Code goes beyond frontend sandboxes with full-stack support, AI coding agent, database hosting, and production deployment.</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <ComparisonTable competitor="CodeSandbox" features={features} />
        </div>
        <div className="max-w-2xl mx-auto text-center mt-16">
          <h2 className="text-2xl font-bold mb-4">Ready to switch?</h2>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-switch">Start building for free <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
