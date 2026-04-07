import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CardElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type CheckoutProps = {
  /** Optional amount in smallest currency unit (e.g. cents) if not provided via query or backend */
  defaultAmount?: number;
};

type CreatePaymentIntentResponse = {
  clientSecret: string;
};

type BackendError = {
  message: string;
};

const CARD_ELEMENT_OPTIONS: Parameters<typeof CardElement>[0] = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: "16px",
      color: "#32325d",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      "::placeholder": {
        color: "#a0aec0",
      },
    },
    invalid: {
      color: "#e53e3e",
      iconColor: "#e53e3e",
    },
  },
};

const Checkout: React.FC<CheckoutProps> = ({ defaultAmount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingIntent, setIsLoadingIntent] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [billingName, setBillingName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const amountFromQuery = searchParams.get("amount");
  const amount =
    (amountFromQuery ? parseInt(amountFromQuery, 10) : undefined) ??
    defaultAmount ??
    0;

  const currencyFromQuery = searchParams.get("currency") || "usd";

  const createPaymentIntent = useCallback(async () => {
    if (!amount || amount <= 0) {
      setErrorMessage("Invalid payment amount.");
      return;
    }

    try {
      setIsLoadingIntent(true);
      setErrorMessage(null);

      const response = await fetch("/api/payments/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: currencyFromQuery,
        }),
      });

      if (!response.ok) {
        const err: BackendError = await response.json().catch(() => ({
          message: "Unable to create payment intent.",
        }));
        throw new Error(err.message || "Unable to create payment intent.");
      }

      const data: CreatePaymentIntentResponse = await response.json();
      if (!data.clientSecret) {
        throw new Error("Missing client secret from server.");
      }

      setClientSecret(data.clientSecret);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start checkout.";
      setErrorMessage(message);
      setClientSecret(null);
    } finally {
      setIsLoadingIntent(false);
    }
  }, [amount, currencyFromQuery]);

  useEffect(() => {
    void createPaymentIntent();
  }, [createPaymentIntent]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("Stripe has not loaded yet. Please try again.");
      return;
    }

    if (!clientSecret) {
      setErrorMessage("Payment is not initialized. Please refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setErrorMessage("Unable to find card details element.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: billingName || undefined,
              email: email || undefined,
            },
          },
        }
      );

      if (error) {
        setErrorMessage(error.message ?? "Payment failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (!paymentIntent) {
        setErrorMessage("No payment information returned. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (paymentIntent.status === "succeeded") {
        navigate("/checkout/success", {
          replace: true,
          state: {
            paymentIntentId: paymentIntent.id,
            amount,
            currency: currencyFromQuery,
          },
        });
      } else {
        setErrorMessage(
          `Payment status: undefined. Please contact support if this persists.`
        );
        setIsSubmitting(false);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the payment.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  const isDisabled =
    !stripe || !elements || !clientSecret || isSubmitting || isLoadingIntent;

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>Checkout</h1>
      <p style={{ marginBottom: "1.5rem", color: "#4a5568" }}>
        Complete your payment securely with your card details.
      </p>

      {amount > 0 && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#f7fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              textTransform: "uppercase",
              color: "#718096",
              marginBottom: "0.25rem",
            }}
          >
            Amount to Pay
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a202c" }}>
            {(amount / 100).toFixed(2)} {currencyFromQuery.toUpperCase()}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="billingName"
            style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Name on card
          </label>
          <input
            id="billingName"
            type="text"
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            placeholder="Jane Doe"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e0",
              fontSize: "0.95rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Email (for receipt)
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.doe@example.com"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e0",
              fontSize: "0.95rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Card details
          </label>
          <div
            style={{
              padding: "0.75rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #cbd5e0",
              backgroundColor: "#ffffff",
            }}
          >
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div