import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

export default function Privacy() {
  return (
    <MarketingLayout>
    <div className="min-h-screen text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-8 transition-colors" data-testid="link-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
        <p className="text-sm text-[var(--ide-text-muted)] mb-8">Last updated: March 10, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-[var(--ide-text-secondary)] text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly when using our Service:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-[var(--ide-text)]">Account Information:</strong> Email address, display name, and password (hashed)</li>
              <li><strong className="text-[var(--ide-text)]">Project Data:</strong> Code, files, and project configurations you create</li>
              <li><strong className="text-[var(--ide-text)]">Usage Data:</strong> Code execution logs, AI interactions, and feature usage patterns</li>
              <li><strong className="text-[var(--ide-text)]">Connected Accounts:</strong> GitHub account information when you connect your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your code execution requests</li>
              <li>Power AI-assisted coding features</li>
              <li>Track usage for plan limits and billing</li>
              <li>Detect and prevent abuse and security violations</li>
              <li>Send important service notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">3. Data Storage & Security</h2>
            <p>Your data is stored securely in PostgreSQL databases with encryption at rest. Passwords are hashed using bcrypt. Environment variables are encrypted. We implement industry-standard security measures including CSRF protection, rate limiting, and sandboxed code execution.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">4. AI & Code Processing</h2>
            <p>When you use AI features, your code context may be sent to third-party AI providers (OpenAI, Anthropic, Google) to generate responses. We do not use your code to train AI models. AI conversations are stored to provide conversation history within your projects.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>AI service providers (OpenAI, Anthropic, Google) for code assistance features</li>
              <li>Payment processors (Stripe) for subscription billing</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">6. Your Rights (GDPR)</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-[var(--ide-text)]">Access:</strong> Export all your data via Settings</li>
              <li><strong className="text-[var(--ide-text)]">Rectification:</strong> Update your profile information at any time</li>
              <li><strong className="text-[var(--ide-text)]">Erasure:</strong> Delete your account and all associated data</li>
              <li><strong className="text-[var(--ide-text)]">Portability:</strong> Download your data in JSON format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">7. Cookies</h2>
            <p>We use session cookies to maintain your authentication state. These are strictly necessary for the Service to function and cannot be disabled. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">8. Data Retention</h2>
            <p>We retain your data for as long as your account is active. When you delete your account, all associated data (projects, files, conversations, execution logs) is permanently deleted within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-3">10. Contact</h2>
            <p>For privacy-related questions, contact our Data Protection Officer at privacy@e-code.ai.</p>
          </section>
        </div>
      </div>
    </div>
    </MarketingLayout>
  );
}
