import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const templates = [
  { name: "Next.js Starter", desc: "Full-stack React framework with API routes", lang: "TypeScript", category: "Web App" },
  { name: "Express API", desc: "RESTful API with authentication and PostgreSQL", lang: "JavaScript", category: "Backend" },
  { name: "Python Flask", desc: "Flask web application with Jinja2 templates", lang: "Python", category: "Web App" },
  { name: "React Dashboard", desc: "Admin dashboard with charts and data tables", lang: "TypeScript", category: "Dashboard" },
  { name: "AI Chatbot", desc: "Conversational AI with OpenAI integration", lang: "TypeScript", category: "AI" },
  { name: "E-Commerce Store", desc: "Full-stack store with Stripe payments", lang: "TypeScript", category: "Web App" },
  { name: "Blog Platform", desc: "Markdown blog with CMS and SEO optimization", lang: "TypeScript", category: "Web App" },
  { name: "Discord Bot", desc: "Discord bot with slash commands and events", lang: "JavaScript", category: "Bot" },
  { name: "FastAPI Backend", desc: "High-performance API with async support", lang: "Python", category: "Backend" },
];

export default function TemplateMarketplace() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="templates-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Templates</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Start with a production-ready template. Fork it and customize to your needs.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Link key={t.name} href="/login">
              <div className="p-5 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer group" data-testid={`template-${t.name.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0079F2]/10 text-[#0079F2]">{t.category}</span>
                  <span className="text-xs text-[var(--ide-text-muted)]">{t.lang}</span>
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-[#0079F2] transition-colors">{t.name}</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
