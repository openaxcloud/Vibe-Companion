import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Github, Play, Terminal, Code2, Sparkles, Globe, Users, Zap, Shield, ArrowRight, ChevronRight, ChevronLeft, Eye, Menu, X, Send, Loader2, Smartphone, Presentation, Palette, BarChart3, Gamepad2, Cog, PenTool, Table2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import LZString from "lz-string";

function ECodeLogo({ size = 32 }: { size?: number }) {
  return (
    <img src="/logo.png" alt="E-Code" width={size} height={size} className="rounded" style={{ objectFit: 'contain' }} />
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

const typewriterPrompts = [
  "Build a project tracker for my team",
  "Design a landing page for my coffee shop",
  "Add Stripe payments to my app",
  "Create a fitness dashboard with charts",
  "Build a recipe sharing community",
  "Make an interactive data visualization",
];

const OUTPUT_TYPE_OPTIONS = [
  { id: "web", label: "Web", icon: Globe },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "slides", label: "Slides", icon: Presentation },
  { id: "animation", label: "Animation", icon: Play },
  { id: "design", label: "Design", icon: Palette },
  { id: "data-visualization", label: "Data Viz", icon: BarChart3 },
  { id: "automation", label: "Automation", icon: Cog },
  { id: "3d-game", label: "3D Game", icon: Gamepad2 },
  { id: "document", label: "Document", icon: PenTool },
  { id: "spreadsheet", label: "Spreadsheet", icon: Table2 },
];

function useTypewriter(texts: string[], typingSpeed = 50, pauseMs = 2000) {
  const [display, setDisplay] = useState("");
  const [index, setIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const text = texts[index];
    if (!deleting && charIndex < text.length) {
      const t = setTimeout(() => { setDisplay(text.slice(0, charIndex + 1)); setCharIndex(charIndex + 1); }, typingSpeed);
      return () => clearTimeout(t);
    } else if (!deleting && charIndex === text.length) {
      const t = setTimeout(() => setDeleting(true), pauseMs);
      return () => clearTimeout(t);
    } else if (deleting && charIndex > 0) {
      const t = setTimeout(() => { setDisplay(text.slice(0, charIndex - 1)); setCharIndex(charIndex - 1); }, typingSpeed / 2);
      return () => clearTimeout(t);
    } else if (deleting && charIndex === 0) {
      setDeleting(false);
      setIndex((index + 1) % texts.length);
    }
  }, [charIndex, deleting, index, texts, typingSpeed, pauseMs]);

  return display;
}

