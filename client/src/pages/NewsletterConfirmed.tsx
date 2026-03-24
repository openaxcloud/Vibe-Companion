import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewsletterConfirmed() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="newsletter-confirmed">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#0CCE6B]/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-[#0CCE6B]" />
          </div>
          <h1 className="text-3xl font-bold mb-4">You're subscribed!</h1>
          <p className="text-[var(--ide-text-secondary)] mb-8 leading-relaxed">You'll receive product updates, engineering blog posts, and community highlights in your inbox.</p>
          <Link href="/"><Button className="bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl" data-testid="cta-back-home">Back to home</Button></Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
