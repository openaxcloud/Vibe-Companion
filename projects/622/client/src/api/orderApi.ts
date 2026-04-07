import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded";

export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled" | "returned";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  currency: string;
  imageUrl?: string | null;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  company?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface OrderPaymentSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  discountTotal: number;
  total: number;
  currency: string;
}

export interface OrderTimelineEvent {
  id: string;
  type:
    | "created"
    | "payment_authorized"
    | "payment_failed"
    | "payment_captured"
    | "status_changed"
    | "shipment_created"
    | "note";
  message: string;
  createdAt: string;
  createdBy?: string | null;
  meta?: Record<string, unknown>;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  email: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  placedAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  paymentMethod?: string | null;
  shippingMethod?: string | null;
  items: OrderItem[];
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  paymentSummary: OrderPaymentSummary;
  tags?: string[];
  notes?: string | null;
  timeline?: OrderTimelineEvent[];
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  placedAt: string;
  updatedAt: string;
  total: number;
  currency: string;
  itemCount: number;
  email: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListUserOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface ListAdminOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  fromDate?: string;
  toDate?: string;
  email?: string;
  orderNumber?: string;
  search?: string;
}

export interface UpdateOrderStatusPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  cancellationReason?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface OrderApiConfig {
  baseURL?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  axiosInstance?: AxiosInstance;
}

const DEFAULT_BASE_URL = "/api";

class OrderApi {
  private axios: AxiosInstance;
  private getAuthToken?: () => string | null | Promise<string | null>;

  constructor(config: OrderApiConfig = {}) {
    this.getAuthToken = config.getAuthToken;

    if (config.axiosInstance) {
      this.axios = config.axiosInstance;
    } else {
      this.axios = axios.create({
        baseURL: config.baseURL || DEFAULT_BASE_URL,
        withCredentials: true,
      });
    }

    this.axios.interceptors.request.use(async (requestConfig: AxiosRequestConfig) => {
      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) {
          if (!requestConfig.headers) {
            requestConfig.headers = {};
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (requestConfig.headers as any).Authorization = `Bearer undefined`;
        }
      }
      return requestConfig;
    });
  }

  private unwrap<T>(response: AxiosResponse<T>): T {
    return response.data;
  }

  async listMyOrders(params: ListUserOrdersParams = {}): Promise<PaginatedResponse<OrderListItem>> {
    const response = await this.axios.get<PaginatedResponse<OrderListItem>>("/orders/my", {
      params,
    });
    return this.unwrap(response);
  }

  async getMyOrderById(orderId: string): Promise<Order> {
    const response = await this.axios.get<Order>(`/orders/my/undefined`);
    return this.unwrap(response);
  }

  async listAdminOrders(
    params: ListAdminOrdersParams = {},
  ): Promise<PaginatedResponse<OrderListItem>> {
    const response = await this.axios.get<PaginatedResponse<OrderListItem>>("/admin/orders", {
      params,
    });
    return this.unwrap(response);
  }

  async getAdminOrderById(orderId: string): Promise<Order> {
    const response = await this.axios.get<Order>(`/admin/orders/undefined`);
    return this.unwrap(response);
  }

  async updateAdminOrder(
    orderId: string,
    payload: UpdateOrderStatusPayload,
  ): Promise<Order> {
    const response = await this.axios.patch<Order>(
      `/admin/orders/undefined`,
      payload,
    );
    return this.unwrap(response);
  }
}

let defaultOrderApi: OrderApi | null = null;

export const getOrderApi = (config?: OrderApiConfig): OrderApi => {
  if (!defaultOrderApi || config) {
    defaultOrderApi = new OrderApi(config);
  }
  return defaultOrderApi;
};

export const orderApi = getOrderApi();