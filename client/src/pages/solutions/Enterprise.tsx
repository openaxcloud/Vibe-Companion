import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Shield, Users, Lock, Server, BarChart3, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Shield, title: "SOC 2 compliance", desc: "Enterprise-grade security with SOC 2 Type II certification, data encryption, and audit logs.", color: "#0079F2" },
  { icon: Users, title: "Team management", desc: "Centralized team management with SSO, role-based access control, and seat management.", color: "#7C65CB" },
  { icon: Lock, title: "Private deployments", desc: "Deploy to private infrastructure with VPC peering, dedicated instances, and custom domains.", color: "#0CCE6B" },
  { icon: Server, title: "SLA guarantees", desc: "99.9% uptime SLA with priority support, dedicated account manager, and incident response.", color: "#F26522" },
  { icon: BarChart3, title: "Usage analytics", desc: "Detailed analytics on team usage, AI consumption, compute hours, and cost optimization.", color: "#0079F2" },
  { icon: HeadphonesIcon, title: "Priority support", desc: "24/7 priority support with dedicated Slack channel, onboarding assistance, and training.", color: "#7C65CB" },
];

export default function Enterprise() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="enterprise-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">E-Code for Enterprise</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Secure, scalable, and compliant cloud development for your entire organization. SOC 2 certified with enterprise SSO, private deployments, and dedicated support.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact-sales"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-contact-sales">Contact sales <ArrowRight className="w-4 h-4" /></Button></Link>
            <Link href="/login"><Button variant="outline" className="h-12 px-8 rounded-xl" data-testid="cta-try-free">Try free</Button></Link>
          </div>
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
        <div className="max-w-3xl mx-auto mt-20 p-8 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 text-center">
          <h3 className="text-xl font-bold mb-3">Trusted by leading companies</h3>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-6">Over 500 enterprise teams build and deploy on E-Code.</p>
          <Link href="/contact-sales"><Button className="bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-enterprise-demo">Schedule a demo <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
