import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const languages = [
  { name: "JavaScript", desc: "Web development, Node.js, React, Vue, Next.js", color: "#F0DB4F" },
  { name: "TypeScript", desc: "Type-safe JavaScript for large-scale applications", color: "#3178C6" },
  { name: "Python", desc: "Web apps, AI/ML, data science, automation", color: "#3572A5" },
  { name: "Go", desc: "High-performance APIs, microservices, CLI tools", color: "#00ADD8" },
  { name: "Rust", desc: "Systems programming, WebAssembly, performance-critical code", color: "#DEA584" },
  { name: "Ruby", desc: "Rails web applications, scripting, automation", color: "#CC342D" },
  { name: "Java", desc: "Enterprise applications, Android, Spring Boot", color: "#ED8B00" },
  { name: "C++", desc: "Game engines, systems programming, competitive coding", color: "#00599C" },
  { name: "C#", desc: ".NET applications, game development with Unity", color: "#239120" },
  { name: "PHP", desc: "Web development, Laravel, WordPress plugins", color: "#777BB4" },
  { name: "Swift", desc: "iOS/macOS development, server-side Swift", color: "#FA7343" },
  { name: "Kotlin", desc: "Android development, multiplatform applications", color: "#7F52FF" },
  { name: "HTML/CSS", desc: "Web pages, email templates, static sites", color: "#E34F26" },
  { name: "SQL", desc: "Database queries, data analysis, migrations", color: "#336791" },
  { name: "Bash", desc: "Shell scripting, automation, DevOps", color: "#4EAA25" },
];

export default function Languages() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="languages-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">50+ languages supported</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">First-class support for every major programming language. Syntax highlighting, IntelliSense, debugging, and AI assistance for all.</p>
          <Link href="/login"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-languages">Start coding <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {languages.map((l) => (
            <div key={l.name} className="p-4 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all" data-testid={`lang-${l.name.toLowerCase().replace(/[\/+#]/g, "")}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <h3 className="font-semibold text-sm">{l.name}</h3>
              </div>
              <p className="text-xs text-[var(--ide-text-secondary)]">{l.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
