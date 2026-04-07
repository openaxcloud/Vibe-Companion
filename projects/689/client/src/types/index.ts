import { z } from "zod";

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  category?: string | null;
  tags?: string[];
  inStock: boolean;
  stockQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  product?: Product;
  addedAt: string;
};

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
};

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  imageUrl?: string | null;
};

export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddress: ShippingAddress;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type UserRole = "user" | "admin";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  avatarUrl?: string | null;
};

export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  currency: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  inStock: z.boolean(),
  stockQuantity: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional()
});

export const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  currency: z.string().min(1),
  product: productSchema.optional(),
  addedAt: z.string()
});

export const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  currency: z.string().min(1),
  imageUrl: z.string().url().nullable().optional()
});

export const shippingAddressSchema = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable().optional(),
  city: z.string().min(1),
  state: z.string().nullable().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().nullable().optional()
});

export const orderStatusSchema = z.enum([
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);

export const paymentStatusSchema = z.enum([
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded"
]);

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(orderItemSchema),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.string().min(1),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  shippingAddress: shippingAddressSchema,
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional()
});

export const userRoleSchema = z.enum(["user", "admin"]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: userRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  avatarUrl: z.string().url().nullable().optional()
});

export const productArraySchema = z.array(productSchema);
export const cartItemArraySchema = z.array(cartItemSchema);
export const orderArraySchema = z.array(orderSchema);
export const userArraySchema = z.array(userSchema);

export type ProductInput = z.infer<typeof productSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type UserInput = z.infer<typeof userSchema>;