import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, MessageSquare, Brain, Zap, Globe, Lock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Brain, title: "AI model integration", desc: "Connect to OpenAI, Anthropic, Google Gemini, or any LLM API with built-in integrations.", color: "#7C65CB" },
  { icon: MessageSquare, title: "Conversation UI", desc: "Pre-built chat components with streaming, markdown rendering, and code highlighting.", color: "#0079F2" },
  { icon: Zap, title: "Rapid prototyping", desc: "Go from concept to working chatbot in minutes with AI-assisted code generation.", color: "#F26522" },
  { icon: Globe, title: "One-click deploy", desc: "Deploy your chatbot to a custom domain with SSL, CDN, and auto-scaling.", color: "#0CCE6B" },
  { icon: Lock, title: "API key management", desc: "Secure storage for API keys and secrets with environment variable management.", color: "#0079F2" },
  { icon: BarChart3, title: "Usage analytics", desc: "Track conversations, token usage, and costs with built-in analytics.", color: "#7C65CB" },
];

export default function ChatbotBuilder() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="chatbot-builder-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7C65CB]/10 border border-[#7C65CB]/20 text-[#7C65CB] text-xs font-medium mb-6">Solutions</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Build AI chatbots</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Create powerful AI chatbots with built-in LLM integrations, streaming responses, and instant deployment.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-chatbot">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
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
