import React, { useCallback, useEffect, useState } from "react";

type CheckoutMode = "idle" | "loading" | "redirecting" | "success" | "cancel" | "error";

interface CreateCheckoutSessionResponse {
  url: string;
}

const CheckoutPage: React.FC = () => {
  const [mode, setMode] = useState<CheckoutMode>("idle");
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const successParam = searchParams.get("success");
  const canceledParam = searchParams.get("canceled");

  useEffect(() => {
    if (successParam === "true") {
      setMode("success");
    } else if (canceledParam === "true") {
      setMode("cancel");
    } else {
      setMode("idle");
    }
  }, [successParam, canceledParam]);

  const createCheckoutSession = useCallback(async () => {
    setError(null);
    setMode("loading");
    try {
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed with status undefined`);
      }

      const data: CreateCheckoutSessionResponse = await response.json();
      if (!data.url) {
        throw new Error("Stripe checkout URL was not provided by server.");
      }

      setMode("redirecting");
      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred while starting checkout.";
      setError(message);
      setMode("error");
    }
  }, []);

  const renderContent = () => {
    if (mode === "success") {
      return (
        <div style={styles.card}>
          <h1 style={styles.title}>Payment successful</h1>
          <p style={styles.paragraph}>
            Thank you for your purchase. Your payment has been processed successfully.
          </p>
          <p style={styles.paragraph}>
            You should receive a confirmation email from Stripe shortly. You can now safely close
            this page or return to the app.
          </p>
          <button style={styles.buttonSecondary} onClick={() => window.location.assign("/")}>
            Back to Home
          </button>
        </div>
      );
    }

    if (mode === "cancel") {
      return (
        <div style={styles.card}>
          <h1 style={styles.title}>Payment canceled</h1>
          <p style={styles.paragraph}>
            You canceled the checkout process. No charges were made to your payment method.
          </p>
          <p style={styles.paragraph}>
            If this was a mistake or you changed your mind, you can restart the checkout process
            using the button below.
          </p>
          <button style={styles.buttonPrimary} onClick={createCheckoutSession}>
            Restart Checkout
          </button>
        </div>
      );
    }

    if (mode === "error") {
      return (
        <div style={styles.card}>
          <h1 style={styles.title}>Unable to start checkout</h1>
          <p style={{ ...styles.paragraph, color: "#b00020" }}>{error}</p>
          <p style={styles.paragraph}>
            Please try again in a moment. If the problem persists, contact support.
          </p>
          <div style={styles.buttonRow}>
            <button style={styles.buttonPrimary} onClick={createCheckoutSession}>
              Try Again
            </button>
            <button style={styles.buttonSecondary} onClick={() => window.location.assign("/")}>
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Checkout</h1>
        <p style={styles.paragraph}>
          When you proceed, you will be redirected to a secure Stripe-hosted checkout page to
          complete your payment. After payment, you will be brought back here with a success or
          cancellation message.
        </p>
        <button
          style={{
            ...styles.buttonPrimary,
            ...(mode === "loading" || mode === "redirecting" ? styles.buttonDisabled : {}),
          }}
          onClick={createCheckoutSession}
          disabled={mode === "loading" || mode === "redirecting"}
        >
          {mode === "loading"
            ? "Preparing checkout..."
            : mode === "redirecting"
            ? "Redirecting to Stripe..."
            : "Proceed to Secure Checkout"}
        </button>
        {mode === "loading" || mode === "redirecting" ? (
          <p style={{ ...styles.paragraph, marginTop: 12, fontSize: 13 }}>
            Please do not close this tab while we redirect you to Stripe.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>{renderContent()}</div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  root: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    backgroundColor: "#f5f5f7",
    padding: "32px 16px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
    width: "100%",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
    boxSizing: "border-box",
  },
  title: {
    margin: 0,
    marginBottom: 12,
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
  },
  paragraph: {
    margin: 0,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#4b5563",
  },
  buttonPrimary: {
    marginTop: 20,
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 180,
  },
  buttonSecondary: {
    marginTop: 20,
    padding: "10px 18px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    cursor: "pointer",
    backgroundColor: "#ffffff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "default",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
};

export default CheckoutPage;