import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Shield, Lock, Server, Eye, FileCheck, Globe } from "lucide-react";

const practices = [
  { icon: Shield, title: "SOC 2 Type II", desc: "Independently audited security controls with continuous compliance monitoring.", color: "#0079F2" },
  { icon: Lock, title: "Encryption", desc: "AES-256 encryption at rest and TLS 1.3 in transit for all data and communications.", color: "#0CCE6B" },
  { icon: Server, title: "Isolated environments", desc: "Every project runs in its own sandboxed container with process and network isolation.", color: "#7C65CB" },
  { icon: Eye, title: "Audit logging", desc: "Comprehensive audit logs for all user actions, API calls, and system events.", color: "#F26522" },
  { icon: FileCheck, title: "Vulnerability scanning", desc: "Automated dependency scanning, SAST analysis, and penetration testing.", color: "#0079F2" },
  { icon: Globe, title: "DDoS protection", desc: "Built-in DDoS mitigation, WAF, and rate limiting for all deployed applications.", color: "#0CCE6B" },
];

export default function Security() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="security-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6"><Shield className="w-3.5 h-3.5" /> Security</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Security at E-Code</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto">Enterprise-grade security is built into every layer of E-Code. Your code, data, and deployments are protected by industry-leading security practices.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {practices.map((p) => (
            <div key={p.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`security-${p.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                <p.icon className="w-5 h-5" style={{ color: p.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="max-w-2xl mx-auto mt-16 p-8 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 text-center">
          <h3 className="text-lg font-bold mb-2">Report a vulnerability</h3>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-4">If you've found a security vulnerability, please report it responsibly.</p>
          <a href="mailto:security@e-code.ai" className="text-sm text-[#0079F2] hover:underline">security@e-code.ai</a>
        </div>
      </section>
    </MarketingLayout>
  );
}
