import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, DollarSign, Clock, Globe, Share2, Sparkles, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Sparkles, title: "AI accelerates delivery", desc: "Complete projects faster with AI-assisted coding, debugging, and code generation.", color: "#7C65CB" },
  { icon: Clock, title: "Faster turnaround", desc: "No setup time means you can start working on client projects immediately.", color: "#0079F2" },
  { icon: Globe, title: "Deploy for clients", desc: "Deploy client projects to custom domains with SSL in one click.", color: "#0CCE6B" },
  { icon: Share2, title: "Share live previews", desc: "Share live project URLs with clients for instant feedback and approval.", color: "#F26522" },
  { icon: DollarSign, title: "Affordable pricing", desc: "Free tier covers small projects. Pro plan costs less than a coffee per day.", color: "#0079F2" },
  { icon: Briefcase, title: "Professional portfolio", desc: "Build and host your portfolio alongside client projects, all in one place.", color: "#7C65CB" },
];

export default function Freelancers() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="freelancers-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F26522]/10 border border-[#F26522]/20 text-[#F26522] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">E-Code for freelancers</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Deliver client projects faster, deploy instantly, and manage everything from one platform. The all-in-one toolkit for freelance developers.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-freelancers">Start free <ArrowRight className="w-4 h-4" /></Button></Link>
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
