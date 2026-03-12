import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Github, Play, Terminal, Code2, Sparkles, Globe, Users, Zap, Shield, ArrowRight, ChevronRight, Eye, Menu, X } from "lucide-react";

function ECodeLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
      <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
      <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
    </svg>
  );
}

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #0079F2 1px, transparent 0)`, backgroundSize: "40px 40px" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-radial from-[#0079F2]/6 via-[#0079F2]/1 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-[#7C65CB]/4 via-transparent to-transparent rounded-full blur-3xl" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-gradient-radial from-[#F26522]/3 via-transparent to-transparent rounded-full blur-3xl" />
    </div>
  );
}

function CodeDemo() {
  const [line, setLine] = useState(0);
  const lines = [
    { num: 1, code: '<span class="kw">import</span> express <span class="kw">from</span> <span class="str">"express"</span>;' },
    { num: 2, code: '<span class="kw">const</span> app = <span class="fn">express</span>();' },
    { num: 3, code: '' },
    { num: 4, code: 'app.<span class="fn">get</span>(<span class="str">"/"</span>, (req, res) => {' },
    { num: 5, code: '  res.<span class="fn">json</span>({ <span class="prop">message</span>: <span class="str">"Hello World"</span> });' },
    { num: 6, code: '});' },
    { num: 7, code: '' },
    { num: 8, code: 'app.<span class="fn">listen</span>(<span class="num">3000</span>);' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setLine(l => (l + 1) % (lines.length + 3)), 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-[560px] rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-9 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[10px] text-[var(--ide-text-muted)] font-medium">index.js</span>
        </div>
      </div>
      <div className="p-4 font-mono text-[13px] leading-[22px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {lines.map((l, i) => (
          <div key={i} className={`flex transition-opacity duration-300 ${i <= line ? "opacity-100" : "opacity-0"}`}>
            <span className="w-8 text-right text-[#4A5068] select-none mr-4 text-xs">{l.num}</span>
            <span dangerouslySetInnerHTML={{ __html: l.code || "&nbsp;" }} />
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--ide-border)] bg-[var(--ide-bg)] px-4 py-2.5 flex items-center gap-2">
        <Terminal className="w-3.5 h-3.5 text-[#0CCE6B]" />
        <span className="text-[11px] font-mono text-[#0CCE6B]">$ Server running on port 3000</span>
        <span className="w-2 h-4 bg-[#0079F2] animate-pulse ml-0.5" />
      </div>
      <style>{`
        .kw { color: #FF6166; }
        .str { color: #0CCE6B; }
        .fn { color: #56B6C2; }
        .num { color: #FF9940; }
        .prop { color: #FFCB6B; }
      `}</style>
    </div>
  );
}

const features = [
  { icon: Code2, title: "Powerful IDE", desc: "Full-featured code editor with syntax highlighting, autocomplete, linting, and multi-language support.", color: "#0079F2" },
  { icon: Sparkles, title: "AI Coding Agent", desc: "Chat with AI or let it build entire features. Supports Claude, GPT-4o, and Gemini models.", color: "#7C65CB" },
  { icon: Terminal, title: "Live Terminal", desc: "Real terminal with PTY support. Run any command, install packages, manage your project.", color: "#0CCE6B" },
  { icon: Globe, title: "Instant Deploy", desc: "Publish your project with one click. Get a live URL, custom domains, and SSL included.", color: "#F26522" },
  { icon: Users, title: "Team Collaboration", desc: "Create teams, invite members, share projects. Role-based access control built in.", color: "#0079F2" },
  { icon: Shield, title: "Enterprise Security", desc: "Sandboxed execution, CSRF protection, encrypted secrets, audit logging, and rate limiting.", color: "#FF6166" },
];

