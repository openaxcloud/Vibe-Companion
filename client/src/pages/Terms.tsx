import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-8 transition-colors" data-testid="link-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-sm text-[var(--ide-text-muted)] mb-8">Last updated: March 10, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-[var(--ide-text-secondary)] text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using E-Code ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">2. Description of Service</h2>
            <p>E-Code provides an online integrated development environment (IDE) that allows users to write, execute, and deploy code. The Service includes features such as code editing, project management, AI-assisted coding, team collaboration, and project deployment.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">3. User Accounts</h2>
            <p>To use certain features of the Service, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Use the Service for cryptocurrency mining</li>
              <li>Host content that is illegal, abusive, or harmful</li>
              <li>Circumvent usage limits or rate limiting mechanisms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">5. Intellectual Property</h2>
            <p>You retain all rights to the code and content you create using the Service. E-Code does not claim ownership of your projects. However, you grant E-Code a limited license to host, store, and process your content as necessary to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">6. Subscription Plans & Billing</h2>
            <p>The Service offers free and paid subscription plans. Paid plans are billed on a monthly basis. You may cancel your subscription at any time. Refunds are handled on a case-by-case basis. Usage limits apply based on your plan tier.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">7. Service Availability</h2>
            <p>We strive to maintain high availability of the Service but do not guarantee uninterrupted access. We may perform maintenance, updates, or modifications that temporarily affect availability. We are not liable for any downtime or data loss.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">8. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. E-Code shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">9. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at any time for violations of these terms. You may delete your account at any time through the Settings page. Upon termination, your data will be deleted within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">10. Changes to Terms</h2>
            <p>We may update these terms from time to time. We will notify users of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">11. Contact</h2>
            <p>For questions about these Terms, please contact us at support@e-code.ai.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
