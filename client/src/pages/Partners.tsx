import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Handshake, DollarSign, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const programs = [
  { icon: Handshake, title: "Technology Partners", desc: "Integrate your tools and services with E-Code. Get distribution to thousands of developers.", color: "#0079F2" },
  { icon: DollarSign, title: "Affiliate Program", desc: "Earn commissions by referring developers and teams to E-Code. Competitive payouts.", color: "#0CCE6B" },
  { icon: Users, title: "Consulting Partners", desc: "Help your clients build and deploy on E-Code. Access partner resources and support.", color: "#7C65CB" },
  { icon: Sparkles, title: "Education Partners", desc: "Bring E-Code to your institution. Free access for students and special pricing for departments.", color: "#F26522" },
];

export default function Partners() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="partners-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Partner with E-Code</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Join our partner ecosystem and help developers build software faster.</p>
          <a href="mailto:partners@e-code.ai"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-partner">Become a partner <ArrowRight className="w-4 h-4" /></Button></a>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {programs.map((p) => (
            <div key={p.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`partner-${p.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                <p.icon className="w-5 h-5" style={{ color: p.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
