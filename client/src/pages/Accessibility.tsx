import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Eye, Keyboard, Monitor, Volume2,
  MousePointer, Contrast, Type, Globe, Mail, AlertTriangle, ShieldCheck
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('accessibility');

const accessibilityFeatures = [
  {
    icon: <Keyboard className="h-6 w-6" />,
    title: "Full Keyboard Navigation",
    description: "Navigate the entire platform using only a keyboard. All interactive elements are focusable with visible focus indicators."
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Screen Reader Support",
    description: "Optimized for screen readers with proper ARIA labels, landmarks, and live regions for dynamic content."
  },
  {
    icon: <Contrast className="h-6 w-6" />,
    title: "High Contrast Mode",
    description: "Built-in dark mode and theme options to improve readability for users with low vision."
  },
  {
    icon: <Type className="h-6 w-6" />,
    title: "Resizable Text",
    description: "All text scales properly up to 200% without loss of content or functionality."
  },
  {
    icon: <MousePointer className="h-6 w-6" />,
    title: "Large Click Targets",
    description: "Minimum 44x44 pixel touch targets for all interactive elements, exceeding WCAG requirements."
  },
  {
    icon: <Monitor className="h-6 w-6" />,
    title: "Reduced Motion Support",
    description: "Respects the prefers-reduced-motion media query to disable animations for users who need it."
  }
];

const wcagCompliance = [
  { level: "WCAG 2.1 Level A", status: "Tested", description: "Automated axe-core scans verify Level A compliance on key pages" },
  { level: "WCAG 2.1 Level AA", status: "Tested", description: "Automated axe-core scans verify Level AA compliance (excluding color contrast)" },
  { level: "WCAG 2.1 Level AAA", status: "Partial", description: "Some Level AAA criteria are met; not a formal compliance target" },
  { level: "Color Contrast (AA)", status: "In Progress", description: "Brand color (#F26207) on light backgrounds is being evaluated for AA compliance" }
];

export default function Accessibility() {
  return (
    <PublicLayout>
      <SEOHead {...seo} />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20" data-testid="page-accessibility">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-0">
            Inclusive by Design
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent" data-testid="heading-accessibility">
            Accessibility Statement
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            E-Code is committed to ensuring digital accessibility for people with disabilities.
            We continually improve the user experience for everyone.
          </p>
        </div>

        {/* Commitment Section */}
        <Card className="max-w-4xl mx-auto p-8 mb-16 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-2 border-teal-200 dark:border-teal-800">
          <div className="flex items-start gap-6">
            <div className="p-4 bg-teal-100 dark:bg-teal-900/50 rounded-2xl">
              <Globe className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4">Our Commitment</h2>
              <p className="text-muted-foreground mb-4">
                At E-Code, we believe that everyone should be able to build software, regardless of ability.
                We are committed to providing a platform that is accessible to all users, including those
                who rely on assistive technologies.
              </p>
              <p className="text-muted-foreground">
                Our development team follows WCAG 2.1 guidelines and uses automated accessibility testing
                with axe-core to verify compliance on key pages. We continuously work to identify and fix
                accessibility barriers.
              </p>
            </div>
          </div>
        </Card>

        {/* Automated Testing Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Automated Accessibility Testing</h2>
          <Card className="p-6 border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">axe-core WCAG 2.1 AA Scans</h3>
                <p className="text-[13px] text-muted-foreground mb-3">
                  We run automated accessibility tests using axe-core (via Playwright) on our most critical pages.
                  These tests check for WCAG 2.1 Level A and AA violations and run as part of our development process.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Landing", "Login", "Pricing", "Features", "Accessibility"].map((page) => (
                    <Badge key={page} className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {page}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Accessibility Features */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Accessibility Features</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {accessibilityFeatures.map((feature) => (
              <Card key={feature.title} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
                    <div className="text-teal-600 dark:text-teal-400">
                      {feature.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-[13px] text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Compliance Status */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Compliance Status</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="text-left p-4 font-semibold">Standard</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {wcagCompliance.map((item, index) => (
                    <tr key={item.level} className={index % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/50'}>
                      <td className="p-4 font-medium">{item.level}</td>
                      <td className="p-4">
                        <Badge className={
                          item.status === "Tested"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : item.status === "In Progress"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Technical Specifications */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Technical Specifications</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Supported Assistive Technologies</h3>
              <ul className="space-y-2">
                {[
                  "JAWS (Windows)",
                  "NVDA (Windows)",
                  "VoiceOver (macOS/iOS)",
                  "TalkBack (Android)",
                  "Windows Narrator",
                  "ZoomText"
                ].map((tech) => (
                  <li key={tech} className="flex items-center gap-2 text-[13px]">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {tech}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Browser Compatibility</h3>
              <ul className="space-y-2">
                {[
                  "Chrome 90+ (Windows, macOS, Linux)",
                  "Firefox 90+ (Windows, macOS, Linux)",
                  "Safari 14+ (macOS, iOS)",
                  "Edge 90+ (Windows)",
                  "Opera 76+ (Windows, macOS)"
                ].map((browser) => (
                  <li key={browser} className="flex items-center gap-2 text-[13px]">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {browser}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* Known Limitations */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Known Limitations</h2>
          <Card className="p-6">
            <p className="text-muted-foreground mb-4">
              While we strive to ensure full accessibility, some content may have limitations:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Color contrast:</strong> The brand accent color may not meet WCAG AA contrast
                  requirements (4.5:1) for small text on light backgrounds. We are evaluating adjustments
                  that balance brand identity with accessibility.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Third-party integrations:</strong> Some embedded content from third parties
                  may not be fully accessible. We are working with vendors to improve this.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Code editor:</strong> The Monaco code editor has some accessibility limitations
                  we are actively addressing in collaboration with Microsoft.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Automated testing scope:</strong> Automated axe-core tests cover 5 key pages.
                  Pages behind authentication (Dashboard, IDE, Settings) are not yet included in automated scans.
                </div>
              </li>
            </ul>
          </Card>
        </div>

        {/* Feedback Section */}
        <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-r from-teal-500 to-cyan-500 border-0 text-white">
          <div className="text-center">
            <Mail className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Accessibility Feedback</h2>
            <p className="text-[15px] text-white/90 mb-8 max-w-2xl mx-auto">
              We welcome your feedback on the accessibility of E-Code. If you encounter
              any barriers or have suggestions for improvement, please let us know.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white text-teal-600 hover:bg-teal-50" data-testid="button-accessibility-contact">
                  <Mail className="h-5 w-5" />
                  Contact Accessibility Team
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-white/80">
              Email: accessibility@e-code.ai
            </p>
          </div>
        </Card>

        {/* Last Updated */}
        <div className="max-w-4xl mx-auto mt-8 text-center text-[13px] text-muted-foreground">
          <p>This accessibility statement was last updated on April 2026.</p>
        </div>
      </div>
    </PublicLayout>
  );
}
