import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Brain, Lock, Database, Workflow, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Brain, title: "LLM integration", desc: "Connect to any LLM API — OpenAI, Anthropic, Google, or self-hosted models — with secure key management.", color: "#7C65CB" },
  { icon: Lock, title: "Private & secure", desc: "Keep your internal AI tools on private infrastructure with role-based access control.", color: "#0079F2" },
  { icon: Database, title: "RAG pipelines", desc: "Build retrieval-augmented generation pipelines with vector databases and document processing.", color: "#0CCE6B" },
  { icon: Workflow, title: "Workflow automation", desc: "Create AI-powered automation workflows that connect to your internal systems and APIs.", color: "#F26522" },
  { icon: Shield, title: "Compliance ready", desc: "SOC 2 certified with audit logs, data residency options, and enterprise security controls.", color: "#0079F2" },
  { icon: Sparkles, title: "AI-assisted development", desc: "Use E-Code's AI agent to build and iterate on your internal AI tools faster.", color: "#7C65CB" },
];

export default function InternalAIBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="internal-ai-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7C65CB]/10 border border-[#7C65CB]/20 text-[#7C65CB] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build internal AI tools</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Create custom AI-powered internal tools for your team — chatbots, RAG pipelines, automation workflows, and more.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-internal-ai">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
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
