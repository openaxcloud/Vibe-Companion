import { z } from "zod";

export const cartQuantitySchema = z
  .number({
    required_error: "Quantity is required",
    invalid_type_error: "Quantity must be a number",
  })
  .int("Quantity must be an integer")
  .min(1, "Quantity must be at least 1")
  .max(100, "Quantity cannot exceed 100");

export const productIdSchema = z
  .string({
    required_error: "Product ID is required",
    invalid_type_error: "Product ID must be a string",
  })
  .min(1, "Product ID cannot be empty")
  .max(128, "Product ID is too long");

export const addToCartSchema = z.object({
  productId: productIdSchema,
  quantity: cartQuantitySchema,
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartQuantitySchema = z.object({
  productId: productIdSchema,
  quantity: cartQuantitySchema,
});

export type UpdateCartQuantityInput = z.infer<typeof updateCartQuantitySchema>;

export const removeFromCartSchema = z.object({
  productId: productIdSchema,
});

export type RemoveFromCartInput = z.infer<typeof removeFromCartSchema>;