import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, GraduationCap, Users, Globe, BookOpen, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: GraduationCap, title: "Zero setup for students", desc: "Students open a browser and start coding. No installation, no configuration, no environment issues.", color: "#0079F2" },
  { icon: Users, title: "Classroom management", desc: "Create classrooms, distribute assignments, and review student work — all in one platform.", color: "#7C65CB" },
  { icon: Globe, title: "Works everywhere", desc: "Students can code from any device — Chromebooks, tablets, or library computers.", color: "#0CCE6B" },
  { icon: BookOpen, title: "Curriculum templates", desc: "Pre-built templates for common CS courses: intro to programming, web dev, data structures.", color: "#F26522" },
  { icon: Shield, title: "FERPA compliant", desc: "Student data is protected with enterprise-grade security and FERPA compliance.", color: "#0079F2" },
  { icon: Zap, title: "Free for education", desc: "Qualifying educational institutions get free access to E-Code for all students and faculty.", color: "#0CCE6B" },
];

export default function Education() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="education-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-6">Education</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">E-Code for Education</h1>
          <p className="text-lg text-[var(--ide-text-secondary)] max-w-2xl mx-auto mb-10">The easiest way to teach coding. Zero setup, works on any device, with AI assistance for every student.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact-sales"><Button className="h-12 px-8 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="cta-edu-contact">Contact us <ArrowRight className="w-4 h-4" /></Button></Link>
            <Link href="/login"><Button variant="outline" className="h-12 px-8 rounded-xl" data-testid="cta-edu-try">Try free</Button></Link>
          </div>
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
