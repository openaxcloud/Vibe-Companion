import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Elements,
  useStripe,
  useElements,
  CardElement,
} from "@stripe/react-stripe-js";
import { loadStripe, StripeCardElementOptions } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
);

type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

interface CheckoutPageProps {
  clientSecret?: string;
}

interface BackendInitResponse {
  clientSecret: string;
}

const CARD_ELEMENT_OPTIONS: StripeCardElementOptions = {
  style: {
    base: {
      color: "#1f2933",
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#9ca3af",
      },
    },
    invalid: {
      color: "#b91c1c",
      iconColor: "#b91c1c",
    },
  },
};

const CheckoutInner: React.FC<{ clientSecret: string }> = ({ clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentIntentStatus | null>(
    null
  );
  const [hasSucceeded, setHasSucceeded] = useState(false);

  const returnUrl = useMemo(
    () =>
      `undefined/checkout?undefined).toString()}`,
    []
  );

  useEffect(() => {
    if (!stripe || !clientSecret) return;

    const isReturnFromStripe = searchParams.get("return_from_stripe") === "1";
    if (!isReturnFromStripe) return;

    let isCancelled = false;

    const handleReturnFlow = async () => {
      try {
        const result = await stripe.retrievePaymentIntent(clientSecret);
        if (isCancelled) return;

        if (result.error || !result.paymentIntent) {
          if (result.error?.message) {
            setPaymentError(result.error.message);
          } else {
            setPaymentError("Unable to retrieve payment status.");
          }
          return;
        }

        setPaymentStatus(result.paymentIntent.status as PaymentIntentStatus);

        if (result.paymentIntent.status === "succeeded") {
          setHasSucceeded(true);
          setTimeout(() => navigate("/orders"), 1800);
        } else if (result.paymentIntent.status === "processing") {
          setPaymentError(
            "Your payment is still processing. You will see your order once it completes."
          );
        } else if (result.paymentIntent.status === "requires_payment_method") {
          setPaymentError(
            "Your payment was not successful, please try again with a different payment method."
          );
        }
      } catch (err) {
        setPaymentError("Failed to verify payment status. Please contact support.");
      }
    };

    handleReturnFlow();

    return () => {
      isCancelled = true;
    };
  }, [stripe, clientSecret, navigate, searchParams]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setPaymentError(null);

      if (!stripe || !elements) {
        setPaymentError("Stripe has not loaded yet. Please wait a moment.");
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setPaymentError("Payment element is not available.");
        return;
      }

      setIsProcessing(true);

      try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: {
              card: cardElement,
            },
          }
        );

        if (error) {
          if (error.type === "card_error" || error.type === "validation_error") {
            setPaymentError(error.message ?? "Your card was declined.");
          } else {
            setPaymentError("An unexpected error occurred. Please try again.");
          }
          setIsProcessing(false);
          return;
        }

        if (!paymentIntent) {
          setPaymentError("No payment intent found. Please try again.");
          setIsProcessing(false);
          return;
        }

        setPaymentStatus(paymentIntent.status as PaymentIntentStatus);

        if (paymentIntent.status === "succeeded") {
          setHasSucceeded(true);
          setTimeout(() => navigate("/orders"), 1500);
        } else if (paymentIntent.status === "processing") {
          setPaymentError(
            "Your payment is processing. You will see your order once it completes."
          );
        } else if (paymentIntent.status === "requires_payment_method") {
          setPaymentError(
            "Your payment was not successful, please try again with a different payment method."
          );
        }
      } catch {
        setPaymentError("Unable to process your payment. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [stripe, elements, clientSecret, navigate]
  );

  const isDisabled = useMemo(
    () => isProcessing || hasSucceeded || !stripe || !elements,
    [isProcessing, hasSucceeded, stripe, elements]
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg bg-white shadow-md rounded-xl p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Checkout
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your payment details to complete your purchase. Your transaction
          is secured and processed by Stripe.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="card-element"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Card details
            </label>
            <div
              id="card-element"
              className="border border-slate-300 rounded-md px-3 py-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition"
            >
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>

          {paymentError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {paymentError}
            </div>
          )}

          {hasSucceeded && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              Payment successful! Redirecting you to your orders...
            </div>
          )}

          {paymentStatus === "processing" && !hasSucceeded && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Your payment is processing. Please do not refresh or close this
              page.
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled}
            className={`w-full inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 undefined`}
          >
            {hasSucceeded
              ? "Payment completed"
              : isProcessing
              ? "Processing..."
              : "Pay now"}
          </button>

          <p className="text-[11px] text-slate-400 text-center mt-2">
            By confirming your payment, you agree to our Terms of Service and
            Privacy Policy.
          </p>
        </form>
      </div>
    </div>
  );
};

const Checkout: React.FC<CheckoutPageProps> = ({ clientSecret: propClientSecret }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(
    propClientSecret ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!propClientSecret);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (propClientSecret) {
      setClientSecret(propClientSecret);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const initPayment = async () => {
      setIsLoading