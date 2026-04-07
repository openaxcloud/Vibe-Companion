import { z } from "zod";

export const cartItemBaseSchema = z.object({
  productId: z
    .string({
      required_error: "Product ID is required",
      invalid_type_error: "Product ID must be a string",
    })
    .trim()
    .min(1, "Product ID cannot be empty"),
  variantId: z
    .string({
      invalid_type_error: "Variant ID must be a string",
    })
    .trim()
    .min(1, "Variant ID cannot be empty")
    .optional(),
});

export const addCartItemSchema = cartItemBaseSchema.extend({
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(100, "Quantity must be less than or equal to 100"),
});

export const updateCartItemSchema = z.object({
  cartItemId: z
    .string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    })
    .trim()
    .min(1, "Cart item ID cannot be empty"),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative")
    .max(100, "Quantity must be less than or equal to 100"),
});

export const bulkAddCartItemsSchema = z.object({
  items: z
    .array(addCartItemSchema, {
      required_error: "Items array is required",
      invalid_type_error: "Items must be an array",
    })
    .min(1, "At least one item is required")
    .max(50, "Cannot add more than 50 items at once"),
});

export const removeCartItemSchema = z.object({
  cartItemId: z
    .string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    })
    .trim()
    .min(1, "Cart item ID cannot be empty"),
});

export const clearCartSchema = z.object({
  confirm: z
    .boolean({
      required_error: "Confirm flag is required",
      invalid_type_error: "Confirm must be a boolean",
    })
    .refine((val) => val === true, {
      message: "Confirm must be true to clear cart",
    }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type BulkAddCartItemsInput = z.infer<typeof bulkAddCartItemsSchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
export type ClearCartInput = z.infer<typeof clearCartSchema>;