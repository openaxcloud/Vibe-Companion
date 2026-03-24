import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, BarChart3, PieChart, TrendingUp, Database, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BarChart3, title: "Rich visualizations", desc: "Build interactive charts, graphs, and data tables with popular libraries like Recharts and D3.", color: "#0079F2" },
  { icon: Database, title: "Database integration", desc: "Connect to PostgreSQL, MySQL, MongoDB, or any API to power your dashboards with live data.", color: "#0CCE6B" },
  { icon: RefreshCw, title: "Real-time updates", desc: "Auto-refresh data with WebSockets, polling, or server-sent events for live dashboards.", color: "#7C65CB" },
  { icon: Lock, title: "Authentication", desc: "Add role-based access control so different users see different data and permissions.", color: "#F26522" },
  { icon: PieChart, title: "AI-generated charts", desc: "Describe the data you want to visualize and let AI generate the chart code for you.", color: "#0079F2" },
  { icon: TrendingUp, title: "Export & embed", desc: "Export dashboards as PDFs or embed them in other applications with iframe support.", color: "#0CCE6B" },
];

export default function DashboardBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="dashboard-builder-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build data dashboards</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Create stunning data dashboards with real-time charts, database integration, and instant deployment.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-dashboard">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
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
