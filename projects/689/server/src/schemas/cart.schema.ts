import { z } from "zod";

export const CartItemBaseSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1"),
  variantId: z.string().optional(),
});

export const AddCartItemSchema = CartItemBaseSchema.extend({
  overwrite: z
    .boolean({
      invalid_type_error: "Overwrite must be a boolean value",
    })
    .optional(),
});

export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z.object({
  cartItemId: z.string().min(1, "Cart item ID is required"),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(0, "Quantity must be 0 or greater"),
});

export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

export const RemoveCartItemSchema = z.object({
  cartItemId: z.string().min(1, "Cart item ID is required"),
});

export type RemoveCartItemInput = z.infer<typeof RemoveCartItemSchema>;

export const CartItemResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  name: z.string(),
  imageUrl: z.string().url().nullable().optional(),
  price: z.number().nonnegative(),
  quantity: z.number().int().nonnegative(),
  lineSubtotal: z.number().nonnegative(),
  lineDiscount: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CartTotalsSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  subtotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  shippingTotal: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  currency: z.string().length(3),
});

export const CartResponseSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  items: z.array(CartItemResponseSchema),
  totals: CartTotalsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CartItemResponse = z.infer<typeof CartItemResponseSchema>;
export type CartTotals = z.infer<typeof CartTotalsSchema>;
export type CartResponse = z.infer<typeof CartResponseSchema>;

export const ClearCartSchema = z.object({
  confirm: z
    .boolean({
      required_error: "Confirmation flag is required",
      invalid_type_error: "Confirmation flag must be a boolean",
    })
    .refine((val) => val === true, {
      message: "Confirm must be true to clear cart",
    }),
});

export type ClearCartInput = z.infer<typeof ClearCartSchema>;