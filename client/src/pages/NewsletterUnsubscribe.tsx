import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NewsletterUnsubscribe() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="newsletter-unsubscribe">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Unsubscribed</h1>
          <p className="text-[var(--ide-text-secondary)] mb-8 leading-relaxed">You've been unsubscribed from the E-Code newsletter. You won't receive any more emails from us unless you subscribe again.</p>
          <Link href="/"><Button variant="outline" className="rounded-xl" data-testid="cta-back-home">Back to home</Button></Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
