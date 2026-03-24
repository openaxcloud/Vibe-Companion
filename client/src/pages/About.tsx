import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Users, Globe, Sparkles, Heart } from "lucide-react";

const values = [
  { icon: Users, title: "Community first", desc: "We build for developers, with developers. Our community shapes the product.", color: "#0079F2" },
  { icon: Globe, title: "Accessible to all", desc: "Anyone with a browser should be able to build and ship software.", color: "#0CCE6B" },
  { icon: Sparkles, title: "AI-augmented", desc: "AI should amplify human creativity, not replace it.", color: "#7C65CB" },
  { icon: Heart, title: "Open & transparent", desc: "We share our roadmap, listen to feedback, and build in the open.", color: "#F26522" },
];

export default function About() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="about-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">About E-Code</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto">We're on a mission to make software development accessible to everyone. E-Code is a cloud IDE with an AI coding agent that helps you build, test, and deploy software from any device.</p>
        </div>
        <div className="max-w-4xl mx-auto mb-20">
          <div className="p-8 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50">
            <h2 className="text-2xl font-bold mb-4">Our story</h2>
            <div className="space-y-4 text-[var(--ide-text-secondary)] leading-relaxed">
              <p>E-Code was founded with a simple belief: building software should be as easy as writing a document. No environment setup, no deployment headaches, no infrastructure management.</p>
              <p>We built E-Code to be the development platform we wished existed — one where you open a browser, describe what you want to build, and an AI agent helps you bring it to life. Where deploying to production is one click. Where collaboration happens in real time.</p>
              <p>Today, E-Code is used by thousands of developers, students, freelancers, and teams worldwide to build everything from simple websites to complex full-stack applications.</p>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Our values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`value-${v.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${v.color}15`, border: `1px solid ${v.color}30` }}>
                  <v.icon className="w-5 h-5" style={{ color: v.color }} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
