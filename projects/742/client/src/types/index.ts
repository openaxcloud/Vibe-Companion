export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'CNY' | 'SEK' | 'NZD';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'authorized' | 'paid' | 'refunded' | 'partially_refunded';

export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';

export type UserRole = 'customer' | 'admin' | 'manager' | 'support';

export interface Price {
  /**
   * Amount in the smallest currency unit (e.g., cents)
   */
  amount: number;
  currency: CurrencyCode;
  /**
   * Optional human-readable formatted price (e.g., "$10.00")
   */
  formatted?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

export interface ProductOptionValue {
  id: string;
  name: string;
  value: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: ProductOptionValue[];
}

export interface Variant {
  id: string;
  sku: string;
  productId: string;
  title: string;
  /**
   * Optional unique handle/slug for the variant
   */
  handle?: string;
  price: Price;
  compareAtPrice?: Price | null;
  /**
   * Option selections for this variant, e.g. { Size: "M", Color: "Red" }
   */
  selectedOptions: Record<string, string>;
  /**
   * Inventory count available for sale
   */
  inventoryQuantity: number;
  /**
   * Whether the variant is available for sale
   */
  availableForSale: boolean;
  /**
   * Optional variant-specific image, falls back to product images if not provided
   */
  image?: ProductImage;
  /**
   * Arbitrary metadata for integrations / tracking
   */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  /**
   * Short description or subtitle for quick listing views
   */
  shortDescription?: string;
  handle: string;
  /**
   * Main product price (can represent the lowest variant price)
   */
  priceRange: {
    min: Price;
    max: Price;
  };
  /**
   * Optional default price if product is not variant-based
   */
  defaultPrice?: Price;
  /**
   * Tags for search and filtering
   */
  tags?: string[];
  /**
   * Product categories or collections identifiers
   */
  categories?: string[];
  images: ProductImage[];
  options: ProductOption[];
  variants: Variant[];
  /**
   * Whether the product is currently visible in the storefront
   */
  isActive: boolean;
  /**
   * SEO metadata
   */
  seo?: {
    title?: string;
    description?: string;
  };
  /**
   * Arbitrary metadata for integrations / tracking
   */
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  quantity: number;
  price: Price;
  /**
   * Total line price (price * quantity)
   */
  lineTotal: Price;
  /**
   * Snapshot of selected options at the time of adding to cart
   */
  selectedOptions: Record<string, string>;
  image?: ProductImage;
  /**
   * Whether the item is saved for later
   */
  savedForLater?: boolean;
  /**
   * Arbitrary metadata for integrations / tracking
   */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Address {
  id?: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;
  phone?: string;
  /**
   * Whether this is the default address for the user
   */
  isDefault?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  quantity: number;
  price: Price;
  lineTotal: Price;
  selectedOptions: Record<string, string>;
  image?: ProductImage;
}

export interface OrderTotals {
  /**
   * Sum of line items before discounts and taxes
   */
  subtotal: Price;
  /**
   * Total discounts applied
   */
  discountTotal: Price;
  /**
   * Shipping cost
   */
  shippingTotal: Price;
  /**
   * Tax total
   */
  taxTotal: Price;
  /**
   * Grand total after all charges
   */
  grandTotal: Price;
}

export interface PaymentDetails {
  status: PaymentStatus;
  method?: string;
  transactionId?: string;
  /**
   * Timestamp in ISO format
   */
  paidAt?: string;
}

export interface FulfillmentDetails {
  status: FulfillmentStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  /**
   * Timestamp in ISO format
   */
  shippedAt?: string;
  /**
   * Timestamp in ISO format
   */
  deliveredAt?: string;
}

export interface Order {
  id: string;
  userId?: string | null;
  /**
   * Public order number shown to customers
   */
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  totals: OrderTotals;
  currency: CurrencyCode;
  email: string;
  shippingAddress: Address;
  billingAddress?: Address;
  payment: PaymentDetails;
  fulfillment?: FulfillmentDetails;
  /**
   * Optional notes added by customer or staff
   */
  notes?: string;
  /**
   * Arbitrary metadata for integrations / tracking
   */
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  /**
   * URL to avatar image
   */
  avatarUrl?: string;
  role: UserRole;
  /**
   * Whether the user has verified their email address
   */
  emailVerified: boolean;
  defaultAddressId?: string;
  addresses?: Address[];
  /**
   * Arbitrary metadata for integrations / tracking
   */
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}