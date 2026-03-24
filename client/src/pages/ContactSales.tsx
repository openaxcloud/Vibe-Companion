import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check } from "lucide-react";

export default function ContactSales() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <MarketingLayout>
        <section className="py-20 lg:py-28 px-6">
          <div className="max-w-lg mx-auto text-center" data-testid="sales-success">
            <div className="w-16 h-16 rounded-full bg-[#0CCE6B]/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-[#0CCE6B]" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Thank you!</h1>
            <p className="text-[var(--ide-text-secondary)]">We've received your request. A member of our sales team will be in touch within 24 hours.</p>
          </div>
        </section>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="contact-sales-hero">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-6">Talk to sales</h1>
            <p className="text-[var(--ide-text-secondary)] mb-8">Learn how E-Code can help your organization build software faster with enterprise-grade security and support.</p>
            <div className="space-y-4 text-sm text-[var(--ide-text-secondary)]">
              <div className="flex items-start gap-3"><Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> Custom pricing for teams of any size</div>
              <div className="flex items-start gap-3"><Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> SSO and enterprise authentication</div>
              <div className="flex items-start gap-3"><Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> Priority support with dedicated account manager</div>
              <div className="flex items-start gap-3"><Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> Custom deployment and compliance options</div>
              <div className="flex items-start gap-3"><Check className="w-4 h-4 text-[#0CCE6B] mt-0.5 shrink-0" /> Volume-based AI usage discounts</div>
            </div>
          </div>
          <div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1.5">First name</label><Input placeholder="Jane" required data-testid="input-first-name" /></div>
                <div><label className="block text-xs font-medium mb-1.5">Last name</label><Input placeholder="Doe" required data-testid="input-last-name" /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1.5">Work email</label><Input type="email" placeholder="jane@company.com" required data-testid="input-email" /></div>
              <div><label className="block text-xs font-medium mb-1.5">Company</label><Input placeholder="Acme Inc" required data-testid="input-company" /></div>
              <div><label className="block text-xs font-medium mb-1.5">Team size</label>
                <select className="w-full h-10 rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] px-3 text-sm" data-testid="select-team-size">
                  <option>1-10</option><option>11-50</option><option>51-200</option><option>201-1000</option><option>1000+</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium mb-1.5">How can we help?</label>
                <textarea className="w-full h-24 rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] px-3 py-2 text-sm resize-none" placeholder="Tell us about your needs..." data-testid="textarea-message" />
              </div>
              <Button type="submit" className="w-full h-11 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl gap-2" data-testid="button-submit-sales">Submit <ArrowRight className="w-4 h-4" /></Button>
            </form>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
