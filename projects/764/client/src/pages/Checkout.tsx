import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CardElement,
  useElements,
  useStripe,
  CardElementProps,
} from "@stripe/react-stripe-js";
import axios, { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  description?: string;
  price: number; // in smallest currency unit (e.g. cents)
  quantity: number;
  imageUrl?: string;
};

type OrderSummary = {
  items: CartItem[];
  currency: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
};

type CreatePaymentIntentResponse = {
  clientSecret: string;
  orderSummary: OrderSummary;
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

type CheckoutStatus = "idle" | "loading" | "processing" | "succeeded" | "failed";

const formatPrice = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100);
  } catch {
    return `$undefined`;
  }
};

const cardElementOptions: CardElementProps["options"] = {
  style: {
    base: {
      color: "#111827",
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#9CA3AF",
      },
    },
    invalid: {
      color: "#EF4444",
      iconColor: "#EF4444",
    },
  },
  hidePostalCode: true,
};

const Checkout: React.FC = () => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [cardError, setCardError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [isCardComplete, setIsCardComplete] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  const isLoading = status === "loading";
  const isProcessing = status === "processing";

  const isSubmitDisabled = useMemo(
    () =>
      !stripe ||
      !elements ||
      !clientSecret ||
      isLoading ||
      isProcessing ||
      !isCardComplete ||
      !email.trim() ||
      !name.trim(),
    [stripe, elements, clientSecret, isLoading, isProcessing, isCardComplete, email, name]
  );

  const handleAxiosErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return (
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        axiosError.message ||
        "Unable to complete the request. Please try again."
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  };

  const fetchPaymentIntent = useCallback(async () => {
    setStatus("loading");
    setGeneralError(null);

    try {
      const response = await axios.post<CreatePaymentIntentResponse>("/api/checkout/create-payment-intent");
      setClientSecret(response.data.clientSecret);
      setOrderSummary(response.data.orderSummary);
      setStatus("idle");
    } catch (error) {
      setClientSecret(null);
      setOrderSummary(null);
      setGeneralError(handleAxiosErrorMessage(error));
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    void fetchPaymentIntent();
  }, [fetchPaymentIntent]);

  const handleCardChange = (event: any) => {
    setCardError(event.error ? event.error.message : null);
    setIsCardComplete(event.complete);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setGeneralError(null);
    setCardError(null);

    if (!stripe || !elements || !clientSecret) {
      setGeneralError("Payment system is not ready. Please wait a moment and try again.");
      return;
    }

    setStatus("processing");

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Payment form is not ready. Please refresh and try again.");
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: name.trim(),
            email: email.trim(),
          },
        },
      });

      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setCardError(error.message || "Your card could not be processed. Please check your details.");
        } else {
          setGeneralError(error.message || "An unexpected error occurred. Please try again.");
        }
        setStatus("failed");
        return;
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        setGeneralError("Payment could not be completed. Please try again.");
        setStatus("failed");
        return;
      }

      try {
        await axios.post("/api/checkout/confirm-order", {
          paymentIntentId: paymentIntent.id,
          email: email.trim(),
          name: name.trim(),
        });
      } catch (error) {
        setGeneralError(
          handleAxiosErrorMessage(error) +
            " Your payment was processed, but we could not confirm the order automatically. Please contact support with your payment reference."
        );
        setStatus("failed");
        return;
      }

      setStatus("succeeded");
      navigate("/order/confirmation", { state: { paymentIntentId: paymentIntent.id } });
    } catch (error) {
      setGeneralError(handleAxiosErrorMessage(error));
      setStatus("failed");
    }
  };

  const handleRetry = () => {
    void fetchPaymentIntent();
  };

  const isReadyToRenderForm = !!clientSecret && !!orderSummary;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Checkout</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your payment details to complete your purchase securely.
          </p>
        </div>

        {generalError && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <div className="font-medium mb-1">There was a problem with your checkout</div>
            <p>{generalError}</p>
            {status === "failed" && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 inline-flex items-center rounded-md border border-transparent bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Payment details</h2>

              {!isReadyToRenderForm && (
                <div className="flex items-center justify-center py-10">
                  <svg
                    className="animate-spin h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span className="ml-2 text-sm text-gray-500">
                    Preparing secure payment form...
                  </span>