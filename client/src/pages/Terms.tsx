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
            <p>The Service offers free and paid subscription plans. Paid plans are billed on a monthly or yearly basis. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period.</p>
            <h3 className="text-base font-semibold text-[var(--ide-text)] mt-4 mb-2">6.1 Refund Policy</h3>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>14-day money-back guarantee:</strong> If you subscribe to a paid plan and are not satisfied, you may request a full refund within 14 days of your initial purchase, provided you have not consumed more than 20% of your monthly quotas.</li>
              <li><strong>Annual plans:</strong> Annual subscriptions are eligible for a prorated refund within the first 30 days. After 30 days, no refunds are issued for annual plans.</li>
              <li><strong>Renewals:</strong> Automatic renewal charges may be refunded within 48 hours of the charge if you forgot to cancel.</li>
              <li><strong>No refund:</strong> No refunds are provided for partial months of service, downgrades to a lower plan, or accounts terminated for Terms of Service violations.</li>
              <li><strong>How to request:</strong> Contact support@e-code.ai with your account email and reason for the refund request. Refunds are processed within 5-10 business days.</li>
            </ul>
            <p className="mt-2">Usage limits apply based on your plan tier. Overage charges are billed separately and are non-refundable.</p>
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
