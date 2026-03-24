import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const competitors = [
  { name: "VS Code Online", path: "/compare/vs-github-codespaces", desc: "Compare with GitHub Codespaces" },
  { name: "CodeSandbox", path: "/compare/vs-codesandbox", desc: "Compare with CodeSandbox" },
  { name: "Glitch", path: "/compare/vs-glitch", desc: "Compare with Glitch" },
  { name: "Heroku", path: "/compare/vs-heroku", desc: "Compare with Heroku" },
  { name: "AWS Cloud9", path: "/compare/vs-aws-cloud9", desc: "Compare with AWS Cloud9" },
];

export default function Compare() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="compare-hero">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">How E-Code compares</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-12">See how E-Code stacks up against other cloud development platforms.</p>
        </div>
        <div className="max-w-3xl mx-auto grid gap-4">
          {competitors.map((c) => (
            <Link key={c.path} href={c.path}>
              <div className="flex items-center justify-between p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer group" data-testid={`compare-card-${c.name.toLowerCase().replace(/\s/g, "-")}`}>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{c.name}</h3>
                  <p className="text-sm text-[var(--ide-text-secondary)]">{c.desc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--ide-text-muted)] group-hover:text-[#0079F2] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}

function ComparisonTable({ competitor, features }: { competitor: string; features: { feature: string; ecode: boolean; other: boolean }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" data-testid="comparison-table">
        <thead>
          <tr className="border-b border-[var(--ide-border)]">
            <th className="text-left py-4 px-4 text-sm font-semibold">Feature</th>
            <th className="text-center py-4 px-4 text-sm font-semibold text-[#0079F2]">E-Code</th>
            <th className="text-center py-4 px-4 text-sm font-semibold">{competitor}</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.feature} className="border-b border-[var(--ide-border)]/50">
              <td className="py-3 px-4 text-sm">{f.feature}</td>
              <td className="py-3 px-4 text-center">{f.ecode ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <XIcon className="w-5 h-5 text-red-400 mx-auto" />}</td>
              <td className="py-3 px-4 text-center">{f.other ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <XIcon className="w-5 h-5 text-red-400 mx-auto" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ComparisonTable };
