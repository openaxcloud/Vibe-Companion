import { Link } from "wouter";
import { Github, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function ECodeLogo({ size = 32 }: { size?: number }) {
  return (
    <img src="/logo.png" alt="Vibe Companion" width={size} height={size} className="rounded" style={{ objectFit: 'contain' }} />
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <nav className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 lg:px-12 border-b border-[var(--ide-border)]/50 bg-[var(--ide-bg)]/80 backdrop-blur-xl" data-testid="marketing-nav">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <ECodeLogo size={28} />
            <span className="font-bold text-lg tracking-tight">Vibe Companion</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/features" className="px-3 py-2 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors">Features</Link>
            <Link href="/pricing" className="px-3 py-2 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors">Pricing</Link>
            <Link href="/solutions/enterprise" className="px-3 py-2 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors">Enterprise</Link>
            <Link href="/docs" className="px-3 py-2 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors">Docs</Link>
            <Link href="/blog" className="px-3 py-2 rounded-lg text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors">Blog</Link>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-sm" data-testid="nav-login">Log in</Button>
          </Link>
          <Link href="/login">
            <Button className="text-sm bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" data-testid="nav-signup">Sign up</Button>
          </Link>
        </div>
        <button
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-[280px] h-full bg-[var(--ide-bg)] border-l border-[var(--ide-border)]/50 flex flex-col">
            <nav className="flex flex-col p-6 gap-2">
              <Link href="/features" className="px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link href="/pricing" className="px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link href="/solutions/enterprise" className="px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" onClick={() => setMobileMenuOpen(false)}>Enterprise</Link>
              <Link href="/blog" className="px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
              <div className="my-3 border-t border-[var(--ide-border)]/50" />
              <Link href="/login" className="px-4 py-3 rounded-xl text-[15px] text-[var(--ide-text)]" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full h-11 text-[15px] font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl">Sign up</Button>
              </Link>
            </nav>
          </div>
        </div>
      )}

      <main>{children}</main>

      <footer className="border-t border-[var(--ide-border)]/50 bg-[var(--ide-bg)] px-6 lg:px-12 py-16" data-testid="marketing-footer">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ECodeLogo size={20} />
              <span className="font-bold text-sm">Vibe Companion</span>
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
            <span>&copy; {new Date().getFullYear()} Vibe Companion. All rights reserved.</span>
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
