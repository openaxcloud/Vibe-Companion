import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Mail } from "lucide-react";

export default function NewsletterConfirm() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="newsletter-confirm">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#0079F2]/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-[#0079F2]" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Check your email</h1>
          <p className="text-[var(--ide-text-secondary)] leading-relaxed">We've sent a confirmation email to your inbox. Click the link in the email to confirm your subscription to the E-Code newsletter.</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
