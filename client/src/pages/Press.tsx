import MarketingLayout from "@/components/marketing/MarketingLayout";
import { ExternalLink, Mail } from "lucide-react";

const coverage = [
  { outlet: "TechCrunch", title: "E-Code raises Series A to build the AI-powered cloud IDE", date: "2025-03-01" },
  { outlet: "The Verge", title: "This cloud IDE wants to replace your local development setup", date: "2025-02-15" },
  { outlet: "Hacker News", title: "E-Code: AI coding agent that builds entire apps from prompts", date: "2025-01-20" },
  { outlet: "Product Hunt", title: "#1 Product of the Day — E-Code AI Agent", date: "2025-01-10" },
];

export default function Press() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="press-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Press & Media</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-4">For press inquiries, brand assets, and media information.</p>
          <a href="mailto:press@e-code.ai" className="inline-flex items-center gap-2 text-[#0079F2] text-sm hover:underline"><Mail className="w-4 h-4" /> press@e-code.ai</a>
        </div>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-6">Recent coverage</h2>
          <div className="space-y-3">
            {coverage.map((c) => (
              <div key={c.title} className="flex items-center justify-between p-5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`press-${c.outlet.toLowerCase().replace(/\s/g, "-")}`}>
                <div>
                  <div className="text-xs text-[var(--ide-text-muted)] mb-1">{c.outlet} · {c.date}</div>
                  <h3 className="font-medium text-sm">{c.title}</h3>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0 ml-4" />
              </div>
            ))}
          </div>
          <div className="mt-12 p-8 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50">
            <h3 className="text-lg font-bold mb-2">Brand assets</h3>
            <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Download our logo, screenshots, and brand guidelines for press use.</p>
            <a href="mailto:press@e-code.ai" className="text-sm text-[#0079F2] hover:underline">Request brand kit</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
