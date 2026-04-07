// Shared client-side types for Product, CartItem, Order, and API responses

// ===== Utility Types =====

export type ID = string;

export type Nullable<T> = T | null;

export type Maybe<T> = T | null | undefined;

export type ISODateString = string;

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'SEK' | 'NZD';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string | number;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string | number;
    details?: ApiErrorDetail[];
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ===== Product Types =====

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductImage {
  id: ID;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

export interface ProductVariantOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: ID;
  sku: string;
  title: string;
  price: number;
  currency: CurrencyCode;
  stock: number;
  options: ProductVariantOption[];
  image?: ProductImage;
  active: boolean;
}

export interface Product {
  id: ID;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number | null;
  currency: CurrencyCode;
  status: ProductStatus;
  stock: number;
  sku?: string;
  images: ProductImage[];
  variants?: ProductVariant[];
  tags?: string[];
  categoryIds?: ID[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ===== Cart Types =====

export interface CartItemBase {
  id: ID;
  productId: ID;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SimpleCartItem extends CartItemBase {
  type: 'simple';
  variantId?: undefined;
}

export interface VariantCartItem extends CartItemBase {
  type: 'variant';
  variantId: ID;
}

export type CartItem = SimpleCartItem | VariantCartItem;

export interface CartPriceBreakdown {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: CurrencyCode;
}

export interface Cart {
  id: ID;
  userId?: ID;
  items: CartItem[];
  pricing: CartPriceBreakdown;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ===== Order Types =====

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type ShippingStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'returned';

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface OrderItem {
  id: ID;
  productId: ID;
  variantId?: ID;
  name: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  image?: ProductImage;
}

export interface OrderPriceBreakdown {
  itemsTotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: CurrencyCode;
}

export interface Order {
  id: ID;
  orderNumber: string;
  userId?: ID;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  items: OrderItem[];
  pricing: OrderPriceBreakdown;
  shippingAddress: Address;
  billingAddress: Address;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  paidAt?: ISODateString;
  shippedAt?: ISODateString;
  deliveredAt?: ISODateString;
  cancelledAt?: ISODateString;
  refundedAt?: ISODateString;
}

// ===== API Request / Response Payloads =====

// Product endpoints

export interface GetProductsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: ID;
  tags?: string[];
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
}

export type GetProductsResponse = ApiResponse<Product[]>;

export type GetProductResponse = ApiResponse<Product>;

// Cart endpoints

export interface AddToCartPayload {
  productId: ID;
  variantId?: ID;
  quantity: number;
}

export interface UpdateCartItemPayload {
  cartItemId: ID;
  quantity: number;
}

export interface RemoveCartItemPayload {
  cartItemId: ID;
}

export type GetCartResponse = ApiResponse<Cart>;

export type UpdateCartResponse = ApiResponse<Cart>;

// Order endpoints

export interface CreateOrderPayload {
  cartId: ID;
  shippingAddress: Address;
  billingAddress: Address;
  notes?: string;
}

export type CreateOrderResponse = ApiResponse<Order>;

export interface GetOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
}

export type GetOrdersResponse = ApiResponse<Order[]>;

export type GetOrderResponse = ApiResponse<Order>;

// ===== Client-Side Helper Types =====

export interface PaginatedResult<T> {
  items: T[];
  meta: Required<ApiMeta>;
}

export interface WithLoading<T> {
  data: T;
  loading: boolean;
  error?: string;
}