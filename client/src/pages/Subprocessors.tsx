import MarketingLayout from "@/components/marketing/MarketingLayout";

const subprocessors = [
  { name: "Amazon Web Services", purpose: "Cloud infrastructure and hosting", location: "United States" },
  { name: "Google Cloud Platform", purpose: "AI/ML model hosting", location: "United States" },
  { name: "Cloudflare", purpose: "CDN, DDoS protection, DNS", location: "Global" },
  { name: "Stripe", purpose: "Payment processing", location: "United States" },
  { name: "SendGrid", purpose: "Transactional email delivery", location: "United States" },
  { name: "Datadog", purpose: "Monitoring and observability", location: "United States" },
  { name: "Sentry", purpose: "Error tracking and monitoring", location: "United States" },
  { name: "OpenAI", purpose: "AI model API (when selected by user)", location: "United States" },
  { name: "Anthropic", purpose: "AI model API (when selected by user)", location: "United States" },
];

export default function Subprocessors() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="subprocessors-hero">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Sub-processors</h1>
          <p className="text-[var(--ide-text-secondary)] mb-8">E-Code uses the following sub-processors to deliver our services. This list is updated as sub-processors are added or removed.</p>
          <p className="text-sm text-[var(--ide-text-muted)] mb-8"><strong>Last updated:</strong> January 1, 2025</p>
          <div className="overflow-x-auto rounded-xl border border-[var(--ide-border)]">
            <table className="w-full border-collapse" data-testid="subprocessors-table">
              <thead>
                <tr className="bg-[var(--ide-panel)] border-b border-[var(--ide-border)]">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Sub-processor</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Purpose</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody>
                {subprocessors.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--ide-border)]/50">
                    <td className="py-3 px-4 text-sm font-medium">{s.name}</td>
                    <td className="py-3 px-4 text-sm text-[var(--ide-text-secondary)]">{s.purpose}</td>
                    <td className="py-3 px-4 text-sm text-[var(--ide-text-secondary)]">{s.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-8 text-sm text-[var(--ide-text-muted)]">To be notified of sub-processor changes, contact <a href="mailto:privacy@e-code.ai" className="text-[#0079F2] hover:underline">privacy@e-code.ai</a>.</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
