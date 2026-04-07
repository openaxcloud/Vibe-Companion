import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  X,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  Search,
  LogIn,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ECodeLogo } from '@/components/ECodeLogo';

export function PublicNavbar() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const productItems = [
    { title: 'AI Agent', href: '/ai-agent', description: 'Build production-ready apps with natural language prompts.' },
    { title: 'Browser IDE', href: '/features', description: 'Enterprise-grade development workspace built for teams.' },
    { title: 'Multiplayer', href: '/features#multiplayer', description: 'Live collaboration, pair programming, and shared presence.' },
    { title: 'Mobile App', href: '/mobile', description: 'Ship from anywhere with a fully-featured mobile IDE.' },
    { title: 'Desktop App', href: '/desktop', description: 'Optimized offline workflow with secure device sync.' },
    { title: 'AI Platform', href: '/ai', description: 'Governance, observability, and orchestration for AI workloads.' },
    { title: 'Deployments', href: '/marketing/deployments', description: 'Global edge infrastructure with Fortune 500 reliability.' },
    { title: 'Bounties', href: '/marketing/bounties', description: 'Activate an on-demand developer network to accelerate delivery.' },
    { title: 'Teams', href: '/marketing/teams', description: 'Enterprise controls, compliance, and insights for large orgs.' },
  ];

  const solutionsItems = [
    { title: 'App Builder', href: '/solutions/app-builder', description: 'Rapidly prototype and deploy full-stack applications.' },
    { title: 'Website Builder', href: '/solutions/website-builder', description: 'Create polished marketing sites with zero setup.' },
    { title: 'Game Builder', href: '/solutions/game-builder', description: 'Design and launch interactive experiences powered by AI.' },
    { title: 'Dashboard Builder', href: '/solutions/dashboard-builder', description: 'Data-rich dashboards with real-time collaboration.' },
    { title: 'Chatbot / AI Agent Builder', href: '/solutions/chatbot-builder', description: 'Deploy conversational assistants across your organization.' },
    { title: 'Internal AI Builder', href: '/solutions/internal-ai-builder', description: 'Bring private AI agents to every team safely and securely.' },
    { title: 'Enterprise', href: '/solutions/enterprise', description: 'Fortune 500-grade platform with SSO, audit logs, and 99.99% SLA.' },
    { title: 'Startups', href: '/solutions/startups', description: 'Ship your MVP 10x faster. Startup-friendly pricing.' },
    { title: 'Freelancers', href: '/solutions/freelancers', description: 'Deliver client projects faster. Portfolio hosting included.' },
  ];

  const resourcesItems = [
    { title: 'Documentation', href: '/docs', description: 'Get started quickly with step-by-step guides.' },
    { title: 'AI Documentation', href: '/ai-documentation', description: 'Complete AI capabilities guide' },
    { title: 'Tutorials', href: '/tutorials', description: 'Step-by-step learning from beginner to advanced.' },
    { title: 'Blog', href: '/blog', description: 'Stories on shipping software at global scale.' },
    { title: 'Changelog', href: '/changelog', description: 'Latest features and product updates.' },
    { title: 'Community', href: '/community', description: 'Connect with builders and share best practices.' },
    { title: 'Templates', href: '/templates', description: 'Launch with curated, industry-specific templates.' },
    { title: 'Case Studies', href: '/case-studies', description: 'Real-world success stories from our customers.' },
    { title: 'Help Center', href: '/help-center', description: 'FAQs, troubleshooting, and support.' },
    { title: 'Status', href: '/status', description: 'Transparency around platform availability.' },
  ];

  const companyItems = [
    { title: 'About', href: '/about', description: 'Learn about our mission and leadership team.' },
    { title: 'Careers', href: '/careers', description: 'Join a distributed team building the future of software.' },
    { title: 'Press', href: '/press', description: 'Press releases, media kit, and recent coverage.' },
    { title: 'Partners', href: '/partners', description: 'Strategic alliances and solution partners.' },
    { title: 'Contact', href: '/contact', description: 'Get in touch with our team.' },
    { title: 'Accessibility', href: '/accessibility', description: 'Our commitment to inclusive design.' },
  ];

  const desktopNav = (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[calc(100vw-2rem)] sm:w-[480px] gap-3 p-4 md:w-[520px] md:grid-cols-2 lg:w-[640px]">
              {productItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="block rounded-xl border border-border bg-surface-solid p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-surface-hover-solid hover:shadow-lg hover:shadow-sky-500"
                  >
                    <div className="text-[13px] font-semibold text-[var(--ecode-text)] dark:text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-300" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[calc(100vw-2rem)] sm:w-[480px] gap-3 p-4 md:w-[520px] md:grid-cols-2 lg:w-[640px]">
              {solutionsItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="block rounded-xl border border-border bg-surface-solid p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-surface-hover-solid hover:shadow-lg hover:shadow-sky-500"
                  >
                    <div className="text-[13px] font-semibold text-[var(--ecode-text)] dark:text-white flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-indigo-300" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[calc(100vw-2rem)] sm:w-[480px] gap-3 p-4 md:w-[520px] md:grid-cols-2 lg:w-[640px]">
              {resourcesItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="block rounded-xl border border-border bg-surface-solid p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-surface-hover-solid hover:shadow-lg hover:shadow-sky-500"
                  >
                    <div className="text-[13px] font-semibold text-[var(--ecode-text)] dark:text-white flex items-center gap-2">
                      <Search className="h-4 w-4 text-sky-300" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Company</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[360px] gap-3 p-4">
              {companyItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="block rounded-xl border border-border bg-surface-solid p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-surface-hover-solid hover:shadow-lg hover:shadow-sky-500"
                  >
                    <div className="text-[13px] font-semibold text-[var(--ecode-text)] dark:text-white flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-indigo-300" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--ecode-text-secondary)] dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink
            href="/pricing"
            className="group inline-flex h-10 w-max items-center justify-center rounded-full border border-[var(--ecode-border)] dark:border-border px-5 text-[13px] font-medium text-[var(--ecode-text)] dark:text-slate-200 transition-colors hover:border-[var(--ecode-accent)] dark:hover:border-surface-hover-solid hover:text-[var(--ecode-accent)] dark:hover:text-white"
          >
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink
            href="/team"
            className="group inline-flex h-10 w-max items-center justify-center rounded-full border border-[var(--ecode-border)] dark:border-border px-5 text-[13px] font-medium text-[var(--ecode-text)] dark:text-slate-200 transition-colors hover:border-[var(--ecode-accent)] dark:hover:border-surface-hover-solid hover:text-[var(--ecode-accent)] dark:hover:text-white"
          >
            Teams
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );

  const primaryCta = (
    <Button
      onClick={() => navigate('/register')}
      className="hidden sm:inline-flex shrink-0 bg-ecode-accent hover:bg-ecode-accent-hover text-white min-h-[44px] px-3 sm:px-4 text-[13px] whitespace-nowrap"
      data-testid="link-get-started"
    >
      Get started
    </Button>
  );

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="hidden md:block border-b border-[var(--ecode-border)] dark:border-border bg-background dark:bg-background">
        <div className="container-responsive flex h-10 items-center justify-between text-[11px] text-[var(--ecode-text)] dark:text-slate-100">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-surface-solid text-[var(--ecode-accent)] dark:bg-surface-solid dark:text-white border-border dark:border-border uppercase tracking-[0.2em]">
              NEW
            </Badge>
            <p className="font-medium">Introducing E-Code Enterprise Cloud with dedicated AI governance and auditability.</p>
          </div>
          <button
            className="inline-flex items-center gap-1 text-[var(--ecode-accent)] hover:text-[var(--ecode-accent-hover)] dark:text-sky-200 dark:hover:text-white transition-colors"
            onClick={() => navigate('/contact-sales')}
            aria-label="Talk to a sales expert"
          >
            Talk to an expert
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav aria-label="Main navigation" className="relative border-b border-[var(--ecode-border)] bg-background dark:border-border dark:bg-background backdrop-blur-xl overflow-visible">
        <div className="absolute inset-0 marketing-grid opacity-0 dark:opacity-100 pointer-events-none" aria-hidden />
        <div className="container-responsive-nav relative overflow-visible">
          <div className="flex h-16 items-center justify-between overflow-visible">
            <div className="flex items-center gap-6 overflow-visible">
              <Link href="/">
                <div className="cursor-pointer">
                  <ECodeLogo size="sm" />
                </div>
              </Link>

              <div className="hidden lg:block text-[var(--ecode-text)] dark:text-slate-200 overflow-visible">
                {desktopNav}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeSwitcher />
              <Button
                variant="ghost"
                className="text-[var(--ecode-text)] dark:text-slate-200 hover:text-[var(--ecode-accent)] dark:hover:text-white min-h-[44px] px-3 sm:px-4"
                onClick={() => navigate('/login')}
                data-testid="link-login"
              >
                <LogIn className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden xs:inline">Log in</span>
              </Button>
              {primaryCta}

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open mobile menu" className="lg:hidden text-[var(--ecode-text)] dark:text-slate-100">
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[380px] p-0 border-l border-border bg-background">
                  <VisuallyHidden.Root asChild>
                    <SheetHeader>
                      <SheetTitle>Mobile Navigation Menu</SheetTitle>
                      <SheetDescription>Navigate through E-Code platform sections</SheetDescription>
                    </SheetHeader>
                  </VisuallyHidden.Root>
                  <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between">
                      <ECodeLogo size="sm" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close mobile menu"
                        className="hover:bg-muted"
                      >
                        <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border-b border-border">
                    <Button
                      className="w-full bg-ecode-accent hover:bg-ecode-accent-hover text-white"
                      onClick={() => navigate('/register')}
                    >
                      Get Started
                    </Button>
                    <Button
                      variant="outline"
                      className="mt-2 w-full border-border text-foreground hover:bg-muted"
                      onClick={() => navigate('/login')}
                    >
                      Sign In
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100vh-180px)]">
                    <div className="p-4 space-y-1">
                      <div className="pb-3">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3 flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-ecode-accent" />
                          Product
                        </h3>
                        <div className="space-y-0.5">
                          {productItems.map((item) => (
                            <button
                              key={item.title}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                navigate(item.href);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center justify-between group"
                            >
                              <div>
                                <div className="text-[13px] font-medium text-foreground">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.description}
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 pb-3">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3 flex items-center gap-2">
                          <ArrowUpRight className="h-3 w-3 text-indigo-400" />
                          Solutions
                        </h3>
                        <div className="space-y-0.5">
                          {solutionsItems.map((item) => (
                            <button
                              key={item.title}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                navigate(item.href);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center justify-between group"
                            >
                              <div>
                                <div className="text-[13px] font-medium text-foreground">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.description}
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 pb-3">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3 flex items-center gap-2">
                          <Search className="h-3 w-3 text-sky-400" />
                          Resources
                        </h3>
                        <div className="space-y-0.5">
                          {resourcesItems.map((item) => (
                            <button
                              key={item.title}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                navigate(item.href);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center justify-between group"
                            >
                              <div>
                                <div className="text-[13px] font-medium text-foreground">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.description}
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 pb-3">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3 flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-indigo-400" />
                          Company
                        </h3>
                        <div className="space-y-0.5">
                          {companyItems.map((item) => (
                            <button
                              key={item.title}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                navigate(item.href);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center justify-between group"
                            >
                              <div>
                                <div className="text-[13px] font-medium text-foreground">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.description}
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate('/pricing');
                            }}
                            className="px-3 py-2.5 rounded-lg border border-border hover:bg-muted text-[13px] font-medium text-foreground transition-colors min-h-[44px]"
                          >
                            Pricing
                          </button>
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate('/team');
                            }}
                            className="px-3 py-2.5 rounded-lg border border-border hover:bg-muted text-[13px] font-medium text-foreground transition-colors min-h-[44px]"
                          >
                            Teams
                          </button>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
