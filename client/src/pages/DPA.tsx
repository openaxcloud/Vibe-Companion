import MarketingLayout from "@/components/marketing/MarketingLayout";

export default function DPA() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="dpa-hero">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Data Processing Agreement</h1>
          <div className="prose prose-invert max-w-none space-y-6 text-[var(--ide-text-secondary)] leading-relaxed">
            <p><strong className="text-[var(--ide-text)]">Last updated:</strong> January 1, 2025</p>
            <p>This Data Processing Agreement ("DPA") forms part of the agreement between E-Code ("Processor") and the customer ("Controller") for the use of E-Code services.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">1. Definitions</h2>
            <p>"Personal Data" means any information relating to an identified or identifiable natural person that is processed by E-Code in connection with the services.</p>
            <p>"Processing" means any operation or set of operations performed on Personal Data, including collection, recording, organization, storage, adaptation, retrieval, use, disclosure, or erasure.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">2. Scope and Purpose</h2>
            <p>E-Code processes Personal Data solely for the purpose of providing the services described in the main agreement. We do not sell Personal Data or use it for purposes beyond service delivery.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">3. Data Security</h2>
            <p>E-Code implements appropriate technical and organizational measures to ensure security of Personal Data, including encryption at rest (AES-256) and in transit (TLS 1.3), access controls, and regular security audits.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">4. Sub-processors</h2>
            <p>E-Code may engage sub-processors to assist in providing the services. A current list of sub-processors is available at <a href="/subprocessors" className="text-[#0079F2] hover:underline">/subprocessors</a>.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">5. Data Subject Rights</h2>
            <p>E-Code will assist the Controller in responding to requests from data subjects exercising their rights under applicable data protection laws, including access, rectification, erasure, and portability.</p>
            <h2 className="text-xl font-bold text-[var(--ide-text)] mt-8">6. Contact</h2>
            <p>For questions about this DPA, contact us at <a href="mailto:privacy@e-code.ai" className="text-[#0079F2] hover:underline">privacy@e-code.ai</a>.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
