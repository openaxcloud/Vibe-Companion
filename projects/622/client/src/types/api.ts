/* eslint-disable @typescript-eslint/no-explicit-any */

export type ISODateString = string;
export type UUID = string;

export interface ApiMeta {
  requestId?: string;
  timestamp?: ISODateString;
  version?: string;
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiErrorDetails {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: ApiErrorDetails[];
}

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiResponseError {
  success: false;
  error: ApiError;
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export interface PaginatedData<T> {
  items: T[];
  pagination: ApiPaginationMeta;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export interface User {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastLoginAt?: ISODateString;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthenticatedUser extends User {
  tokens: AuthTokens;
}

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

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
}

export interface ProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface Product {
  id: UUID;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  stock: number;
  status: ProductStatus;
  images: ProductImage[];
  categories: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  status?: ProductStatus;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  stock: number;
  status?: ProductStatus;
  images?: ProductImage[];
  categories?: string[];
}

export interface UpdateProductRequest {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  sku?: string;
  stock?: number;
  status?: ProductStatus;
  images?: ProductImage[];
  categories?: string[];
}

export interface CartItem {
  id: UUID;
  productId: UUID;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: Product;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Cart {
  id: UUID;
  userId: UUID;
  items: CartItem[];
  currency: string;
  subtotal: number;
  total: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AddToCartRequest {
  productId: UUID;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface RemoveCartItemRequest {
  cartItemId: UUID;
}

export interface ClearCartRequest {
  cartId: UUID;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
}

export interface Address {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  id: UUID;
  productId: UUID;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: UUID;
  userId: UUID;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currency: string;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  shippingAddress: Address;
  billingAddress?: Address;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  paidAt?: ISODateString;
  cancelledAt?: ISODateString;
}

export interface CreateOrderRequest {
  cartId: UUID;
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: PaymentMethod;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface ListOrdersQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  tokens: AuthTokens;
}

export type GetCurrentUserResponse = User;
export type UpdateProfileResponse = User;

export type ListProductsResponse = PaginatedData<Product>;
export type GetProductResponse = Product;
export type CreateProductResponse = Product;
export type UpdateProductResponse = Product;

export type GetCartResponse = Cart;
export type AddToCartResponse = Cart;
export type UpdateCartItemResponse = Cart;
export type RemoveCartItemResponse = Cart;
export type ClearCartResponse = Cart;

export type CreateOrderResponse = Order;
export type GetOrderResponse = Order;
export type ListOrdersResponse = PaginatedData<Order>;
export type UpdateOrderStatusResponse = Order;

export interface ApiEndpoints {
  auth: {
    login: (payload: LoginRequest) => Promise<ApiResponse<LoginResponse>>;
    register: (payload: RegisterRequest) => Promise<ApiResponse<RegisterResponse>>;
    me: () => Promise<ApiResponse<GetCurrentUserResponse>>;
    refresh: (payload: RefreshTokenRequest) => Promise<ApiResponse<AuthTokens>>;
    logout: () => Promise<ApiResponse<null>>;
  };
  users: {
    updateProfile: (payload: UpdateProfileRequest) => Promise<ApiResponse<UpdateProfileResponse>>;
    changePassword: (payload: ChangePasswordRequest) => Promise<ApiResponse<null>>;
  };
  products: {
    list: (query?: ProductListQuery) => Promise<ApiResponse<ListProductsResponse>>;
    get: (id: UUID) => Promise<ApiResponse<GetProductResponse>>;
    create: (payload: CreateProductRequest) => Promise<ApiResponse<CreateProductResponse>>;
    update: (id: UUID, payload: UpdateProductRequest) => Promise<ApiResponse<UpdateProductResponse>>;
    delete: (id: UUID) => Promise<ApiResponse<null>>;
  };
  cart: {
    get: () => Promise<ApiResponse<GetCartResponse>>;
    addItem: (payload: AddToCartRequest) => Promise<ApiResponse<AddToCartResponse>>;
    updateItem: (cartItemId: UUID, payload: UpdateCartItemRequest) => Promise<ApiResponse<UpdateCartItemResponse>>;
    removeItem: (payload: RemoveCartItemRequest) => Promise<ApiResponse<RemoveCartItemResponse>>;
    clear: (payload: ClearCartRequest) => Promise<ApiResponse<ClearCartResponse>>;
  };
  orders: {
    create: (payload: CreateOrderRequest) => Promise<ApiResponse<CreateOrderResponse>>;
    get: (id: UUID) => Promise<ApiResponse<GetOrderResponse>>;
    list: (query?: ListOrdersQuery) => Promise<ApiResponse<ListOrdersResponse>>;
    updateStatus: (id: UUID, payload: