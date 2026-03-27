import { Link, useLocation } from 'wouter';
import {
  Twitter,
  Github,
  Youtube,
  Linkedin,
  Instagram,
  Sparkles,
  ShieldCheck,
  Globe2,
  ArrowUpRight,
} from 'lucide-react';
import { ECodeLogo } from '@/components/ECodeLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function PublicFooter() {
  const [, navigate] = useLocation();
  const footerLinks = {
    product: [
      { label: 'AI Agent', href: '/ai-agent' },
      { label: 'IDE', href: '/features' },
      { label: 'Multiplayer', href: '/features#multiplayer' },
      { label: 'Mobile App', href: '/mobile' },
      { label: 'Teams', href: '/teams-overview' },
      { label: 'Deployments', href: '/deployments' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Bounties', href: '/bounties' },
      { label: 'AI Platform', href: '/ai' },
    ],
    resources: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Community', href: '/community' },
      { label: 'Templates', href: '/templates' },
      { label: 'Languages', href: '/languages' },
      { label: 'Status', href: '/status' },
      { label: 'Forum', href: '/community' },
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Partners', href: '/partners' },
      { label: 'Contact Sales', href: '/contact-sales' },
    ],
    legal: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Subprocessors', href: '/subprocessors' },
      { label: 'DPA', href: '/dpa' },
      { label: 'US Student DPA', href: '/student-dpa' },
      { label: 'Security', href: '/security' },
      { label: 'Report Abuse', href: '/report-abuse' },
    ],
    compare: [
      { label: 'E-Code vs GitHub Codespaces', href: '/compare/github-codespaces' },
      { label: 'E-Code vs Glitch', href: '/compare/glitch' },
      { label: 'E-Code vs Heroku', href: '/compare/heroku' },
      { label: 'E-Code vs CodeSandbox', href: '/compare/codesandbox' },
      { label: 'E-Code vs AWS Cloud9', href: '/compare/aws-cloud9' },
    ],
  } as const;

  const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com/ecode', label: 'Twitter' },
    { icon: Github, href: 'https://github.com/ecode', label: 'GitHub' },
    { icon: Youtube, href: 'https://youtube.com/ecode', label: 'YouTube' },
    { icon: Linkedin, href: 'https://linkedin.com/company/ecode', label: 'LinkedIn' },
    { icon: Instagram, href: 'https://instagram.com/ecode', label: 'Instagram' },
  ];

  return (
    <footer aria-label="Site footer" className="relative border-t border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)] dark:border-border dark:bg-background dark:text-slate-200">
      <div className="absolute inset-0 marketing-gradient opacity-0 dark:opacity-100" aria-hidden />
      <div className="absolute inset-0 marketing-grid opacity-0 dark:opacity-60" aria-hidden />
      <div className="relative container-responsive py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="space-y-6">
            <Badge className="bg-surface-solid text-[var(--ecode-accent)] border-border dark:bg-surface-solid dark:text-white dark:border-border">
              <Sparkles className="mr-2 h-3 w-3" />
              Built for Fortune 500
            </Badge>
            <h3 className="text-3xl sm:text-4xl font-semibold text-[var(--ecode-text)] dark:text-white tracking-tight">
              The future of enterprise software development
            </h3>
            <p className="text-[13px] sm:text-base text-[var(--ecode-text-secondary)] dark:text-slate-300 leading-relaxed max-w-lg">
              E-Code combines secure cloud workspaces, intelligent automation, and enterprise controls so your teams can ship faster across every device.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500 min-h-[44px]"
                onClick={() => navigate('/contact-sales')}
                data-testid="button-footer-contact-sales"
              >
                Talk to sales
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-[var(--ecode-border)] text-[var(--ecode-text)] hover:text-[var(--ecode-accent)] dark:border-border dark:text-slate-100 dark:hover:text-white min-h-[44px]"
                onClick={() => navigate('/register')}
                data-testid="button-footer-start-building"
              >
                Start building
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300">
              <div className="rounded-xl border border-[var(--ecode-border)] bg-[var(--ecode-surface-secondary)] dark:border-border dark:bg-surface-solid p-4">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ecode-text-muted)] dark:text-slate-400">Global uptime</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--ecode-text)] dark:text-white">99.99%</p>
              </div>
              <div className="rounded-xl border border-[var(--ecode-border)] bg-[var(--ecode-surface-secondary)] dark:border-border dark:bg-surface-solid p-4">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ecode-text-muted)] dark:text-slate-400">Enterprise teams</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--ecode-text)] dark:text-white">4,500+</p>
              </div>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[var(--ecode-text-muted)] dark:text-slate-400">Product</h4>
              <ul role="list" className="mt-4 space-y-2 text-[13px]">
                {footerLinks.product.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[var(--ecode-text-secondary)] dark:text-slate-300 transition hover:text-[var(--ecode-accent)] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[var(--ecode-text-muted)] dark:text-slate-400">Resources</h4>
              <ul className="mt-4 space-y-2 text-[13px]">
                {footerLinks.resources.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[var(--ecode-text-secondary)] dark:text-slate-300 transition hover:text-[var(--ecode-accent)] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[var(--ecode-text-muted)] dark:text-slate-400">Company</h4>
              <ul className="mt-4 space-y-2 text-[13px]">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[var(--ecode-text-secondary)] dark:text-slate-300 transition hover:text-[var(--ecode-accent)] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[var(--ecode-text-muted)] dark:text-slate-400">Legal</h4>
              <ul className="mt-4 space-y-2 text-[13px]">
                {footerLinks.legal.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[var(--ecode-text-secondary)] dark:text-slate-300 transition hover:text-[var(--ecode-accent)] dark:hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="mt-6 rounded-2xl border border-[var(--ecode-border)] bg-[var(--ecode-surface-secondary)] dark:border-border dark:bg-surface-solid p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--ecode-text)] dark:text-white">Compare platforms</p>
                    <p className="text-[11px] text-[var(--ecode-text-secondary)] dark:text-slate-300">See how E-Code stacks up against other development clouds.</p>
                  </div>
                  <div className="flex flex-wrap gap-3" role="list" aria-label="Platform comparisons">
                    {footerLinks.compare.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full border border-[var(--ecode-border)] dark:border-border px-3 py-1.5 text-[11px] text-[var(--ecode-text-secondary)] dark:text-slate-200 transition hover:border-[var(--ecode-accent)] dark:hover:border-surface-hover-solid hover:text-[var(--ecode-accent)] dark:hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-16 grid gap-8 border-t border-[var(--ecode-border)] dark:border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300">
            <ShieldCheck className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
            SOC2 Type II, ISO 27001, GDPR & HIPAA ready.
          </div>
          <div className="flex items-center gap-3 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300">
            <Globe2 className="h-5 w-5 text-sky-500 dark:text-sky-300" />
            18 global regions with enterprise data residency.
          </div>
          <div className="flex items-center gap-3 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300">
            <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-300" />
            AI governance, policy controls, and audit logging.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow us on ${social.label}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ecode-border)] dark:border-border bg-[var(--ecode-surface-secondary)] dark:bg-surface-solid text-[var(--ecode-text-secondary)] dark:text-slate-200 transition hover:border-[var(--ecode-accent)] dark:hover:border-surface-hover-solid hover:text-[var(--ecode-accent)] dark:hover:text-white"
                data-testid={`link-social-${social.label.toLowerCase()}`}
              >
                <social.icon className="h-5 w-5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[11px] text-[var(--ecode-text-muted)] dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="cursor-pointer">
                <ECodeLogo size="xs" />
              </div>
            </Link>
            <span>© {new Date().getFullYear()} E-Code.AI (Snatch Group Limited). All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/newsletter/unsubscribe" className="hover:text-[var(--ecode-accent)] dark:hover:text-white">
              Email preferences
            </Link>
            <Link href="/newsletter-confirmed" className="hover:text-[var(--ecode-accent)] dark:hover:text-white">
              Newsletter
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
