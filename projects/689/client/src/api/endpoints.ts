import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optionally handle global unauthorized state here (e.g., redirect to login)
    }
    return Promise.reject(error);
  }
);

const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------- Auth Schemas ----------

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;

const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

const LoginResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

const RegisterResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

const RefreshTokenResponseSchema = z.object({
  tokens: AuthTokensSchema,
});

export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;

const MeResponseSchema = UserSchema;

// ---------- Product Schemas ----------

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  price: z.number(),
  currency: z.string().default('USD'),
  imageUrl: z.string().url().nullable().optional(),
  inStock: z.boolean().default(true),
  stockQuantity: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

const ProductListQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  category: z.string().optional(),
});

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

const PaginatedProductsResponseSchema = z.object({
  items: z.array(ProductSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginatedProductsResponse = z.infer<typeof PaginatedProductsResponseSchema>;

// ---------- Cart Schemas ----------

const CartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number(),
  name: z.string(),
  imageUrl: z.string().url().nullable().optional(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

const CartSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  items: z.array(CartItemSchema),
  currency: z.string().default('USD'),
  subtotal: z.number(),
  total: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Cart = z.infer<typeof CartSchema>;

const AddToCartRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;

const UpdateCartItemRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().nonnegative(),
});

export type UpdateCartItemRequest = z.infer<typeof UpdateCartItemRequestSchema>;

// ---------- Checkout & Orders Schemas ----------

const AddressSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().optional(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.enum(['card', 'paypal', 'bank_transfer']),
  last4: z.string().optional(),
  brand: z.string().optional(),
  expMonth: z.number().int().optional(),
  expYear: z.number().int().optional(),
});

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

const OrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number(),
  imageUrl: z.string().url().nullable().optional(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

const OrderSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  items: z.array(OrderItemSchema),
  currency: z.string(),
  subtotal: z.number(),
  total: z.number(),
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

const CreateCheckoutSessionRequestSchema = z.object({
  cartId: z.string(),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  paymentMethodId: z.string().optional(),
});

export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;

const CreateCheckoutSessionResponseSchema = z.object({
  checkoutUrl: z.string().url().optional(),
  clientSecret: z.string().optional(),
  order: OrderSchema.optional(),
});

export type CreateCheckoutSessionResponse = z.infer<typeof CreateCheckoutSessionResponseSchema>;

const OrderListQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']).optional(),
});

export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

const PaginatedOrdersResponseSchema = z.object({
  items: z.array(OrderSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginatedOrdersResponse = z.infer<typeof PaginatedOrdersResponseSchema>;

// ---------- Helper Types & Functions ----------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TQuery = unknown> {
  query?: TQuery;
  config?: AxiosRequestConfig;
}

interface MutationOptions<TBody = unknown> {
  body?: TBody;
  config?: AxiosRequestConfig;
}

const buildQueryString = (params: Record<string, unknown> | undefined): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?undefined` : '';
};

const parseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('API response validation failed', result.error);
    throw new Error('Invalid server response format');
  }
  return result.data;
};

const request = async <TResponse, TQuery = unknown, TBody = unknown>(
  method: HttpMethod,
  url: string,
  schema: z.ZodSchema<TResponse>,
  options: RequestOptions<TQuery> & MutationOptions<TBody> = {}
): Promise<TResponse> => {
  const { query, body, config } = options;
  const queryString = buildQuery