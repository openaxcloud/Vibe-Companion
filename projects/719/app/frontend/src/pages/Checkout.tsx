import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Appearance,
  loadStripe,
  PaymentIntentResult,
  Stripe,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type ShippingAddress = {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type CheckoutFormData = {
  email: string;
  phone?: string;
  shipping: ShippingAddress;
};

type CreatePaymentIntentResponse = {
  clientSecret: string;
};

type CreateOrderResponse = {
  orderId: string;
};

type BackendError = {
  message: string;
  field?: string;
};

type CheckoutProps = {
  stripePublicKey: string;
  apiBaseUrl?: string;
};

type CheckoutInnerProps = {
  apiBaseUrl: string;
};

const stripePromiseCache: { [key: string]: Promise<Stripe | null> } = {};

const getStripe = (publicKey: string): Promise<Stripe | null> => {
  if (!stripePromiseCache[publicKey]) {
    stripePromiseCache[publicKey] = loadStripe(publicKey);
  }
  return stripePromiseCache[publicKey];
};

const DEFAULT_API_BASE = "/api";

const validateEmail = (email: string): boolean => {
  if (!email) return false;
  // Simple RFC 5322-compliant-ish regex for basic validation
  const re =
    // eslint-disable-next-line no-control-regex
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i;
  return re.test(String(email).toLowerCase());
};

const validatePostalCode = (postalCode: string): boolean => {
  return postalCode.trim().length >= 3;
};

const initialShipping: ShippingAddress = {
  fullName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const CardElementOptions: React.ComponentProps<typeof CardElement>["options"] = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1f2933",
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      "::placeholder": {
        color: "#9fa6b2",
      },
    },
    invalid: {
      color: "#e02424",
    },
  },
  hidePostalCode: true,
};

const CheckoutInner: React.FC<CheckoutInnerProps> = ({ apiBaseUrl }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CheckoutFormData>({
    email: "",
    phone: "",
    shipping: initialShipping,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validateForm = useCallback(
    (data: CheckoutFormData): Record<string, string> => {
      const errors: Record<string, string> = {};

      if (!validateEmail(data.email)) {
        errors.email = "Please enter a valid email address.";
      }

      if (!data.shipping.fullName.trim()) {
        errors.fullName = "Full name is required.";
      }
      if (!data.shipping.addressLine1.trim()) {
        errors.addressLine1 = "Address line 1 is required.";
      }
      if (!data.shipping.city.trim()) {
        errors.city = "City is required.";
      }
      if (!data.shipping.state.trim()) {
        errors.state = "State / Province is required.";
      }
      if (!validatePostalCode(data.shipping.postalCode)) {
        errors.postalCode = "Please enter a valid postal / ZIP code.";
      }
      if (!data.shipping.country.trim()) {
        errors.country = "Country is required.";
      }

      return errors;
    },
    []
  );

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
      isShippingField = false
    ) => {
      const { name, value } = e.target;

      setFormData((prev) => {
        if (isShippingField) {
          return {
            ...prev,
            shipping: {
              ...prev.shipping,
              [name]: value,
            },
          };
        }
        return {
          ...prev,
          [name]: value,
        };
      });

      setFormErrors((prev) => {
        const updatedErrors = { ...prev };
        if (name in updatedErrors) {
          delete updatedErrors[name];
        }
        return updatedErrors;
      });

      if (hasAttemptedSubmit) {
        setFormErrors(validateForm({ ...formData, [isShippingField ? "shipping" : name]: isShippingField ? { ...formData.shipping, [name]: value } : value } as CheckoutFormData));
      }
    },
    [formData, hasAttemptedSubmit, validateForm]
  );

  const handleCardChange = useCallback(
    (event: any) => {
      if (event.error) {
        setCardError(event.error.message ?? "Invalid card details.");
      } else {
        setCardError(null);
      }
      setIsPaymentReady(event.complete === true);
    },
    []
  );

  const formatShippingForOrder = (shipping: ShippingAddress) => ({
    fullName: shipping.fullName.trim(),
    addressLine1: shipping.addressLine1.trim(),
    addressLine2: shipping.addressLine2?.trim() || "",
    city: shipping.city.trim(),
    state: shipping.state.trim(),
    postalCode: shipping.postalCode.trim(),
    country: shipping.country.trim(),
  });

  const createPaymentIntent = useCallback(
    async (): Promise<string> => {
      const response = await fetch(`undefined/checkout/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          shipping: formatShippingForOrder(formData.shipping),
        }),
      });

      if (!response.ok) {
        let message = "Unable to initiate payment. Please try again.";
        try {
          const errorBody: BackendError | { error?: BackendError } = await response.json();
          if ("message" in errorBody && errorBody.message) {
            message = errorBody.message;
          } else if ("error" in errorBody && errorBody.error?.message) {
            message = errorBody.error.message;
          }
        } catch {
          // ignore parsing error, use default message
        }
        throw new Error(message);
      }

      const data: CreatePaymentIntentResponse = await response.json();
      if (!data.clientSecret) {
        throw new Error("Missing payment information from server.");
      }
      return data.clientSecret;
    },
    [apiBaseUrl, formData.email, formData.shipping]
  );

  const createOrder = useCallback(
    async (paymentIntentId: string): Promise<string> => {
      const response = await fetch(`undefined/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          paymentIntentId,
          email: formData.email,
          phone: formData.phone,
          shipping: formatShippingForOrder(formData.shipping),
        }),
      });

      if (!response.ok) {
        let message = "Payment succeeded, but we could not create your order. Please contact support.";
        try {
          const errorBody: BackendError | { error?: BackendError } = await response.json();
          if ("message" in errorBody && errorBody.message) {
            message = errorBody.message;
          } else if ("error" in errorBody && errorBody.error?.message) {
            message = errorBody.error.message;
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(message);
      }

      const data: CreateOrderResponse = await response.json();
      if (!data.orderId) {
        throw new Error("Order created, but missing order ID.");
      }
      return data.orderId;
    },
    [apiBaseUrl, formData.email, formData.phone, formData.shipping]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      setHasAttemptedSubmit(true);
      setGlobalError(null);

      const errors =