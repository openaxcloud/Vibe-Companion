import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Mail, MessageSquare, FileText, Bug } from "lucide-react";
import { Link } from "wouter";

const channels = [
  { icon: Mail, title: "General inquiries", desc: "Questions about E-Code, partnerships, or media inquiries.", action: "support@e-code.ai", href: "mailto:support@e-code.ai", color: "#0079F2" },
  { icon: MessageSquare, title: "Sales", desc: "Enterprise pricing, custom plans, and volume licensing.", action: "sales@e-code.ai", href: "mailto:sales@e-code.ai", color: "#0CCE6B" },
  { icon: Bug, title: "Bug reports", desc: "Found a bug? Report it and we'll fix it as fast as possible.", action: "Report a bug", href: "/support", color: "#F26522" },
  { icon: FileText, title: "Documentation", desc: "Browse our docs for guides, tutorials, and API reference.", action: "View docs", href: "/docs", color: "#7C65CB" },
];

export default function Contact() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="contact-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact us</h1>
          <p className="text-lg text-[var(--ide-text-secondary)]">We'd love to hear from you. Choose the best way to reach us.</p>
        </div>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {channels.map((c) => (
            <a key={c.title} href={c.href.startsWith("mailto:") ? c.href : undefined}>
              {c.href.startsWith("/") ? (
                <Link href={c.href}>
                  <div className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer h-full" data-testid={`contact-${c.title.toLowerCase().replace(/\s/g, "-")}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                      <c.icon className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                    <h3 className="font-semibold mb-1">{c.title}</h3>
                    <p className="text-sm text-[var(--ide-text-secondary)] mb-3">{c.desc}</p>
                    <span className="text-sm text-[#0079F2]">{c.action}</span>
                  </div>
                </Link>
              ) : (
                <div className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer h-full" data-testid={`contact-${c.title.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                    <c.icon className="w-5 h-5" style={{ color: c.color }} />
                  </div>
                  <h3 className="font-semibold mb-1">{c.title}</h3>
                  <p className="text-sm text-[var(--ide-text-secondary)] mb-3">{c.desc}</p>
                  <span className="text-sm text-[#0079F2]">{c.action}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
