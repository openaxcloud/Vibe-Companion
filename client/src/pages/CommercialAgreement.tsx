import MarketingLayout from "@/components/marketing/MarketingLayout";

export default function CommercialAgreement() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="commercial-agreement-hero">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Commercial Agreement</h1>
          <div className="prose prose-invert max-w-none space-y-6 text-[var(--ide-text-secondary)] leading-relaxed">
            <p><strong className="text-[var(--ide-text)]">Last updated:</strong> January 1, 2025</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">1. Overview</h2>
            <p>This Commercial Agreement ("Agreement") governs the commercial terms between E-Code and enterprise customers subscribing to paid plans.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">2. Subscription Terms</h2>
            <p>Enterprise subscriptions are billed annually or monthly as agreed. Pricing is based on the number of seats, compute resources, and AI usage as specified in the order form.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">3. Service Level Agreement</h2>
            <p>E-Code guarantees 99.9% uptime for enterprise customers. If uptime falls below this threshold, customers are entitled to service credits as detailed in the SLA addendum.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">4. Support</h2>
            <p>Enterprise customers receive priority support with a dedicated account manager, 24/7 availability for critical issues, and a maximum response time of 4 hours for high-severity incidents.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">5. Data Ownership</h2>
            <p>Customers retain full ownership of their code, data, and intellectual property. E-Code does not claim any rights to customer content.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">6. Termination</h2>
            <p>Either party may terminate this agreement with 30 days written notice. Upon termination, customers can export all their data and code.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">7. Contact</h2>
            <p>For questions about this agreement, contact <a href="mailto:legal@e-code.ai" className="text-[#0079F2] hover:underline">legal@e-code.ai</a>.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
