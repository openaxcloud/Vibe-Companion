/* Shared TypeScript types for Product, Category, Cart, Order, and API responses */

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: ID | null;
  isActive: boolean;
}

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductVariant {
  id: ID;
  sku: string;
  name: string;
  price: number; // in smallest currency unit (e.g., cents)
  compareAtPrice?: number | null;
  stock: number;
  attributes?: Record<string, string | number | boolean>;
  isDefault: boolean;
}

export interface ProductImage {
  id: ID;
  url: string;
  altText?: string;
  isPrimary: boolean;
}

export interface Product extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  categoryId: ID;
  category?: Category;
  price: number; // base price in smallest currency unit
  compareAtPrice?: number | null;
  currency: string; // ISO 4217 code, e.g., "USD"
  sku?: string;
  stock: number;
  isFeatured: boolean;
  status: ProductStatus;
  images: ProductImage[];
  variants?: ProductVariant[];
  tags?: string[];
}

export interface CartItem {
  id: ID;
  productId: ID;
  product?: Product;
  variantId?: ID | null;
  quantity: number;
  unitPrice: number; // in smallest currency unit
  currency: string;
}

export interface Cart extends BaseEntity {
  userId?: ID | null;
  items: CartItem[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type ShippingStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 code, e.g., "US"
  phone?: string;
}

export interface BillingAddress extends ShippingAddress {
  company?: string;
  taxId?: string;
}

export interface OrderItem {
  id: ID;
  productId: ID;
  productName: string;
  variantId?: ID | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface Order extends BaseEntity {
  userId?: ID | null;
  cartId?: ID | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  items: OrderItem[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  shippingAddress: ShippingAddress;
  billingAddress: BillingAddress;
  notes?: string;
}

/* Generic API response types */

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string | number;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: ApiErrorDetail[];
  statusCode?: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/* Convenience types for common API payloads */

export type ProductListResponse = ApiSuccessResponse<Product[]>;
export type ProductDetailResponse = ApiSuccessResponse<Product>;
export type CategoryListResponse = ApiSuccessResponse<Category[]>;
export type CategoryDetailResponse = ApiSuccessResponse<Category>;
export type CartResponse = ApiSuccessResponse<Cart>;
export type OrderListResponse = ApiSuccessResponse<Order[]>;
export type OrderDetailResponse = ApiSuccessResponse<Order>;