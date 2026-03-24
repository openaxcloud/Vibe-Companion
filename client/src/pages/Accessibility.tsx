import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Check } from "lucide-react";

const commitments = [
  "WCAG 2.1 Level AA compliance for all public-facing pages",
  "Keyboard navigation support throughout the IDE",
  "Screen reader compatibility with ARIA labels and roles",
  "High contrast mode and customizable themes",
  "Reduced motion support for users with vestibular disorders",
  "Semantic HTML structure for assistive technologies",
  "Focus indicators for all interactive elements",
  "Alt text for all images and icons",
  "Resizable text up to 200% without loss of functionality",
  "Color-independent information communication",
];

export default function Accessibility() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="accessibility-hero">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Accessibility Statement</h1>
          <p className="text-[var(--ide-text-secondary)] mb-8 leading-relaxed">E-Code is committed to ensuring digital accessibility for people with disabilities. We continuously improve the user experience for everyone and apply relevant accessibility standards.</p>
          <h2 className="text-xl font-bold mb-4">Our commitments</h2>
          <ul className="space-y-3 mb-12">
            {commitments.map((c) => (
              <li key={c} className="flex items-start gap-3 text-sm text-[var(--ide-text-secondary)]">
                <Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> {c}
              </li>
            ))}
          </ul>
          <div className="p-6 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50">
            <h3 className="font-bold mb-2">Feedback</h3>
            <p className="text-sm text-[var(--ide-text-secondary)]">We welcome your feedback on the accessibility of E-Code. Please contact us at <a href="mailto:accessibility@e-code.ai" className="text-[#0079F2] hover:underline">accessibility@e-code.ai</a> if you encounter any barriers.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
