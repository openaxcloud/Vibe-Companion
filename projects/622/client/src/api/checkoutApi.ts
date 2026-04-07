import axios, { AxiosInstance, AxiosResponse } from "axios";

export interface CheckoutItem {
  productId: string;
  quantity: number;
  priceId?: string;
}

export interface CheckoutInitiatePayload {
  items: CheckoutItem[];
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  couponCode?: string;
}

export interface CheckoutInitiateResponse {
  checkoutSessionId?: string;
  stripeClientSecret?: string;
  publishableKey?: string;
  mode: "payment" | "subscription" | "setup";
}

export interface PaymentIntentClientSecretResponse {
  clientSecret: string;
  publishableKey?: string;
}

export interface ConfirmOrderPayload {
  paymentIntentId: string;
  checkoutSessionId?: string;
  cartId?: string;
  items?: CheckoutItem[];
  shippingAddressId?: string;
  billingAddressId?: string;
  metadata?: Record<string, string>;
}

export interface ConfirmOrderResponse {
  orderId: string;
  status: "created" | "paid" | "failed" | "pending";
  redirectUrl?: string;
}

export interface CheckoutStatusResponse {
  status: "requires_payment" | "processing" | "succeeded" | "canceled";
  paymentIntentId?: string;
  checkoutSessionId?: string;
  orderId?: string;
}

export interface ApplyCouponPayload {
  couponCode: string;
  cartId?: string;
  items?: CheckoutItem[];
}

export interface ApplyCouponResponse {
  isValid: boolean;
  discountAmount: number;
  currency: string;
  message?: string;
}

const API_BASE_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { __APP_API_BASE_URL__?: string })
      .__APP_API_BASE_URL__) ||
  process.env.REACT_APP_API_BASE_URL ||
  "/api";

class CheckoutApi {
  private http: AxiosInstance;

  constructor(baseURL: string = API_BASE_URL) {
    this.http = axios.create({
      baseURL,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async initiateCheckout(
    payload: CheckoutInitiatePayload
  ): Promise<CheckoutInitiateResponse> {
    const response: AxiosResponse<CheckoutInitiateResponse> =
      await this.http.post("/checkout/initiate", payload);
    return response.data;
  }

  async getPaymentIntentClientSecret(
    cartId: string
  ): Promise<PaymentIntentClientSecretResponse> {
    const response: AxiosResponse<PaymentIntentClientSecretResponse> =
      await this.http.post("/checkout/payment-intent", { cartId });
    return response.data;
  }

  async confirmOrder(
    payload: ConfirmOrderPayload
  ): Promise<ConfirmOrderResponse> {
    const response: AxiosResponse<ConfirmOrderResponse> =
      await this.http.post("/checkout/confirm", payload);
    return response.data;
  }

  async getCheckoutStatus(
    checkoutSessionId: string
  ): Promise<CheckoutStatusResponse> {
    const response: AxiosResponse<CheckoutStatusResponse> =
      await this.http.get(`/checkout/status/undefined`);
    return response.data;
  }

  async applyCoupon(
    payload: ApplyCouponPayload
  ): Promise<ApplyCouponResponse> {
    const response: AxiosResponse<ApplyCouponResponse> = await this.http.post(
      "/checkout/apply-coupon",
      payload
    );
    return response.data;
  }

  async cancelCheckout(checkoutSessionId: string): Promise<void> {
    await this.http.post("/checkout/cancel", { checkoutSessionId });
  }
}

const checkoutApi = new CheckoutApi();

export default checkoutApi;