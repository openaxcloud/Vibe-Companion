import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Globe, Code2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  { title: "Featured", desc: "Hand-picked projects from the E-Code community" },
  { title: "AI & ML", desc: "Chatbots, ML models, and AI-powered applications" },
  { title: "Web Apps", desc: "Full-stack web applications and SaaS products" },
  { title: "Games", desc: "Browser games built with web technologies" },
  { title: "APIs & Backends", desc: "REST APIs, GraphQL servers, and microservices" },
  { title: "Data Visualization", desc: "Dashboards, charts, and data exploration tools" },
];

export default function Explore() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="explore-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Explore projects</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">Discover what the E-Code community is building. Fork any project and make it your own.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-explore">Start building <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((c) => (
            <div key={c.title} className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer" data-testid={`explore-${c.title.toLowerCase().replace(/\s/g, "-")}`}>
              <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
