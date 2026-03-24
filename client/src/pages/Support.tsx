import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { BookOpen, MessageSquare, FileText, Mail, Users, Zap } from "lucide-react";

const resources = [
  { icon: BookOpen, title: "Documentation", desc: "Comprehensive guides, tutorials, and API reference.", href: "/docs", color: "#0079F2" },
  { icon: MessageSquare, title: "Community Forum", desc: "Ask questions and get help from the E-Code community.", href: "/community", color: "#7C65CB" },
  { icon: FileText, title: "Knowledge Base", desc: "Browse FAQs and troubleshooting guides.", href: "/help", color: "#0CCE6B" },
  { icon: Mail, title: "Email Support", desc: "Reach our support team directly for technical issues.", href: "mailto:support@e-code.ai", color: "#F26522" },
  { icon: Users, title: "Enterprise Support", desc: "Priority support with dedicated account manager for teams.", href: "/contact-sales", color: "#0079F2" },
  { icon: Zap, title: "Status Page", desc: "Check the real-time status of all E-Code services.", href: "/status", color: "#0CCE6B" },
];

export default function Support() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="support-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Support</h1>
          <p className="text-lg text-[var(--ide-text-secondary)]">Get help with E-Code. We're here to make sure you succeed.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((r) => {
            const content = (
              <div className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer h-full" data-testid={`support-${r.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${r.color}15`, border: `1px solid ${r.color}30` }}>
                  <r.icon className="w-5 h-5" style={{ color: r.color }} />
                </div>
                <h3 className="font-semibold mb-1">{r.title}</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">{r.desc}</p>
              </div>
            );
            return r.href.startsWith("mailto:") ? (
              <a key={r.title} href={r.href}>{content}</a>
            ) : (
              <Link key={r.title} href={r.href}>{content}</Link>
            );
          })}
        </div>
      </section>
    </MarketingLayout>
  );
}
