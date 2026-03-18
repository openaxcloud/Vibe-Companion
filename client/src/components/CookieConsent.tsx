import { useState, useEffect } from "react";
import { Link } from "wouter";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 bg-[var(--ide-panel)] border-t border-[var(--ide-border)] shadow-lg" data-testid="cookie-consent">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-[var(--ide-text-secondary)] flex-1">
          We use essential cookies to keep you signed in and ensure the platform works properly. No tracking cookies are used.
          See our{" "}
          <Link href="/privacy" className="text-[#0079F2] hover:underline">Privacy Policy</Link>.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)] transition-colors"
            data-testid="cookie-decline"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm rounded-lg bg-[#0079F2] text-white hover:bg-[#0066CC] transition-colors"
            data-testid="cookie-accept"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
