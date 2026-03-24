import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Rocket, Clock, DollarSign, Users, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Rocket, title: "Ship MVPs fast", desc: "Go from idea to deployed MVP in hours, not weeks. AI generates your codebase from a description.", color: "#0079F2" },
  { icon: DollarSign, title: "Zero DevOps costs", desc: "No servers to manage, no infrastructure to set up. Everything is included in your plan.", color: "#0CCE6B" },
  { icon: Clock, title: "Instant iterations", desc: "Deploy changes in seconds. A/B test features, roll back instantly, iterate rapidly.", color: "#7C65CB" },
  { icon: Users, title: "Team collaboration", desc: "Invite co-founders and developers to collaborate in real time on the same codebase.", color: "#F26522" },
  { icon: Sparkles, title: "AI co-pilot", desc: "An AI agent that understands your codebase and helps you build features, fix bugs, and refactor.", color: "#0079F2" },
  { icon: TrendingUp, title: "Scale as you grow", desc: "Start free, upgrade as you scale. No vendor lock-in, export your code anytime.", color: "#7C65CB" },
];

export default function Startups() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="startups-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0CCE6B]/10 border border-[#0CCE6B]/20 text-[#0CCE6B] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">E-Code for startups</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Ship your MVP faster than ever. AI-powered development, instant deployment, and zero infrastructure overhead.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-startups">Start free <ArrowRight className="w-4 h-4" /></Button></Link>
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
