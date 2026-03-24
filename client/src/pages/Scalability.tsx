import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Server, Zap, Globe, Shield, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Server, title: "Auto-scaling", desc: "Applications automatically scale based on traffic. Handle spikes without manual intervention.", color: "#0079F2" },
  { icon: Globe, title: "Global CDN", desc: "Static assets served from edge locations worldwide for sub-100ms load times.", color: "#0CCE6B" },
  { icon: Zap, title: "Zero cold starts", desc: "Applications stay warm and responsive. No cold start delays for your users.", color: "#7C65CB" },
  { icon: Shield, title: "99.9% uptime SLA", desc: "Enterprise plans include uptime guarantees with credits for any downtime.", color: "#F26522" },
  { icon: BarChart3, title: "Performance monitoring", desc: "Built-in metrics for response times, throughput, and resource utilization.", color: "#0079F2" },
  { icon: RefreshCw, title: "Zero-downtime deploys", desc: "Blue-green deployments ensure your users never experience downtime during updates.", color: "#0CCE6B" },
];

export default function Scalability() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="scalability-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Built to scale</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">From prototype to production at scale. E-Code handles the infrastructure so you can focus on building.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-scalability">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
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