const defaultStats = [
  { value: "10+", label: "Languages" },
  { value: "3", label: "AI Models" },
  { value: "< 1s", label: "Deploy Time" },
  { value: "99.9%", label: "Uptime" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const statsQuery = useQuery<{ value: string; label: string }[]>({
    queryKey: ["/api/landing-stats"],
    staleTime: 60000,
  });
  const stats = statsQuery.data || defaultStats;

  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-x-hidden" data-testid="landing-page">
      <AnimatedGrid />

      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 h-16 border-b border-[var(--ide-border)]/50 bg-[var(--ide-bg)]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <ECodeLogo size={28} />
          <span className="text-lg font-bold tracking-tight">E-Code</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/pricing" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-pricing">Pricing</Link>
          <Link href="/demo" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-demo">Demo</Link>
          <a href="https://docs.e-code.ai" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-docs">Docs</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="hidden md:inline-flex text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" data-testid="nav-login">Log in</Button>
          </Link>
          <Link href="/login?signup=true">
            <Button className="hidden md:inline-flex h-9 px-5 text-sm font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" data-testid="nav-signup">Sign up</Button>
          </Link>
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-hamburger"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 top-16 z-50 transition-all duration-300 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
        <div className={`absolute top-0 right-0 w-[280px] h-full bg-[var(--ide-bg)] border-l border-[var(--ide-border)]/50 flex flex-col transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
          <nav className="flex flex-col p-6 gap-2">
            <Link href="/pricing" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-pricing">Pricing</Link>
            <Link href="/demo" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-demo">Demo</Link>
            <a href="https://docs.e-code.ai" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="mobile-nav-docs">Docs</a>
            <div className="my-3 border-t border-[var(--ide-border)]/50" />
            <Link href="/login" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-login">Log in</Link>
            <Link href="/login?signup=true" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full h-11 text-[15px] font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl" data-testid="mobile-nav-signup">Sign up</Button>
            </Link>
          </nav>
        </div>
      </div>

      <section className="relative z-10 flex flex-col items-center pt-20 pb-16 px-6 lg:pt-28 lg:pb-24">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7C65CB]/10 border border-[#7C65CB]/20 text-[#7C65CB] text-xs font-medium mb-8" data-testid="badge-ai">
          <Sparkles className="w-3.5 h-3.5" />
          Now with AI Agent — build entire apps with a prompt
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-center max-w-4xl leading-[1.1] tracking-tight mb-6" data-testid="hero-title">
          Build software
          <br />
          <span className="bg-gradient-to-r from-[#0079F2] via-[#7C65CB] to-[#F26522] bg-clip-text text-transparent">faster with AI</span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--ide-text-secondary)] text-center max-w-2xl mb-10 leading-relaxed" data-testid="hero-subtitle">
          A cloud IDE with a powerful editor, AI coding agent, live terminal, instant deployment, and team collaboration. Write, run, and ship code from anywhere.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <Link href="/login?signup=true">
            <Button className="h-12 px-8 text-base font-semibold bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-xl shadow-[0_0_20px_rgba(12,206,107,0.3)] hover:shadow-[0_0_30px_rgba(12,206,107,0.4)] transition-all gap-2" data-testid="cta-signup">
              Start building for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" className="h-12 px-8 text-base font-medium bg-transparent border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F] rounded-xl gap-2" data-testid="cta-demo">
              <Play className="w-4 h-4" /> Try the demo
            </Button>
          </Link>
        </div>

        <p className="text-xs text-[var(--ide-text-muted)] mb-16">No credit card required. Free tier included.</p>

        <CodeDemo />
      </section>

      <section className="relative z-10 py-16 border-t border-[var(--ide-border)]/50">
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20 px-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[var(--ide-text)]" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>{s.value}</div>
              <div className="text-sm text-[var(--ide-text-muted)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6" data-testid="features-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to build</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg max-w-xl mx-auto">From idea to production in minutes. No setup, no configuration, just code.</p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="group p-6 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F] transition-all duration-300" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6 border-t border-[var(--ide-border)]/50" data-testid="languages-section">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">All your favorite languages</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg mb-12">First-class support for JavaScript, TypeScript, Python, Go, Ruby, Java, C++, Rust, and more.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { label: "JavaScript", color: "#F0DB4F", bg: "rgba(240,219,79,0.1)" },
              { label: "TypeScript", color: "#3178C6", bg: "rgba(49,120,198,0.1)" },
              { label: "Python", color: "#3572A5", bg: "rgba(53,114,165,0.1)" },
              { label: "Go", color: "#00ADD8", bg: "rgba(0,173,216,0.1)" },
              { label: "Ruby", color: "#CC342D", bg: "rgba(204,52,45,0.1)" },
              { label: "Java", color: "#ED8B00", bg: "rgba(237,139,0,0.1)" },
              { label: "C++", color: "#00599C", bg: "rgba(0,89,156,0.1)" },
              { label: "Rust", color: "#DEA584", bg: "rgba(222,165,132,0.1)" },
              { label: "HTML", color: "#E34F26", bg: "rgba(227,79,38,0.1)" },
              { label: "CSS", color: "#1572B6", bg: "rgba(21,114,182,0.1)" },
            ].map((lang) => (
              <div key={lang.label} className="px-4 py-2 rounded-lg border border-[var(--ide-border)] text-sm font-medium" style={{ background: lang.bg, color: lang.color, borderColor: `${lang.color}30` }}>
                {lang.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6 border-t border-[var(--ide-border)]/50" data-testid="cta-section">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to start building?</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg mb-10">Join thousands of developers building and deploying on E-Code.</p>
          <Link href="/login?signup=true">
            <Button className="h-14 px-10 text-lg font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl shadow-[0_0_20px_rgba(0,121,242,0.3)] hover:shadow-[0_0_30px_rgba(0,121,242,0.4)] transition-all gap-2" data-testid="cta-bottom-signup">
              Get started for free <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--ide-border)]/50 px-6 lg:px-12 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ECodeLogo size={20} />
              <span className="font-bold text-sm">E-Code</span>
            </div>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">Build, run, and deploy code from anywhere. The cloud IDE for modern developers.</p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-3">Product</h4>
            <div className="space-y-2">
              <Link href="/pricing" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Pricing</Link>
              <Link href="/demo" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Demo</Link>
              <a href="#" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Changelog</a>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-3">Resources</h4>
            <div className="space-y-2">
              <a href="#" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Documentation</a>
              <a href="#" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Blog</a>
              <a href="#" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Community</a>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-3">Legal</h4>
            <div className="space-y-2">
              <Link href="/terms" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Privacy Policy</Link>
              <a href="mailto:support@e-code.ai" className="block text-sm text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors">Contact</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[var(--ide-border)]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--ide-text-muted)]">&copy; {new Date().getFullYear()} E-Code. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"><Github className="w-4 h-4" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
