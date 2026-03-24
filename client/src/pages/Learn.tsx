import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Code2, Play, GraduationCap } from "lucide-react";

const tracks = [
  { title: "Getting Started", desc: "Learn the basics of E-Code in 15 minutes", lessons: 5, level: "Beginner", color: "#0CCE6B" },
  { title: "Web Development", desc: "Build full-stack web apps with JavaScript", lessons: 12, level: "Intermediate", color: "#0079F2" },
  { title: "Python Programming", desc: "Learn Python from scratch with interactive exercises", lessons: 10, level: "Beginner", color: "#3572A5" },
  { title: "AI & Machine Learning", desc: "Build AI-powered applications with LLM APIs", lessons: 8, level: "Intermediate", color: "#7C65CB" },
  { title: "Database Design", desc: "Learn SQL, PostgreSQL, and data modeling", lessons: 7, level: "Intermediate", color: "#F26522" },
  { title: "DevOps & Deployment", desc: "Deploy, monitor, and scale your applications", lessons: 6, level: "Advanced", color: "#0079F2" },
];

export default function Learn() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="learn-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6"><GraduationCap className="w-3.5 h-3.5" /> Learn</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Learn to code on E-Code</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto">Interactive tutorials and learning tracks to help you go from beginner to professional developer.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {tracks.map((t) => (
            <Link key={t.title} href="/login">
              <div className="p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer group" data-testid={`track-${t.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${t.color}15`, color: t.color }}>{t.level}</span>
                  <span className="text-xs text-[var(--ide-text-muted)]">{t.lessons} lessons</span>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-[#0079F2] transition-colors">{t.title}</h3>
                <p className="text-sm text-[var(--ide-text-secondary)]">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
