import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Code2, Terminal, Globe, Sparkles, Users, Database, Shield, Zap, Smartphone, Palette, GitBranch, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Sparkles, title: "AI Coding Agent", desc: "Describe what you want to build and the AI agent generates the code, creates files, and sets up your project. A coding partner that understands your entire codebase.", color: "#7C65CB" },
  { icon: Code2, title: "Powerful Editor", desc: "Monaco-based editor with syntax highlighting for 50+ languages, intelligent autocomplete, multi-cursor editing, and customizable keybindings.", color: "#0079F2" },
  { icon: Terminal, title: "Live Terminal", desc: "Full Linux terminal in your browser. Install packages, run scripts, manage processes — everything you'd do in a local terminal.", color: "#0CCE6B" },
  { icon: Globe, title: "Instant Deployment", desc: "Deploy to production with one click. Custom domains, SSL certificates, CDN, and auto-scaling included.", color: "#F26522" },
  { icon: Database, title: "Built-in Databases", desc: "PostgreSQL, key-value stores, and object storage available instantly. No configuration, no external services.", color: "#0079F2" },
  { icon: Users, title: "Real-time Collaboration", desc: "Code together in real time. See cursors, share terminals, and pair program with anyone in the world.", color: "#7C65CB" },
  { icon: Shield, title: "Enterprise Security", desc: "SOC 2 Type II certified. SSO, RBAC, audit logs, and encrypted data at rest and in transit.", color: "#0CCE6B" },
  { icon: GitBranch, title: "Git Integration", desc: "Built-in Git support with visual diff, branch management, and GitHub/GitLab integration.", color: "#F26522" },
  { icon: Package, title: "Package Management", desc: "Install npm, pip, cargo, or any package manager packages directly from the IDE.", color: "#0079F2" },
  { icon: Smartphone, title: "Mobile IDE", desc: "Full IDE experience on mobile devices. Code, debug, and deploy from your phone or tablet.", color: "#7C65CB" },
  { icon: Palette, title: "Theme Editor", desc: "Customize your IDE with a visual theme editor. Create, share, and install community themes.", color: "#0CCE6B" },
  { icon: Zap, title: "Hot Reloading", desc: "See changes instantly with hot module replacement. No manual refreshing needed.", color: "#F26522" },
];

export default function Features() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="features-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Everything you need to build</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">A complete cloud development platform with AI-powered coding, instant deployment, and real-time collaboration.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-features">Start building for free <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
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
