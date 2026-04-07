import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookie-consent");
    if (!accepted) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "true");
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-[var(--ide-sidebar-bg)] border border-[var(--ide-border)] rounded-lg p-4 shadow-xl" data-testid="cookie-consent">
      <p className="text-sm text-[var(--ide-text-secondary)] mb-3">
        We use cookies to improve your experience. By continuing to use E-Code, you agree to our cookie policy.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={accept} data-testid="button-cookie-accept">
          Accept
        </Button>
      </div>
    </div>
  );
}
