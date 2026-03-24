import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Globe, Sparkles, Palette, Smartphone, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Sparkles, title: "AI website generation", desc: "Describe the website you want and get a fully functional site with responsive design in minutes.", color: "#7C65CB" },
  { icon: Palette, title: "Custom design", desc: "Full control over design with CSS, Tailwind, and popular UI frameworks. No templates to fight with.", color: "#0079F2" },
  { icon: Globe, title: "Custom domains", desc: "Connect your own domain with SSL certificates, CDN, and professional hosting included.", color: "#0CCE6B" },
  { icon: Smartphone, title: "Mobile responsive", desc: "All generated websites are mobile-first and responsive across all devices.", color: "#F26522" },
  { icon: Search, title: "SEO optimized", desc: "Built-in SEO best practices with meta tags, Open Graph, sitemaps, and performance optimization.", color: "#0079F2" },
  { icon: Zap, title: "Instant updates", desc: "Edit and deploy changes in seconds. No build pipeline, no waiting, just instant updates.", color: "#7C65CB" },
];

export default function WebsiteBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="website-builder-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build websites fast</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Create beautiful, responsive websites with AI assistance, custom domains, and one-click deployment.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-website">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50">
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
