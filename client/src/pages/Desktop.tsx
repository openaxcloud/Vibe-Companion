import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Monitor, Apple, Download, ChevronDown, ChevronUp, Keyboard, Layout, RefreshCw, Zap, Shield, Github, Menu, X } from "lucide-react";

function ECodeLogo({ size = 32 }: { size?: number }) {
  return (
    <img src="/logo.png" alt="E-Code" width={size} height={size} className="rounded" style={{ objectFit: 'contain' }} />
  );
}

function detectOS(): "mac" | "win" | "linux" {
  if (typeof navigator === "undefined") return "mac";
  const ua = navigator.userAgent.toLowerCase();
  interface NavigatorUAData { platform?: string }
  const uaData = "userAgentData" in navigator ? (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData : undefined;
  const platform = uaData?.platform?.toLowerCase() || navigator.platform?.toLowerCase() || "";
  if (platform.includes("mac") || ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (platform.includes("win") || ua.includes("windows")) return "win";
  return "linux";
}

const platformInfo = {
  mac: { label: "macOS", icon: Apple, ext: ".dmg", fileName: "E-Code.dmg", minReq: "macOS 10.15 (Catalina) or later" },
  win: { label: "Windows", icon: Monitor, ext: ".exe", fileName: "E-Code-Setup.exe", minReq: "Windows 10 or later (64-bit)" },
  linux: { label: "Linux", icon: Monitor, ext: ".AppImage", fileName: "E-Code.AppImage", minReq: "Ubuntu 20.04, Fedora 33, or equivalent" },
};

const features = [
  { icon: Layout, title: "Focused Environment", desc: "Distraction-free coding with a dedicated desktop window. No browser tabs competing for your attention." },
  { icon: Keyboard, title: "Native Shortcuts", desc: "Full keyboard shortcut support without browser conflicts. Cmd/Ctrl+Q, Cmd/Ctrl+R, and all your favorites." },
  { icon: RefreshCw, title: "Auto Updates", desc: "Always stay on the latest version. The app updates automatically in the background with zero downtime." },
  { icon: Zap, title: "Complete Toolset", desc: "All E-Code features: AI agent, live terminal, real-time collaboration, instant deploy, and more." },
  { icon: Shield, title: "Secure & Private", desc: "Secure IPC communication, Content Security Policy headers, and sandboxed rendering for safety." },
  { icon: Monitor, title: "Window Persistence", desc: "Your window size and position are remembered between sessions. Pick up right where you left off." },
];

const faqs = [
  { q: "Is the desktop app free?", a: "Yes, the E-Code desktop app is completely free to download and use. Your E-Code account plan determines which features are available." },
  { q: "Does it work offline?", a: "The desktop app requires an internet connection to access your projects and use the AI features. However, it provides a more stable connection than a browser tab." },
  { q: "How do auto-updates work?", a: "The app checks for updates on launch and periodically in the background. When an update is available, it downloads automatically and installs on the next restart." },
  { q: "Can I use the web version and desktop app at the same time?", a: "Yes, you can use both simultaneously. Your projects sync in real-time across all clients." },
  { q: "What about code signing?", a: "macOS and Windows builds are code-signed. On macOS, if you see a warning, right-click and select Open. On Linux, make the AppImage executable with chmod +x." },
];

export default function Desktop() {
  const [detectedOS] = useState<"mac" | "win" | "linux">(detectOS);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const releaseQuery = useQuery<{ version: string | null; changelog?: string; platforms: Record<string, { downloadUrl: string; fileSize: number | null; sha256: string | null }> }>({
    queryKey: ["/api/desktop/releases/latest"],
    staleTime: 60000,
  });

  const release = releaseQuery.data;
  const hasRelease = release?.version != null;
  const hasPlatformBinary = hasRelease && !!release?.platforms[detectedOS]?.downloadUrl;

  const handleDownload = async (platform: string) => {
    if (!release?.version) return;
    try {
      await fetch("/api/desktop/downloads/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, version: release.version }),
      });
    } catch {}
    const url = release.platforms[platform]?.downloadUrl;
    if (url) window.open(url, "_blank");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)] overflow-x-hidden" data-testid="desktop-page">
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 h-16 border-b border-[var(--ide-border)]/50 bg-[var(--ide-bg)]">
        <Link href="/" className="flex items-center gap-3">
          <ECodeLogo size={28} />
          <span className="text-lg font-bold tracking-tight">E-Code</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/demo" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-ai">AI</Link>
          <Link href="/teams" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-teams">Teams</Link>
          <Link href="/desktop" className="text-sm text-[var(--ide-text)] font-medium" data-testid="nav-desktop">Desktop App</Link>
          <Link href="/pricing" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="nav-pricing">Pricing</Link>
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
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-[280px] h-full bg-[var(--ide-bg)] border-l border-[var(--ide-border)]/50 flex flex-col">
            <nav className="flex flex-col p-6 gap-2">
              <Link href="/demo" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)}>AI</Link>
              <Link href="/teams" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)}>Teams</Link>
              <Link href="/desktop" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text)] font-medium bg-[var(--ide-panel)]" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-desktop">Desktop App</Link>
              <Link href="/pricing" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <div className="my-3 border-t border-[var(--ide-border)]/50" />
              <Link href="/login" className="flex items-center px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
              <Link href="/login?signup=true" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full h-11 text-[15px] font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl">Sign up</Button>
              </Link>
            </nav>
          </div>
        </div>
      )}

      <section className="relative z-10 flex flex-col items-center pt-20 pb-16 px-6 lg:pt-28 lg:pb-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-radial from-[#0079F2]/6 via-[#0079F2]/1 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-[#7C65CB]/4 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] text-xs font-medium mb-8" data-testid="badge-desktop">
          <Monitor className="w-3.5 h-3.5" />
          Desktop App — Native experience for {platformInfo[detectedOS].label}
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-center max-w-4xl leading-[1.1] tracking-tight mb-6" data-testid="hero-title">
          Code without
          <br />
          <span className="bg-gradient-to-r from-[#0079F2] via-[#7C65CB] to-[#F26522] bg-clip-text text-transparent">distractions</span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--ide-text-secondary)] text-center max-w-2xl mb-10 leading-relaxed" data-testid="hero-subtitle">
          The E-Code desktop app gives you a dedicated, native coding environment with auto-updates, keyboard shortcuts, and all the power of the cloud IDE.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          {hasPlatformBinary ? (
            <Button
              onClick={() => handleDownload(detectedOS)}
              className="h-14 px-8 text-lg font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl shadow-[0_0_20px_rgba(0,121,242,0.3)] hover:shadow-[0_0_30px_rgba(0,121,242,0.4)] transition-all gap-3"
              data-testid="button-download-primary"
            >
              <Download className="w-5 h-5" />
              Download for {platformInfo[detectedOS].label}
            </Button>
          ) : (
            <Button
              disabled
              className="h-14 px-8 text-lg font-semibold bg-[var(--ide-panel)] text-[var(--ide-text-muted)] rounded-xl cursor-not-allowed gap-3"
              data-testid="button-download-primary-disabled"
            >
              <Download className="w-5 h-5" />
              Coming Soon for {platformInfo[detectedOS].label}
            </Button>
          )}
        </div>

        {hasRelease && release?.version && (
          <p className="text-xs text-[var(--ide-text-muted)] mb-2" data-testid="text-version">
            Version {release.version}
            {release.platforms[detectedOS]?.fileSize ? ` · ${formatSize(release.platforms[detectedOS].fileSize)}` : ""}
          </p>
        )}
        <p className="text-xs text-[var(--ide-text-muted)]">
          {platformInfo[detectedOS].minReq}
        </p>
      </section>

      <section className="relative z-10 py-16 px-6 border-t border-[var(--ide-border)]/50" data-testid="platforms-section">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Available for all platforms</h2>
          <p className="text-[var(--ide-text-secondary)] text-center mb-12">Download E-Code for your operating system.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(["mac", "win", "linux"] as const).map((p) => {
              const info = platformInfo[p];
              const Icon = info.icon;
              const isDetected = p === detectedOS;
              const platformRelease = release?.platforms[p];
              return (
                <div
                  key={p}
                  className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                    isDetected
                      ? "border-[#0079F2]/40 bg-[#0079F2]/5 shadow-[0_0_30px_rgba(0,121,242,0.1)]"
                      : "border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F]"
                  }`}
                  data-testid={`card-platform-${p}`}
                >
                  {isDetected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#0079F2] text-white text-[10px] font-semibold">
                      YOUR OS
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: isDetected ? "rgba(0,121,242,0.15)" : "rgba(255,255,255,0.05)" }}>
                      {p === "mac" ? (
                        <Apple className="w-7 h-7" style={{ color: isDetected ? "#0079F2" : "var(--ide-text-secondary)" }} />
                      ) : p === "win" ? (
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill={isDetected ? "#0079F2" : "var(--ide-text-secondary)"}><path d="M3 12V6.5l8-1.1V12H3zm0 .5h8v6.6l-8-1.1V12.5zM11.5 5.3l9.5-1.3v8h-9.5V5.3zm0 7.2h9.5v8l-9.5-1.3V12.5z"/></svg>
                      ) : (
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill={isDetected ? "#0079F2" : "var(--ide-text-secondary)"}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V8h2v4zm4 4h-2v-2h2v2zm0-4h-2V8h2v4z"/></svg>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{info.label}</h3>
                    <p className="text-xs text-[var(--ide-text-muted)] mb-4">{info.ext} · {info.minReq}</p>
                    {hasRelease && platformRelease ? (
                      <Button
                        onClick={() => handleDownload(p)}
                        variant={isDetected ? "default" : "outline"}
                        className={`w-full h-10 text-sm font-medium rounded-xl gap-2 ${
                          isDetected
                            ? "bg-[#0079F2] hover:bg-[#0066CC] text-white"
                            : "bg-transparent border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-panel)]"
                        }`}
                        data-testid={`button-download-${p}`}
                      >
                        <Download className="w-4 h-4" />
                        Download {info.ext}
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className="w-full h-10 text-sm font-medium rounded-xl bg-[var(--ide-bg)] text-[var(--ide-text-muted)] cursor-not-allowed"
                        data-testid={`button-download-${p}-disabled`}
                      >
                        Coming Soon
                      </Button>
                    )}
                    {platformRelease?.fileSize && (
                      <p className="text-[10px] text-[var(--ide-text-muted)] mt-2">{formatSize(platformRelease.fileSize)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6 border-t border-[var(--ide-border)]/50" data-testid="features-section">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why use the desktop app?</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg max-w-xl mx-auto">All the power of E-Code in a native, focused application.</p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="group p-6 rounded-2xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] hover:border-[#3B4B5F] transition-all duration-300" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-[#0079F2]/10 border border-[#0079F2]/20">
                <f.icon className="w-5 h-5 text-[#0079F2]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--ide-text-secondary)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-16 px-6 border-t border-[var(--ide-border)]/50" data-testid="requirements-section">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">System Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(["mac", "win", "linux"] as const).map((p) => (
              <div key={p} className="p-5 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50" data-testid={`requirements-${p}`}>
                <h3 className="font-semibold mb-3">{platformInfo[p].label}</h3>
                <ul className="space-y-2 text-sm text-[var(--ide-text-secondary)]">
                  <li>{platformInfo[p].minReq}</li>
                  <li>4 GB RAM minimum</li>
                  <li>500 MB disk space</li>
                  <li>Internet connection required</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 px-6 border-t border-[var(--ide-border)]/50" data-testid="faq-section">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 overflow-hidden"
                data-testid={`faq-item-${i}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-[var(--ide-panel)] transition-colors"
                  data-testid={`button-faq-${i}`}
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-[var(--ide-text-secondary)] leading-relaxed" data-testid={`text-faq-answer-${i}`}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 lg:py-28 px-6 border-t border-[var(--ide-border)]/50" data-testid="cta-section">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to go native?</h2>
          <p className="text-[var(--ide-text-secondary)] text-lg mb-10">Download the E-Code desktop app and start coding in a focused, distraction-free environment.</p>
          {hasRelease ? (
            <Button
              onClick={() => handleDownload(detectedOS)}
              className="h-14 px-10 text-lg font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl shadow-[0_0_20px_rgba(0,121,242,0.3)] hover:shadow-[0_0_30px_rgba(0,121,242,0.4)] transition-all gap-3"
              data-testid="cta-download"
            >
              <Download className="w-5 h-5" />
              Download for {platformInfo[detectedOS].label}
            </Button>
          ) : (
            <Link href="/login?signup=true">
              <Button className="h-14 px-10 text-lg font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl shadow-[0_0_20px_rgba(0,121,242,0.3)] hover:shadow-[0_0_30px_rgba(0,121,242,0.4)] transition-all gap-2" data-testid="cta-signup">
                Get started with E-Code
              </Button>
            </Link>
          )}
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--ide-border)]/50 bg-[var(--ide-bg)] px-6 lg:px-12 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-8">
          <div className="flex items-center gap-2">
            <ECodeLogo size={20} />
            <span className="font-bold text-sm">E-Code</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--ide-text-muted)]">
            <Link href="/pricing" className="hover:text-[var(--ide-text)] transition-colors">Pricing</Link>
            <Link href="/teams" className="hover:text-[var(--ide-text)] transition-colors">Teams</Link>
            <Link href="/desktop" className="hover:text-[var(--ide-text)] transition-colors">Desktop App</Link>
            <Link href="/docs" className="hover:text-[var(--ide-text)] transition-colors">Docs</Link>
            <Link href="/terms" className="hover:text-[var(--ide-text)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--ide-text)] transition-colors">Privacy</Link>
            <a href="mailto:support@e-code.ai" className="hover:text-[var(--ide-text)] transition-colors">Contact</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-5 border-t border-[var(--ide-border)]/50 flex items-center justify-between">
          <p className="text-xs text-[var(--ide-text-muted)]">&copy; {new Date().getFullYear()} E-Code. All rights reserved.</p>
          <a href="#" className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"><Github className="w-4 h-4" /></a>
        </div>
      </footer>
    </div>
  );
}
