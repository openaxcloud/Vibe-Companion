import { z } from "zod";

export const cartItemBaseSchema = z.object({
  productId: z
    .string({
      required_error: "Product ID is required",
      invalid_type_error: "Product ID must be a string",
    })
    .min(1, "Product ID cannot be empty"),
  variantId: z
    .string({
      invalid_type_error: "Variant ID must be a string",
    })
    .min(1, "Variant ID cannot be empty")
    .optional(),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(999, "Quantity must not exceed 999"),
});

export const addCartItemSchema = cartItemBaseSchema.extend({
  // For future extensibility, e.g. customizations, notes, etc.
  note: z
    .string({
      invalid_type_error: "Note must be a string",
    })
    .max(500, "Note must not exceed 500 characters")
    .optional(),
});

export const updateCartItemSchema = z.object({
  cartItemId: z
    .string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    })
    .min(1, "Cart item ID cannot be empty"),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative")
    .max(999, "Quantity must not exceed 999"),
  // Optional: allow updating note or other metadata
  note: z
    .string({
      invalid_type_error: "Note must be a string",
    })
    .max(500, "Note must not exceed 500 characters")
    .optional(),
});

export const removeCartItemSchema = z.object({
  cartItemId: z
    .string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    })
    .min(1, "Cart item ID cannot be empty"),
});

export const clearCartSchema = z.object({
  // Placeholder for potential future fields like "confirm: true"
});

export type CartItemBaseInput = z.infer<typeof cartItemBaseSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;