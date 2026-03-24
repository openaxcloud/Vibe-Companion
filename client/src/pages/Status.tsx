import MarketingLayout from "@/components/marketing/MarketingLayout";
import { CheckCircle } from "lucide-react";

const services = [
  { name: "IDE & Editor", status: "operational" },
  { name: "AI Agent", status: "operational" },
  { name: "Deployment & Hosting", status: "operational" },
  { name: "Database Services", status: "operational" },
  { name: "Authentication", status: "operational" },
  { name: "API", status: "operational" },
  { name: "WebSocket / Real-time", status: "operational" },
  { name: "CDN & Static Assets", status: "operational" },
];

export default function Status() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="status-hero">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0CCE6B]/10 border border-[#0CCE6B]/20 text-[#0CCE6B] text-sm font-medium mb-6">
            <CheckCircle className="w-4 h-4" /> All systems operational
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">System Status</h1>
          <p className="text-[var(--ide-text-secondary)]">Real-time status of E-Code services.</p>
        </div>
        <div className="max-w-2xl mx-auto space-y-2">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`status-${s.name.toLowerCase().replace(/\s/g, "-")}`}>
              <span className="text-sm font-medium">{s.name}</span>
              <span className="flex items-center gap-2 text-xs text-[#0CCE6B]">
                <span className="w-2 h-2 rounded-full bg-[#0CCE6B]" />
                Operational
              </span>
            </div>
          ))}
        </div>
        <div className="max-w-2xl mx-auto mt-8 p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 text-center">
          <p className="text-sm text-[var(--ide-text-secondary)]">Subscribe to status updates at <a href="mailto:status@e-code.ai" className="text-[#0079F2] hover:underline">status@e-code.ai</a></p>
        </div>
      </section>
    </MarketingLayout>
  );
}
