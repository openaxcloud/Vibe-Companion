import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, DollarSign, Code2, Users, Trophy, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: DollarSign, title: "Earn money coding", desc: "Complete bounties and get paid for your contributions to open source and community projects.", color: "#0CCE6B" },
  { icon: Code2, title: "Real-world projects", desc: "Work on actual codebases and gain experience solving real problems for companies and creators.", color: "#0079F2" },
  { icon: Users, title: "Community driven", desc: "Join a vibrant community of developers, share solutions, and learn from peers worldwide.", color: "#7C65CB" },
  { icon: Trophy, title: "Build your reputation", desc: "Showcase completed bounties on your profile and attract future opportunities.", color: "#F26522" },
  { icon: Clock, title: "Flexible schedule", desc: "Pick up bounties that match your skills and work on your own time.", color: "#0079F2" },
  { icon: Shield, title: "Secure payments", desc: "All payments are processed securely through our platform with guaranteed payouts.", color: "#0CCE6B" },
];

export default function Bounties() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="bounties-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0CCE6B]/10 border border-[#0CCE6B]/20 text-[#0CCE6B] text-xs font-medium mb-6">Coming Soon</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">E-Code Bounties</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Get paid to code. Browse open bounties, submit solutions, and earn money — all from your browser.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-bounties">Join the waitlist <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all" data-testid={`bounty-feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
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
