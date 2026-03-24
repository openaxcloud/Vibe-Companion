import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Smartphone, Zap, Globe, Database, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Sparkles, title: "AI-powered development", desc: "Describe your app and let the AI agent generate the code, UI, and database schema for you.", color: "#7C65CB" },
  { icon: Globe, title: "Instant deployment", desc: "Go from code to production in one click. Custom domains, SSL, and CDN included.", color: "#0079F2" },
  { icon: Database, title: "Built-in databases", desc: "PostgreSQL, key-value stores, and object storage available out of the box.", color: "#0CCE6B" },
  { icon: Shield, title: "Authentication included", desc: "Add user login with OAuth, email/password, or social sign-in in minutes.", color: "#F26522" },
  { icon: Zap, title: "Real-time features", desc: "WebSockets, SSE, and real-time collaboration built into the platform.", color: "#0079F2" },
  { icon: Smartphone, title: "Mobile responsive", desc: "Build responsive apps that work seamlessly on desktop and mobile devices.", color: "#7C65CB" },
];

export default function AppBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="app-builder-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build apps faster</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">From idea to deployed app in minutes. E-Code's AI agent helps you build full-stack web applications with zero configuration.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-app-builder">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
