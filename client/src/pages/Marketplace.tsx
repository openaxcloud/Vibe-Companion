import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Package, Palette, Layers, Plug, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  { icon: Palette, title: "Themes", desc: "Editor themes and color schemes to personalize your IDE.", count: "120+", color: "#7C65CB" },
  { icon: Layers, title: "Templates", desc: "Project templates for web apps, APIs, bots, and more.", count: "85+", color: "#0079F2" },
  { icon: Plug, title: "Extensions", desc: "IDE extensions for linting, formatting, and productivity.", count: "60+", color: "#0CCE6B" },
  { icon: Database, title: "Integrations", desc: "Connect to third-party services and APIs.", count: "40+", color: "#F26522" },
];

export default function Marketplace() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="marketplace-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Marketplace</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Themes, templates, extensions, and integrations to supercharge your development workflow.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-marketplace">Browse marketplace <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((c) => (
            <div key={c.title} className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer" data-testid={`marketplace-${c.title.toLowerCase()}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">{c.count}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">{c.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