function PromptInput({ onSubmit, isLoading, defaultPrompt, defaultOutputType }: { onSubmit: (prompt: string, outputType: string) => void; isLoading: boolean; defaultPrompt?: string; defaultOutputType?: string }) {
  const [prompt, setPrompt] = useState(defaultPrompt || "");
  const [selectedType, setSelectedType] = useState<string | null>(defaultOutputType || null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const typewriterText = useTypewriter(typewriterPrompts);

  useEffect(() => {
    if (defaultPrompt && defaultPrompt !== prompt) {
      setPrompt(defaultPrompt);
    }
  }, [defaultPrompt]);

  useEffect(() => {
    if (defaultOutputType && defaultOutputType !== selectedType) {
      setSelectedType(defaultOutputType);
    }
  }, [defaultOutputType]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed, selectedType || "web");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all focus-within:border-[#0079F2]/50 focus-within:shadow-[0_8px_32px_rgba(0,121,242,0.15)]">
        {selectedType && (
          <div className="px-5 pt-4 pb-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-[11px] font-medium" data-testid="badge-output-type">
              {OUTPUT_TYPE_OPTIONS.find(t => t.id === selectedType)?.label || selectedType}
              <button onClick={() => setSelectedType(null)} className="ml-1 hover:text-white transition-colors" data-testid="button-remove-output-type">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={prompt ? "What do you want to build?" : typewriterText || "What do you want to build?"}
          rows={2}
          className="w-full bg-transparent text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] resize-none px-5 pt-4 pb-3 text-[15px] leading-relaxed outline-none"
          data-testid="input-prompt"
        />
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" />
            <span className="text-[11px] text-[var(--ide-text-muted)]">AI-powered</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-medium bg-[#0079F2] hover:bg-[#006AD8] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            data-testid="button-prompt-submit"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Build
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-5 relative" data-testid="output-type-carousel">
        <button
          onClick={() => scrollCarousel("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F] transition-all shadow-md -ml-3"
          data-testid="button-carousel-left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={carouselRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-6 scroll-smooth">
          {OUTPUT_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedType(isSelected ? null : opt.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
                  isSelected
                    ? "bg-[#0079F2]/10 border-[#0079F2]/30 text-[#0079F2]"
                    : "bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F]"
                }`}
                data-testid={`button-output-type-${opt.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scrollCarousel("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F] transition-all shadow-md -mr-3"
          data-testid="button-carousel-right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
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
  { value: "—", label: "Languages" },
  { value: "—", label: "AI Models" },
  { value: "—", label: "Developers" },
  { value: "—", label: "Projects" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  const [incomingPrompt, setIncomingPrompt] = useState<string | null>(null);
  const [incomingStack, setIncomingStack] = useState<string | null>(null);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const compressedPrompt = params.get("prompt");
    const stack = params.get("stack");
    const referrer = params.get("referrer");

    if (referrer) {
      sessionStorage.setItem("ecode_referrer", referrer);
    }

    if (stack && stack !== "design" && stack !== "build") {
      setIncomingError(`Invalid stack mode "${stack}". Expected "design" or "build".`);
      return;
    }

    if (compressedPrompt) {
      if (compressedPrompt.length > 10000) {
        setIncomingError("The prompt parameter is too large. The link may be invalid.");
        return;
      }
      const decompressed = LZString.decompressFromEncodedURIComponent(compressedPrompt);
      if (!decompressed) {
        setIncomingError("Failed to decompress the prompt. The link may be malformed or truncated.");
        return;
      }
      setIncomingPrompt(decompressed);
      setIncomingStack(stack || "build");
    } else if (stack) {
      setIncomingStack(stack);
    }
  }, []);

  const handlePromptSubmit = async (prompt: string, outputType: string = "web") => {
    setPromptLoading(true);
    try {
      const res = await apiRequest("POST", "/api/projects", {
        name: prompt.slice(0, 50),
        language: "javascript",
        outputType,
      });
      const project = await res.json();
      setLocation(`/project/${project.id}?prompt=${encodeURIComponent(prompt)}&outputType=${outputType}`);
    } catch {
      setLocation(`/login?prompt=${encodeURIComponent(prompt)}&outputType=${outputType}`);
    } finally {
      setPromptLoading(false);
    }
  };

  const statsQuery = useQuery<{ value: string; label: string }[]>({
    queryKey: ["/api/landing-stats"],
    staleTime: 60000,
  });
  const stats = statsQuery.data || defaultStats;

  useEffect(() => {
    if (isAuthenticated && !incomingPrompt && !incomingError) setLocation("/dashboard");
  }, [isAuthenticated, setLocation, incomingPrompt, incomingError]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && !incomingPrompt && !incomingError) return null;

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-x-hidden" data-testid="landing-page">
      <AnimatedGrid />

      {incomingError && (
        <div className="relative z-20 bg-red-500/10 border-b border-red-500/20 px-6 py-3" role="alert" aria-live="assertive" data-testid="banner-incoming-error">
          <div className="max-w-3xl mx-auto flex items-center gap-3 text-sm text-red-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {incomingError}
          </div>
        </div>
      )}

      {incomingPrompt && !isAuthenticated && (
        <div className="relative z-20 bg-[#0079F2]/10 border-b border-[#0079F2]/20 px-6 py-3" data-testid="banner-incoming-prompt">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-[#0079F2] min-w-0">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="truncate">Prompt ready: "{incomingPrompt.slice(0, 80)}{incomingPrompt.length > 80 ? "..." : ""}"</span>
            </div>
            <Link href={`/login?prompt=${encodeURIComponent(incomingPrompt)}&outputType=${incomingStack === "design" ? "design" : "web"}`}>
              <Button className="h-8 px-4 text-xs font-medium bg-[#0079F2] hover:bg-[#006AD8] text-white rounded-lg whitespace-nowrap" data-testid="button-signin-to-build">
                Sign up to build
              </Button>
            </Link>
          </div>
        </div>
      )}

      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 h-16 border-b border-[var(--ide-border)]/50 bg-[var(--ide-bg)]" role="navigation" aria-label="Main navigation">
        <div className="flex items-center gap-3">
          <ECodeLogo size={28} />
          <span className="text-lg font-bold tracking-tight">E-Code</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Link href="/features" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-features">Features</Link>
          <Link href="/pricing" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-pricing">Pricing</Link>
          <Link href="/solutions/enterprise" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-enterprise">Enterprise</Link>
          <Link href="/explore" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-explore">Explore</Link>
          <Link href="/docs" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-docs">Docs</Link>
          <Link href="/blog" className="px-3 py-2 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="nav-blog">Blog</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="hidden md:inline-flex text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" data-testid="nav-login">Log in</Button>
          </Link>
          <Link href="/login">
            <Button className="hidden md:inline-flex h-9 px-5 text-sm font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" data-testid="nav-signup">Sign up</Button>
          </Link>
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            data-testid="button-mobile-hamburger"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`md:hidden fixed inset-0 top-16 z-50 transition-all duration-300 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
        <div className={`absolute top-0 right-0 w-[280px] h-full bg-[var(--ide-bg)] border-l border-[var(--ide-border)]/50 flex flex-col transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
          <nav className="flex flex-col p-6 gap-2">
            <Link href="/features" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-features">Features</Link>
            <Link href="/pricing" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-pricing">Pricing</Link>
            <Link href="/solutions/enterprise" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-enterprise">Enterprise</Link>
            <Link href="/explore" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-explore">Explore</Link>
            <Link href="/docs" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-docs">Docs</Link>
            <Link href="/blog" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-blog">Blog</Link>
            <div className="my-3 border-t border-[var(--ide-border)]/50" />
            <Link href="/login" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-login">Log in</Link>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
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

        <PromptInput onSubmit={handlePromptSubmit} isLoading={promptLoading} defaultPrompt={incomingPrompt || undefined} defaultOutputType={incomingStack === "design" ? "design" : undefined} />

        <p className="text-xs text-[var(--ide-text-muted)] mt-6 mb-12">No credit card required. Free tier included.</p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link href="/login">
            <Button className="h-11 px-7 text-sm font-semibold bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-xl shadow-[0_0_20px_rgba(12,206,107,0.3)] hover:shadow-[0_0_30px_rgba(12,206,107,0.4)] transition-all gap-2 btn-premium" data-testid="cta-signup">
              Start building for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" className="h-11 px-7 text-sm font-medium bg-transparent border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F] rounded-xl gap-2" data-testid="cta-demo">
              <Play className="w-4 h-4" /> Try the demo
            </Button>
          </Link>
        </div>

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
            <div key={f.title} className="group p-6 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F] transition-all duration-300 card-premium" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
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
          <div className="flex flex-wrap items-center justify-center gap-5">
            {[
              { label: "JavaScript", color: "#F0DB4F", bg: "rgba(240,219,79,0.1)", logo: <svg viewBox="0 0 256 256" className="w-7 h-7"><rect width="256" height="256" fill="#F7DF1E" rx="12"/><path d="M67.3 213.9l19.1-11.6c3.7 6.5 7 12 15.1 12 7.7 0 12.6-3 12.6-14.8V119h23.5v81.2c0 24.4-14.3 35.5-35.2 35.5-18.9 0-29.8-9.8-35.1-21.6m83.2-2.6l19.1-11.1c5 8.3 11.6 14.3 23.2 14.3 9.8 0 16-4.9 16-11.6 0-8.1-6.4-10.9-17.2-15.6l-5.9-2.5c-17-7.2-28.3-16.3-28.3-35.5 0-17.7 13.5-31.1 34.5-31.1 15 0 25.8 5.2 33.5 18.9l-18.4 11.8c-4-7.2-8.4-10.1-15.1-10.1-6.9 0-11.2 4.4-11.2 10.1 0 7 4.4 9.9 14.5 14.3l5.9 2.5c20.1 8.6 31.3 17.4 31.3 37.1 0 21.2-16.7 32.9-39.1 32.9-21.9 0-36.1-10.4-43-24" fill="#000"/></svg> },
              { label: "TypeScript", color: "#3178C6", bg: "rgba(49,120,198,0.1)", logo: <svg viewBox="0 0 256 256" className="w-7 h-7"><rect width="256" height="256" fill="#3178C6" rx="12"/><path d="M150.5 200.5V228c4.6 2.4 10.1 4.1 16.3 5.3 6.2 1.2 12.7 1.7 19.6 1.7 6.7 0 13.1-.6 19-1.9 6-1.3 11.2-3.4 15.7-6.5 4.5-3 8-7 10.6-11.9 2.6-4.9 3.9-10.8 3.9-17.8 0-5-0.8-9.4-2.4-13.3-1.6-3.8-3.9-7.2-6.8-10.2-2.9-3-6.3-5.7-10.3-8-4-2.4-8.3-4.6-13.1-6.6-3.5-1.5-6.6-2.9-9.3-4.3-2.7-1.4-4.9-2.8-6.8-4.3-1.9-1.5-3.3-3.1-4.2-4.8-.9-1.7-1.4-3.7-1.4-5.9 0-2.1.5-4 1.3-5.6.9-1.7 2.2-3.1 3.8-4.3 1.7-1.2 3.7-2.1 6.1-2.7 2.4-.6 5.1-.9 8.1-.9 2.1 0 4.4.2 6.8.5 2.4.4 4.8.9 7.3 1.7 2.4.8 4.8 1.7 7 2.9 2.2 1.2 4.2 2.5 5.9 4.1V113c-4.1-1.7-8.6-3-13.5-3.8-4.9-.9-10.5-1.3-16.8-1.3-6.7 0-12.9.7-18.7 2.1-5.8 1.4-10.9 3.6-15.2 6.6-4.3 3-7.7 6.8-10.1 11.5-2.5 4.6-3.7 10.1-3.7 16.3 0 8.4 2.5 15.5 7.5 21.3 5 5.8 12.5 10.7 22.5 14.8 3.6 1.5 7 3 10.1 4.5 3.1 1.5 5.8 3 8 4.6 2.3 1.6 4 3.3 5.3 5.2 1.3 1.9 1.9 4 1.9 6.5 0 2-.4 3.8-1.2 5.5-.8 1.6-2 3-3.6 4.2-1.6 1.1-3.6 2-6 2.6-2.3.6-5.1.9-8.2.9-5.3 0-10.7-1-16.2-3-5.5-2-10.6-5.1-15.3-9.3zM100 115h30v-22H42v22h30v113h28V115z" fill="#FFF"/></svg> },
              { label: "Python", color: "#3572A5", bg: "rgba(53,114,165,0.1)", logo: <svg viewBox="0 0 256 255" className="w-7 h-7"><defs><linearGradient id="py1" x1="12.96%" x2="79.67%" y1="12.04%" y2="93.3%"><stop offset="0%" stopColor="#387EB8"/><stop offset="100%" stopColor="#366994"/></linearGradient><linearGradient id="py2" x1="19.13%" x2="90.43%" y1="20.58%" y2="88.35%"><stop offset="0%" stopColor="#FFE052"/><stop offset="100%" stopColor="#FFC331"/></linearGradient></defs><path d="M126.9.1C62.5.1 66.7 28.2 66.7 28.2l.1 29.2h61.3v8.7H39.9S0 61.5 0 126.6c0 65.1 34.9 62.8 34.9 62.8h20.8v-30.2s-1.1-34.9 34.4-34.9h59.2s33.2.5 33.2-32.1V33.3S187.5.1 126.9.1zm-33 19.2c5.9 0 10.7 4.8 10.7 10.7s-4.8 10.7-10.7 10.7-10.7-4.8-10.7-10.7 4.8-10.7 10.7-10.7z" fill="url(#py1)"/><path d="M128.8 254.1c64.4 0 60.2-28.1 60.2-28.1l-.1-29.2h-61.3v-8.7h88.2s39.9 4.6 39.9-60.5c0-65.1-34.9-62.8-34.9-62.8h-20.8v30.2s1.1 34.9-34.4 34.9h-59.2s-33.2-.5-33.2 32.1v58.9s-5 28.2 55.6 28.2zm33-19.2c-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7 10.7 4.8 10.7 10.7-4.8 10.7-10.7 10.7z" fill="url(#py2)"/></svg> },
              { label: "Go", color: "#00ADD8", bg: "rgba(0,173,216,0.1)", logo: <svg viewBox="0 0 256 108" className="w-8 h-7"><path d="M21.6 48.2s-.3.4.2.5c4 3.4 8.3 5.4 13 6 6.3.8 12.5.2 18.5-2.3.3-.1.6-.4.7-.8-2.1-.4-4.1-.6-6-.9-5.3-.7-10.2-2.3-14.6-5.1-1.8-1.2-3.4-2.6-4.8-4.2-.2-.2-.4-.3-.7-.3-.2.2-.3.4-.4.6-2.2 2.6-3.9 5.6-5.9 8.5l.2.2-.2-.2z" fill="#00ADD8"/><path d="M203 39.5c-3.3-1.5-6.8-2.2-10.5-2.2-1.8 0-3.5.2-5.3.5-8.5 1.7-14.7 6.3-18.7 13.8-3.4 6.3-4.2 13.1-2.8 20.2 1.3 6.4 4.4 11.7 9.7 15.5 4.3 3.2 9.2 4.7 14.6 4.7 1.2 0 2.4-.1 3.7-.2 6.8-.9 12.4-3.9 16.9-9.1 3.8-4.5 5.9-9.7 6.7-15.5 1-7.3-.1-14.2-3.9-20.5-2.8-4.8-6.8-7.9-12-9.9-.2-.1-.3-.1-.5-.2l.1-.1zm6.2 32.3c-.8 4.1-2.4 7.8-5.3 10.9-3.8 4.1-8.6 5.8-14.1 5.2-5-.5-9-3-11.8-7.3-2.8-4.3-3.7-9.1-3.4-14.2.3-4.8 1.7-9.1 4.7-12.9 3.3-4.1 7.6-6.2 12.8-6.3 4.5 0 8.4 1.5 11.6 4.7 3.9 3.9 5.6 8.7 6 14 .1 1.9-.1 3.9-.5 5.9z" fill="#00ADD8"/><path d="M133.5 39.6c-3.4-.8-6.8-1-10.3-.7-7.5.8-13.8 3.9-18.7 9.5-4.4 5-6.8 10.9-7.4 17.6-.5 5.7.3 11.2 2.8 16.3 3 6 7.7 10 14 12 3.4 1.1 6.9 1.4 10.5 1 6.1-.6 11.4-3 15.8-7.4 4.3-4.3 6.8-9.5 7.9-15.5 1-5.5.7-10.9-1.1-16.2-2.2-6.2-6-10.9-11.7-14-1.3-.7-2.5-1.3-3.8-1.7l.1-.1.1-.1-.2.1v.1zm7.3 32.1c-.8 4.2-2.5 7.9-5.4 11-3.8 4-8.5 5.7-14 5.1-5-.5-8.9-3-11.6-7.2-2.9-4.5-3.8-9.4-3.4-14.6.3-4.8 1.8-9.2 4.8-12.9 3.3-4.1 7.5-6.1 12.7-6.2 4.4 0 8.3 1.5 11.5 4.6 3.7 3.6 5.5 8.2 6 13.3.3 2.4.1 4.6-.5 6.9h-.1z" fill="#00ADD8"/><path d="M70.3 60.9c-.1-5.2-.9-10-3.3-14.5C63 39.1 56.6 35.4 48.3 34.6c-2.4-.2-4.8-.1-7.1.4-8.6 1.6-14.9 6.4-18.8 14.1-2.8 5.5-3.7 11.4-3.1 17.6.5 4.7 1.9 9.1 4.5 13 3.5 5.4 8.4 8.8 14.5 10.4 3.8 1 7.7 1 11.5.2 6.1-1.3 10.9-4.6 14.5-9.6 3.3-4.5 5.3-9.6 5.9-15.3.2-1.6.2-3 .1-4.5zm-8.4 6.7c-.8 4.1-2.4 7.7-5.3 10.8-3.9 4.2-8.7 5.8-14.3 5.2-4.9-.6-8.8-3-11.5-7.2-2.9-4.5-3.8-9.4-3.4-14.6.3-4.8 1.8-9.1 4.8-12.8 3.3-4.1 7.6-6.2 12.7-6.3 4.5 0 8.4 1.5 11.6 4.6 3.7 3.6 5.5 8.2 6 13.3.2 2.5 0 4.7-.6 7z" fill="#00ADD8"/><path d="M240.1 72.7c-1.4-.2-2.7-.3-4-.5-.3 0-.5-.1-.8-.2-5-.8-9.6-2.4-13.6-5.5-.6-.5-1.2-1-1.8-1.6-.1-.1-.2-.3-.4-.3-.2.1-.2.3-.3.5-1.2 2.6-2.5 5.2-3.7 7.8-.1.3-.3.5-.4.8.1.2.3.3.5.4 3.5 2.9 7.5 4.8 11.9 6 3.9 1.1 7.9 1.4 11.9 1.2.2 0 .4 0 .6-.1v-8.5h.1z" fill="#00ADD8"/></svg> },
              { label: "Ruby", color: "#CC342D", bg: "rgba(204,52,45,0.1)", logo: <svg viewBox="0 0 256 256" className="w-7 h-7"><path d="M212.1 241.1L52.5 254.1L1 196.4L25.6 95.5L84.7 1.3L172.1 26.2L254.5 107.7L228.3 185.1L212.1 241.1Z" fill="#CC342D"/><path d="M212.1 241.1L163 219.9L188.3 182L212.1 241.1Z" fill="#B12725"/><path d="M212.1 241.1L102.9 238.5L94.8 199.3L212.1 241.1Z" fill="#B12725"/><path d="M84.7 1.3L90.9 102.8L25.6 95.5L84.7 1.3Z" fill="#E8453C"/><path d="M172.1 26.2L156.7 114L90.9 102.8L172.1 26.2Z" fill="#E8453C"/></svg> },
              { label: "Java", color: "#ED8B00", bg: "rgba(237,139,0,0.1)", logo: <svg viewBox="0 0 256 346" className="w-6 h-7"><path d="M83 267s-14 8 9 11c28 3 42 3 72-4 0 0 8 5 19 9-68 29-153-2-100-16" fill="#5382A1"/><path d="M74 230s-15 11 8 14c29 3 53 3 93-5 0 0 6 5 14 8-82 24-173 2-115-17" fill="#5382A1"/><path d="M144 166c16 19-4 36-4 36s42-22 23-49c-18-25-32-38 43-81 0 0-118 30-62 94" fill="#E76F00"/><path d="M233 295s10 8-11 15c-40 12-168 16-203 0-13-6 11-13 18-15 8-2 12-1 12-1-14-10-90 19-39 27 141 22 256-10 223-26" fill="#5382A1"/><path d="M95 190s-64 15-23 21c17 2 52 2 84-1 26-3 53-8 53-8s-9 4-16 8c-64 17-188 9-152-8 30-15 54-12 54-12" fill="#5382A1"/><path d="M202 253c65-34 35-66 14-62-5 1-7 2-7 2s2-3 6-4c40-14 71 42-14 64 0 0 1-1 1-0" fill="#5382A1"/><path d="M162 0s36 36-34 91c-56 44-13 69 0 98-33-30-57-56-41-81 24-37 90-55 75-108" fill="#E76F00"/><path d="M95 346c63 4 159-2 161-33 0 0-4 11-52 20-53 10-119 9-158 2 0 0 8 7 49 11" fill="#5382A1"/></svg> },
              { label: "C++", color: "#00599C", bg: "rgba(0,89,156,0.1)", logo: <svg viewBox="0 0 256 288" className="w-7 h-7"><path d="M255.6 143.5c0-10.8-4.3-20.7-12.6-29.3L146.7 8.7C138.4.4 128.6-3.9 117.9 2 113.4 4.3 68 42.4 19 81.4 7.3 91.4 0 103.5 0 116.5v55c0 13 7.3 25.1 19 35.1 49 39 94.4 77.1 98.9 79.4 10.7 5.9 20.5 1.6 28.8-6.7L243 174.8c8.3-8.6 12.6-18.5 12.6-29.3v-2z" fill="#00599C"/><path d="M128.1 22.4L256 143.5 128.1 264.6.2 143.5 128.1 22.4z" fill="#004482"/><path d="M128.1 22.4l63.9 60.5-63.9 60.6V22.4z" fill="#00599C"/><circle cx="128.1" cy="143.5" r="68.5" fill="#FFF"/><circle cx="128.1" cy="143.5" r="55.1" fill="#00599C"/><path d="M100 122h12v43H100V122zm0 15.8h39v11.4h-39v-11.4z" fill="#FFF"/><path d="M184 130h8v27h-8v-27zm-4 9.5h16v8h-16v-8z" fill="#FFF"/><path d="M208 130h8v27h-8v-27zm-4 9.5h16v8h-16v-8z" fill="#FFF"/></svg> },
              { label: "Rust", color: "#DEA584", bg: "rgba(222,165,132,0.1)", logo: <svg viewBox="0 0 256 256" className="w-7 h-7"><circle cx="128" cy="128" r="128" fill="#000"/><path d="M248.3 128a120.3 120.3 0 11-240.6 0 120.3 120.3 0 01240.6 0" fill="#000"/><path d="M134.7 16.8l6.8 11.8a3 3 0 003.4 1.5l13-3.1a3 3 0 013.5 3.6l-2.8 13.1a3 3 0 001.7 3.3l12 6.5a3 3 0 011 4.9l-9.3 9.6a3 3 0 00-.4 3.7l6.8 11.6a3 3 0 01-2 4.4l-13.2 2.4a3 3 0 00-2.5 2.6l-2 13.3a3 3 0 01-4.2 2.3l-12.2-6a3 3 0 00-3.7.5l-9.3 9.8a3 3 0 01-4.9-.7l-6.2-12.2a3 3 0 00-3.4-1.6l-13.1 2.5a3 3 0 01-3.4-3.8l3.2-13a3 3 0 00-1.5-3.3l-12.2-6a3 3 0 01-.8-5l9.6-9.2a3 3 0 00.6-3.7L82 67.7a3 3 0 012.1-4.3l13.3-2a3 3 0 002.5-2.7l1.6-13.3a3 3 0 014.3-2.2l12 6.4a3 3 0 003.6-.7l9.7-9.4a3 3 0 014.8.9z" fill="#DEA584"/><path d="M128 48a80 80 0 100 160 80 80 0 000-160zm0 12c5.3 0 10.4.6 15.3 1.8l-8.7 15.6H99.3l-14-11.6A68 68 0 01128 60zm-40 18.5l14.2 11.8-4.5 18.5-17.3 6.4-14.2-8.8A67 67 0 0188 78.5zm-23.3 36l14 8.6 1 18.7-13 12.8-16.4-1a67 67 0 013-22c3.4-6.2 7-11.9 11.4-17.1zm22.7 54.9l-.7-17.5 15.3-10.5h17.8l15.3 10.5-.7 17.5-13.7 11.5c-3.4.4-7 .6-10.5.6-3.5 0-7-.2-10.5-.6l-12.3-11.5zm75.9 2l-10.8-9-4.5-18.5 14.2-11.8 16 5.7a67 67 0 01-4.6 22.6l-10.3 11zm12.5-44l-17.3-6.4-4.5-18.5 14.2-11.8a67 67 0 0118.5 23.9l-10.9 12.8z" fill="#FFF"/></svg> },
              { label: "HTML", color: "#E34F26", bg: "rgba(227,79,38,0.1)", logo: <svg viewBox="0 0 256 361" className="w-6 h-7"><path d="M255.6 70.8L232.4 325.8 127.7 360.6 23.3 325.9 0 70.8H255.6Z" fill="#E44D26"/><path d="M128 337.9L212.4 314.6 232.3 91.2H128V337.9Z" fill="#F16529"/><path d="M128 155.4H82.8L79.8 121.7H128V88.3H43.4L44.2 97.5 52.9 193.8H128V155.4Z" fill="#EBEBEB"/><path d="M128 245L127.9 245 93.6 235.7 91.4 211.3H57.9L62.2 259.6 127.9 277.9 128 277.9V245Z" fill="#EBEBEB"/><path d="M128 193.8V227.1L166 237.7 169.2 211.3H128V193.8Z" fill="#FFF"/><path d="M128 88.3V121.7H209.4L208.6 130.5 200.9 193.8H128V227.1L189.5 227.1 190.3 218.8 197.9 130.5 198.7 121.7 209.4 121.7 210.2 88.3H128Z" fill="#FFF"/></svg> },
              { label: "CSS", color: "#1572B6", bg: "rgba(21,114,182,0.1)", logo: <svg viewBox="0 0 256 361" className="w-6 h-7"><path d="M127.8 360.6L23.3 325.9 0 70.8H255.6L232.4 325.8 127.8 360.6Z" fill="#264DE4"/><path d="M212.4 314.6L232.3 91.2H128V337.9L212.4 314.6Z" fill="#2965F1"/><path d="M53 193.8L56.9 237.1L127.9 258.5V224.3L93.6 214.7L91.3 190.6H127.9V155.4H84.8L81.8 121.7H127.9V88.3H43.4L53 193.8Z" fill="#EBEBEB"/><path d="M128 155.4V193.8H168.3L164.2 237.1L128 248.5V282.8L199 258.5L199.5 252.9L205.9 183.1L206.6 175.6L210.2 121.7H128V155.4Z" fill="#FFF"/></svg> },
            ].map((lang) => (
              <div key={lang.label} className="flex flex-col items-center gap-2 px-5 py-3 rounded-xl border border-[var(--ide-border)] hover:border-[color:var(--hover-border)] hover:scale-105 transition-all duration-200 cursor-default" style={{ background: lang.bg, ["--hover-border" as any]: `${lang.color}50` }}>
                {lang.logo}
                <span className="text-xs font-medium" style={{ color: lang.color }}>{lang.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6 border-t border-[var(--ide-border)]/50" data-testid="cta-section">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to start building?</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg mb-10">Join thousands of developers building and deploying on E-Code.</p>
          <Link href="/login">
            <Button className="h-14 px-10 text-lg font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl shadow-[0_0_20px_rgba(0,121,242,0.3)] hover:shadow-[0_0_30px_rgba(0,121,242,0.4)] transition-all gap-2 btn-premium" data-testid="cta-bottom-signup">
              Get started for free <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--ide-border)]/50 bg-[var(--ide-bg)] px-6 lg:px-12 py-16" role="contentinfo" data-testid="landing-footer">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ECodeLogo size={20} />
              <span className="font-bold text-sm">E-Code</span>
            </div>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">Build software faster with AI. Cloud IDE for everyone.</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] mb-3">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-[var(--ide-text-secondary)]">
              <Link href="/features" className="hover:text-[var(--ide-text)] transition-colors">Features</Link>
              <Link href="/pricing" className="hover:text-[var(--ide-text)] transition-colors">Pricing</Link>
              <Link href="/languages" className="hover:text-[var(--ide-text)] transition-colors">Languages</Link>
              <Link href="/marketplace" className="hover:text-[var(--ide-text)] transition-colors">Marketplace</Link>
              <Link href="/security" className="hover:text-[var(--ide-text)] transition-colors">Security</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] mb-3">Solutions</h4>
            <div className="flex flex-col gap-2 text-sm text-[var(--ide-text-secondary)]">
              <Link href="/solutions/enterprise" className="hover:text-[var(--ide-text)] transition-colors">Enterprise</Link>
              <Link href="/solutions/startups" className="hover:text-[var(--ide-text)] transition-colors">Startups</Link>
              <Link href="/solutions/freelancers" className="hover:text-[var(--ide-text)] transition-colors">Freelancers</Link>
              <Link href="/education" className="hover:text-[var(--ide-text)] transition-colors">Education</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] mb-3">Resources</h4>
            <div className="flex flex-col gap-2 text-sm text-[var(--ide-text-secondary)]">
              <Link href="/docs" className="hover:text-[var(--ide-text)] transition-colors">Documentation</Link>
              <Link href="/blog" className="hover:text-[var(--ide-text)] transition-colors">Blog</Link>
              <Link href="/learn" className="hover:text-[var(--ide-text)] transition-colors">Learn</Link>
              <Link href="/support" className="hover:text-[var(--ide-text)] transition-colors">Support</Link>
              <Link href="/status" className="hover:text-[var(--ide-text)] transition-colors">Status</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] mb-3">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-[var(--ide-text-secondary)]">
              <Link href="/about" className="hover:text-[var(--ide-text)] transition-colors">About</Link>
              <Link href="/careers" className="hover:text-[var(--ide-text)] transition-colors">Careers</Link>
              <Link href="/press" className="hover:text-[var(--ide-text)] transition-colors">Press</Link>
              <Link href="/contact" className="hover:text-[var(--ide-text)] transition-colors">Contact</Link>
              <Link href="/partners" className="hover:text-[var(--ide-text)] transition-colors">Partners</Link>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-6 border-t border-[var(--ide-border)]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ide-text-muted)]">
            <span>&copy; {new Date().getFullYear()} E-Code. All rights reserved.</span>
            <Link href="/terms" className="hover:text-[var(--ide-text)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--ide-text)] transition-colors">Privacy</Link>
            <Link href="/dpa" className="hover:text-[var(--ide-text)] transition-colors">DPA</Link>
            <Link href="/accessibility" className="hover:text-[var(--ide-text)] transition-colors">Accessibility</Link>
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"><Github className="w-4 h-4" /></a>
        </div>
      </footer>
    </div>
  );
}
