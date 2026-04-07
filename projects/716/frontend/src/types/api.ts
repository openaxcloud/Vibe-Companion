/* eslint-disable @typescript-eslint/no-explicit-any */

export type UUID = string;
export type ISODateString = string;

/**
 * Common metadata fields shared by most API resources
 */
export interface BaseEntity {
  id: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * User and Auth Types
 */

export type UserRole = 'customer' | 'admin';

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  user: User;
  tokens: AuthTokens;
}

/**
 * Product Types
 */

export interface ProductImage {
  url: string;
  altText?: string | null;
  isPrimary: boolean;
}

export interface Product extends BaseEntity {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  stock: number;
  isActive: boolean;
  category?: string | null;
  images: ProductImage[];
}

/**
 * Cart Types
 */

export interface CartItem extends BaseEntity {
  cartId: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: Product;
}

export interface Cart extends BaseEntity {
  userId: UUID | null;
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

/**
 * Order Types
 */

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface PaymentDetails {
  provider: 'stripe' | 'paypal' | 'manual' | 'test';
  status: 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';
  transactionId?: string | null;
  amount: number;
  currency: string;
  rawProviderResponse?: any;
}

export interface OrderItem extends BaseEntity {
  orderId: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productSnapshot: {
    id: UUID;
    name: string;
    sku: string;
    price: number;
  };
}

export interface Order extends BaseEntity {
  userId: UUID | null;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  payment: PaymentDetails;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  currency: string;
}

/**
 * Generic API Response Shapes
 */

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: ApiErrorDetail[] | Record<string, any>;
}

export interface ApiListMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ApiListMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

/**
 * Request Payloads
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
}

export interface CreateCartItemRequest {
  productId: UUID;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CheckoutRequest {
  cartId: UUID;
  shippingAddress: ShippingAddress;
  paymentProvider: PaymentDetails['provider'];
}

/**
 * API Route Constants (for frontend usage)
 */

export const API_ROUTES = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    me: '/api/auth/me',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },
  users: {
    base: '/api/users',
    me: '/api/users/me',
  },
  products: {
    base: '/api/products',
    byId: (id: UUID) => `/api/products/undefined`,
    bySlug: (slug: string) => `/api/products/slug/undefined`,
  },
  cart: {
    base: '/api/cart',
    items: '/api/cart/items',
    itemById: (id: UUID) => `/api/cart/items/undefined`,
  },
  orders: {
    base: '/api/orders',
    byId: (id: UUID) => `/api/orders/undefined`,
  },
} as const;