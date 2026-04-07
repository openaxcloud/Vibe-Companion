import React, { useCallback, useEffect, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";

const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ?? "";
const CHECKOUT_SESSION_API = "/api/checkout/session";

if (!STRIPE_PUBLISHABLE_KEY) {
  // In a real app you might want to throw or log this differently
  // but failing fast here prevents confusing runtime behavior.
  // eslint-disable-next-line no-console
  console.error("Missing REACT_APP_STRIPE_PUBLISHABLE_KEY environment variable.");
}

let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

type CheckoutSessionResponse =
  | {
      sessionId: string;
      url?: string | null;
    }
  | {
      error: string;
    };

const Checkout: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(CHECKOUT_SESSION_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Include any items or metadata your backend expects here.
          // Example:
          // items: [
          //   { id: "sku_123", quantity: 1 }
          // ]
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status undefined`);
      }

      const data: CheckoutSessionResponse = await response.json();

      if ("error" in data) {
        throw new Error(data.error || "Unable to create checkout session.");
      }

      const stripe = await getStripe();
      if (!stripe) {
        throw new Error("Stripe failed to initialize.");
      }

      // Prefer redirectToCheckout via sessionId, if provided.
      if (data.sessionId) {
        const { error } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (error) {
          throw error;
        }
        return;
      }

      // Fallback if backend returns a full URL instead of sessionId.
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("No sessionId or URL returned from checkout session API.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred during checkout.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Preload Stripe to improve UX.
    void getStripe();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Checkout</h1>
        <p style={styles.subtitle}>
          Complete your purchase securely with Stripe. You&apos;ll be redirected to a hosted
          checkout page.
        </p>

        {errorMessage && (
          <div style={styles.errorBox} role="alert">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {}),
          }}
          onClick={handleCheckout}
          disabled={isLoading}
        >
          {isLoading ? "Redirecting to Stripe..." : "Proceed to Payment"}
        </button>

        <p style={styles.helperText}>
          By continuing, you agree to the terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: "1.5rem",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    backgroundColor: "#020617",
    borderRadius: "1rem",
    padding: "2rem",
    boxSizing: "border-box",
    boxShadow: "0 24px 60px rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.2)",
  },
  title: {
    margin: 0,
    marginBottom: "0.75rem",
    color: "#e5e7eb",
    fontSize: "1.75rem",
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    marginBottom: "1.75rem",
    color: "#9ca3af",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },
  errorBox: {
    marginBottom: "1rem",
    padding: "0.75rem 1rem",
    borderRadius: "0.75rem",
    backgroundColor: "rgba(239,68,68,0.12)",
    color: "#fecaca",
    fontSize: "0.875rem",
    border: "1px solid rgba(248,113,113,0.4)",
  },
  button: {
    width: "100%",
    padding: "0.85rem 1.25rem",
    borderRadius: "9999px",
    border: "none",
    outline: "none",
    cursor: "pointer",
    backgroundImage:
      "linear-gradient(135deg, #4f46e5 0%, #6366f1 35%, #22c55e 65%, #0ea5e9 100%)",
    backgroundSize: "200% 200%",
    color: "#f9fafb",
    fontSize: "0.95rem",
    fontWeight: 600,
    letterSpacing: "0.03em",
    boxShadow: "0 10px 30px rgba(79,70,229,0.6)",
    transition:
      "transform 0.15s ease-out, box-shadow 0.15s ease-out, background-position 0.5s ease-out, opacity 0.15s ease-out",
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
    boxShadow: "none",
    transform: "none",
    backgroundPosition: "center",
  },
  helperText: {
    marginTop: "1rem",
    marginBottom: 0,
    color: "#6b7280",
    fontSize: "0.8rem",
    textAlign: "center",
    lineHeight: 1.4,
  },
};

export default Checkout;