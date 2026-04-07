import { Link } from 'wouter';
import { 
  Twitter, Github, Youtube, Linkedin, Instagram,
  Globe, Code, Users, BookOpen, Shield, HelpCircle
} from 'lucide-react';
import { ECodeLogo } from '@/components/ECodeLogo';

export function PublicFooter() {
  const footerLinks = {
    product: [
      { label: 'IDE', href: '/features' },
      { label: 'Multiplayer', href: '/features#multiplayer' },
      { label: 'Mobile App', href: '/mobile' },
      { label: 'Teams', href: '/teams' },
      { label: 'Deployments', href: '/deployments' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Bounties', href: '/bounties' },
      { label: 'AI', href: '/ai' },
      { label: 'Templates', href: '/templates' },
    ],
    resources: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Community', href: '/community' },
      { label: 'Forum', href: '/forum' },
      { label: 'Status', href: '/status' },
      { label: 'Import from GitHub', href: '/github-import' },
      { label: 'E-Code Desktop App', href: '/desktop' },
      { label: 'Programming Languages', href: '/languages' },
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Partners', href: '/partners' },
      { label: 'Contact Sales', href: '/contact-sales' },
    ],
    legal: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Subprocessors', href: '/subprocessors' },
      { label: 'DPA', href: '/dpa' },
      { label: 'US Student DPA', href: '/student-dpa' },
      { label: 'Security', href: '/security' },
    ],
    compare: [
      { label: 'E-Code vs GitHub Codespaces', href: '/compare/github-codespaces' },
      { label: 'E-Code vs Glitch', href: '/compare/glitch' },
      { label: 'E-Code vs Heroku', href: '/compare/heroku' },
      { label: 'E-Code vs CodeSandbox', href: '/compare/codesandbox' },
      { label: 'E-Code vs AWS Cloud9', href: '/compare/aws-cloud9' },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com/replit', label: 'Twitter' },
    { icon: Github, href: 'https://github.com/replit', label: 'GitHub' },
    { icon: Youtube, href: 'https://youtube.com/replit', label: 'YouTube' },
    { icon: Linkedin, href: 'https://linkedin.com/company/replit', label: 'LinkedIn' },
    { icon: Instagram, href: 'https://instagram.com/replit', label: 'Instagram' },
  ];

  return (
    <footer className="bg-background border-t mt-auto">
      <div className="container-responsive py-12 sm:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Compare */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-semibold mb-4 text-foreground">Compare</h3>
            <ul className="space-y-2">
              {footerLinks.compare.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile App */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <h3 className="font-semibold mb-4 text-foreground">Mobile App</h3>
            <div className="space-y-3">
              <a 
                href="https://apps.apple.com/app/replit" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img 
                  src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" 
                  alt="Download on the App Store"
                  className="h-10"
                />
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=com.replit.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img 
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                  alt="Get it on Google Play"
                  className="h-10"
                />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="cursor-pointer">
                <ECodeLogo size="sm" />
              </div>
            </Link>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} E-Code Inc. All rights reserved.
            </span>
            <Link href="/newsletter/unsubscribe">
              <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Unsubscribe
              </a>
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={social.label}
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}