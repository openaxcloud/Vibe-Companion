import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CardElement,
  useElements,
  useStripe,
  CardElementComponent,
} from "@stripe/react-stripe-js";

type ShippingDetails = {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type CheckoutPageProps = {
  /** Optional: if you want to pre-fill or override amount on the client */
  amountCents?: number;
  /** Optional: additional metadata or cart info to send to backend */
  cartId?: string;
};

type CreatePaymentIntentResponse = {
  clientSecret: string;
};

const initialShippingState: ShippingDetails = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const cardElementOptions: React.ComponentProps<CardElementComponent>["options"] =
  {
    style: {
      base: {
        color: "#32325d",
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#a0aec0",
        },
      },
      invalid: {
        color: "#e53e3e",
        iconColor: "#e53e3e",
      },
    },
    hidePostalCode: true,
  };

const isEmailValid = (email: string): boolean => {
  if (!email) return false;
  // Basic email validation
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isPhoneValid = (phone: string): boolean => {
  if (!phone) return false;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 7;
};

const CheckoutPage: React.FC<CheckoutPageProps> = ({ amountCents, cartId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [shipping, setShipping] = useState<ShippingDetails>(initialShippingState);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const isFormValid = useMemo(() => {
    if (!shipping.fullName.trim()) return false;
    if (!isEmailValid(shipping.email)) return false;
    if (!isPhoneValid(shipping.phone)) return false;
    if (!shipping.addressLine1.trim()) return false;
    if (!shipping.city.trim()) return false;
    if (!shipping.state.trim()) return false;
    if (!shipping.postalCode.trim()) return false;
    if (!shipping.country.trim()) return false;
    return true;
  }, [shipping]);

  useEffect(() => {
    setFormError(null);
  }, [shipping]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setShipping((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createPaymentIntent = async (
    shippingDetails: ShippingDetails
  ): Promise<string> => {
    const payload = {
      amountCents: amountCents ?? undefined,
      cartId: cartId ?? undefined,
      shipping: shippingDetails,
    };

    const response = await fetch("/api/checkout/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await response
        .json()
        .catch(() => ({ message: "Unable to process payment at this time." }));
      throw new Error(
        (errorMessage && (errorMessage as { message?: string }).message) ||
          "Unable to process payment at this time."
      );
    }

    const data = (await response.json()) as CreatePaymentIntentResponse;
    if (!data.clientSecret) {
      throw new Error("Unable to initialize payment. Please try again.");
    }

    return data.clientSecret;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setApiError(null);
    setCardError(null);

    if (!stripe || !elements) {
      setFormError("Payment system is not ready. Please wait a moment and try again.");
      return;
    }

    if (!isFormValid) {
      setFormError("Please fill in all required fields correctly.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setFormError("Payment card details are not available. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);

    try {
      const clientSecret = await createPaymentIntent(shipping);

      const billingDetails = {
        name: shipping.fullName,
        email: shipping.email,
        phone: shipping.phone,
        address: {
          line1: shipping.addressLine1,
          line2: shipping.addressLine2 || undefined,
          city: shipping.city,
          state: shipping.state,
          postal_code: shipping.postalCode,
          country: shipping.country,
        },
      };

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: billingDetails,
        },
        shipping: {
          name: shipping.fullName,
          address: {
            line1: shipping.addressLine1,
            line2: shipping.addressLine2 || undefined,
            city: shipping.city,
            state: shipping.state,
            postal_code: shipping.postalCode,
            country: shipping.country,
          },
          phone: shipping.phone,
        },
      });

      if (error) {
        setCardError(error.message ?? "There was an issue confirming your card.");
        setIsSubmitting(false);
        return;
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        setApiError("Payment was not successful. Please try again.");
        setIsSubmitting(false);
        return;
      }

      navigate("/order/confirmation", {
        state: {
          paymentIntentId: paymentIntent.id,
          amountCents: amountCents,
          email: shipping.email,
        },
        replace: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setApiError(message);
      setIsSubmitting(false);
    }
  };

  const onCardChange: React.ComponentProps<CardElementComponent>["onChange"] = (
    event
  ) => {
    if (event.error) {
      setCardError(event.error.message ?? "Invalid card information.");
    } else {
      setCardError(null);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">Checkout</h1>

        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <section className="checkout-section">
            <h2 className="checkout-section-title">Contact Information</h2>
            <div className="checkout-grid">
              <div className="form-field">
                <label htmlFor="fullName">
                  Full Name<span className="required">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={shipping.fullName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="email">
                  Email<span className="required">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={shipping.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="phone">
                  Phone<span className="required">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={shipping.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title">Shipping Address</h2>
            <div className="checkout-grid">
              <div className="form-field">
                <label htmlFor="addressLine1">
                  Address Line 1<span className="required">*</span>
                </label>
                <input
                  id="addressLine1"