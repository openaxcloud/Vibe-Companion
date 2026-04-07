import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "name" | "price" | "createdAt";
  sortDir?: "asc" | "desc";
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddToCartRequest {
  productId: string;
  quantity?: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface PaymentIntentRequest {
  cartId?: string;
  currency?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: OrderStatus;
  paymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
}

export interface AdminListOrdersParams extends ListOrdersParams {
  userId?: string;
  email?: string;
}

export interface AdminUpdateOrderRequest {
  status?: OrderStatus;
  trackingNumber?: string | null;
  note?: string | null;
}

export class ApiError extends Error {
  public status?: number;
  public data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private getAuthToken?: () => string | null;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig = {}) {
    const { baseURL = "/api", timeout = 15000, getAuthToken, onUnauthorized } = config;

    this.getAuthToken = getAuthToken;
    this.onUnauthorized = onUnauthorized;

    this.axiosInstance = axios.create({
      baseURL,
      timeout,
      withCredentials: true,
    });

    this.axiosInstance.interceptors.request.use(
      (requestConfig: AxiosRequestConfig) => {
        if (this.getAuthToken) {
          const token = this.getAuthToken();
          if (token && requestConfig.headers) {
            requestConfig.headers.Authorization = `Bearer undefined`;
          }
        }
        return requestConfig;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && this.onUnauthorized) {
          this.onUnauthorized();
        }
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private normalizeError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const message =
        (typeof data === "object" && data && "message" in data && (data as any).message) ||
        error.message ||
        "Request failed";
      return new ApiError(String(message), status, data);
    }

    if (error instanceof Error) {
      return new ApiError(error.message);
    }

    return new ApiError("Unknown error");
  }

  private async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  private async post<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, body, config);
    return response.data;
  }

  private async patch<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.patch<T>(url, body, config);
    return response.data;
  }

  private async put<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, body, config);
    return response.data;
  }

  private async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  // Auth

  public async login(payload: LoginRequest): Promise<LoginResponse> {
    return this.post<LoginResponse, LoginRequest>("/auth/login", payload);
  }

  public async register(payload: RegisterRequest): Promise<RegisterResponse> {
    return this.post<RegisterResponse, RegisterRequest>("/auth/register", payload);
  }

  public async getMe(): Promise<User> {
    return this.get<User>("/auth/me");
  }

  // Products

  public async listProducts(params: ListProductsParams = {}): Promise<PaginatedResult<Product>> {
    return this.get<PaginatedResult<Product>>("/products", { params });
  }

  public async getProduct(idOrSlug: string): Promise<Product> {
    return this.get<Product>(`/products/undefined`);
  }

  // Cart

  public async getCart(): Promise<Cart> {
    return this.get<Cart>("/cart");
  }

  public async addToCart(payload: AddToCartRequest): Promise<Cart> {
    return this.post<Cart, AddToCartRequest>("/cart/items", payload);
  }

  public async updateCartItem(itemId: string, payload: UpdateCartItemRequest): Promise<Cart> {
    return this.patch<Cart, UpdateCartItemRequest>(
      `/cart/items/undefined`,
      payload
    );
  }

  public async removeCartItem(itemId: string): Promise<Cart> {
    return this.delete<Cart>(`/cart/items/undefined`);
  }

  public async clearCart(): Promise<Cart> {
    return this.delete<Cart>("/cart");
  }

  // Payments

  public async createPaymentIntent(payload: PaymentIntentRequest = {}): Promise<PaymentIntentResponse> {
    return this.post<PaymentIntentResponse, PaymentIntentRequest>("/payments/intent", payload);
  }

  // Orders - user

  public async listOrders(params: ListOrdersParams = {}): Promise<PaginatedResult<Order>> {
    return this.get<PaginatedResult<Order>>("/orders", { params });
  }

  public async getOrder(orderId: string): Promise<Order> {
    return this.get<Order>(`/orders/undefined`);
  }

  // Orders - admin

  public async adminListOrders(
    params: AdminListOrdersParams = {}
  ): Promise<PaginatedResult<Order>> {
    return this.get<PaginatedResult<Order>>("/admin/orders", { params });
  }

  public async adminUpdateOrder(
    orderId: string,
    payload: AdminUpdateOrderRequest
  ): Promise<Order> {
    return this.patch<Order, AdminUpdateOrderRequest>(
      `/admin/orders/${encodeURIComponent(orderId)