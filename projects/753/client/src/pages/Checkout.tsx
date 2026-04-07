import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
}

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; message?: string }
  | { status: "ready"; intent: PaymentIntent }
  | { status: "processing"; intent: PaymentIntent; message?: string }
  | { status: "succeeded"; intent: PaymentIntent }
  | { status: "error"; error: string };

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount / 100);
  } catch {
    return `undefined undefined`;
  }
};

const useQueryParams = () => {
  const [searchParams] = useSearchParams();
  return useMemo(
    () => ({
      payment_intent: searchParams.get("payment_intent"),
      payment_intent_client_secret: searchParams.get(
        "payment_intent_client_secret"
      ),
      redirect_status: searchParams.get("redirect_status") as
        | PaymentIntentStatus
        | null,
    }),
    [searchParams]
  );
};

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { payment_intent, payment_intent_client_secret, redirect_status } =
    useQueryParams();

  const clearQueryParams = useCallback(() => {
    navigate(location.pathname, { replace: true });
  }, [location.pathname, navigate]);

  const fetchPaymentIntent = useCallback(
    async (existingClientSecret?: string | null) => {
      setIsCreating(true);
      setState({ status: "loading", message: "Preparing your checkout..." });

      try {
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientSecret: existingClientSecret ?? undefined,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => undefined);
          throw new Error(
            errorBody?.error ||
              `Failed to create payment intent (status undefined)`
          );
        }

        const data = (await response.json()) as {
          id: string;
          clientSecret: string;
          amount: number;
          currency: string;
          status: PaymentIntentStatus;
        };

        const intent: PaymentIntent = {
          id: data.id,
          clientSecret: data.clientSecret,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
        };

        setState({ status: "ready", intent });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        setState({
          status: "error",
          error: message || "Unable to initialize checkout",
        });
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const refreshPaymentIntent = useCallback(
    async (clientSecret: string) => {
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/payments/refresh-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ clientSecret }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => undefined);
          throw new Error(
            errorBody?.error ||
              `Failed to refresh payment intent (status undefined)`
          );
        }

        const data = (await response.json()) as {
          id: string;
          clientSecret: string;
          amount: number;
          currency: string;
          status: PaymentIntentStatus;
        };

        const intent: PaymentIntent = {
          id: data.id,
          clientSecret: data.clientSecret,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
        };

        if (intent.status === "succeeded") {
          setState({ status: "succeeded", intent });
        } else if (state.status === "processing" || state.status === "ready") {
          setState({ status: "ready", intent });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        setState({
          status: "error",
          error: message || "Unable to refresh payment status",
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [state.status]
  );

  useEffect(() => {
    if (state.status === "idle") {
      fetchPaymentIntent(payment_intent_client_secret);
    }
  }, [fetchPaymentIntent, payment_intent_client_secret, state.status]);

  useEffect(() => {
    if (
      payment_intent &&
      payment_intent_client_secret &&
      redirect_status &&
      (redirect_status === "succeeded" || redirect_status === "processing")
    ) {
      setState((prev) => {
        if (
          prev.status === "ready" &&
          prev.intent.clientSecret === payment_intent_client_secret
        ) {
          return { status: "processing", intent: prev.intent };
        }
        if (
          prev.status === "processing" &&
          prev.intent.clientSecret === payment_intent_client_secret
        ) {
          return prev;
        }
        if (prev.status === "succeeded") return prev;
        return prev;
      });

      void refreshPaymentIntent(payment_intent_client_secret);
      clearQueryParams();
    }
  }, [
    clearQueryParams,
    payment_intent,
    payment_intent_client_secret,
    redirect_status,
    refreshPaymentIntent,
  ]);

  const handleSimulatePaymentCompletion = useCallback(() => {
    if (state.status !== "ready") return;
    setState({ status: "processing", intent: state.intent });

    setTimeout(() => {
      setState({ status: "succeeded", intent: state.intent });
    }, 1500);
  }, [state]);

  const handleRetry = useCallback(() => {
    fetchPaymentIntent();
  }, [fetchPaymentIntent]);

  const handleBackToShop = useCallback(() => {
    navigate("/shop");
  }, [navigate]);

  const currentAmount =
    state.status === "ready" ||
    state.status === "processing" ||
    state.status === "succeeded"
      ? formatCurrency(state.intent.amount, state.intent.currency)
      : null;

  return (
    <div className="checkout-page">
      <div className="checkout-page__container">
        <header className="checkout-page__header">
          <h1 className="checkout-page__title">Checkout</h1>
          <p className="checkout-page__subtitle">
            Complete your payment securely with Stripe.
          </p>
        </header>

        <section className="checkout-page__content">
          <div className="checkout-page__summary">
            <h2 className="checkout-page__section-title">Order Summary</h2>
            <div className="checkout-page__summary-card">
              <div className="checkout-page__summary-row">
                <span>Items total</span>
                <span>{currentAmount ?? "Calculating..."}</span>
              </div>
              <div className="checkout-page__summary-row checkout-page__summary-row--emphasis">
                <span>Total due</span>
                <span>{currentAmount ?? "Calculating..."}</span>
              </div>
              <p className="checkout-page__summary-note">
                You&apos;ll be redirected back here after confirming payment
                with your bank or card provider (when required).
              </p>
            </div>
          </div>

          <div className="checkout-page__payment">
            <h2 className="checkout-page__section-title">Payment</h2>

            {state.status === "loading" && (
              <div className="checkout-page__status checkout-page__status--info">
                <p>{state.message ?? "Initializing payment..."}</p>
              </div>
            )}

            {state.status === "error" && (
              <div className="checkout-page__status checkout-page__status--error">
                <p>{state.error}</p>
                <button
                  type="button"
                  className="checkout-page__button checkout-page__button--primary"
                  onClick={handleRetry}
                  disabled={isCreating}
                >
                  Try again
                </button>
              </div>
            )}

            {state.status === "succeeded" && (
              <div className="checkout-page__status checkout-page__status--success">
                <