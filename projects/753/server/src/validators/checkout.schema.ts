import { z } from "zod";

export const CheckoutLineItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1"),
  priceId: z.string().min(1, "Price ID is required").optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const CheckoutCustomerSchema = z.object({
  email: z
    .string({
      required_error: "Customer email is required",
      invalid_type_error: "Customer email must be a string",
    })
    .email("Invalid email format"),
  name: z
    .string({
      invalid_type_error: "Customer name must be a string",
    })
    .min(1, "Customer name is required")
    .optional(),
  userId: z
    .string({
      invalid_type_error: "User ID must be a string",
    })
    .min(1, "User ID cannot be empty")
    .optional(),
});

export const CheckoutAddressSchema = z.object({
  line1: z
    .string({
      required_error: "Address line 1 is required",
      invalid_type_error: "Address line 1 must be a string",
    })
    .min(1, "Address line 1 cannot be empty"),
  line2: z
    .string({
      invalid_type_error: "Address line 2 must be a string",
    })
    .optional(),
  city: z
    .string({
      required_error: "City is required",
      invalid_type_error: "City must be a string",
    })
    .min(1, "City cannot be empty"),
  state: z
    .string({
      invalid_type_error: "State must be a string",
    })
    .min(1, "State cannot be empty")
    .optional(),
  postalCode: z
    .string({
      required_error: "Postal code is required",
      invalid_type_error: "Postal code must be a string",
    })
    .min(1, "Postal code cannot be empty"),
  country: z
    .string({
      required_error: "Country is required",
      invalid_type_error: "Country must be a string",
    })
    .min(2, "Country must be at least 2 characters")
    .max(2, "Country must be 2-character ISO code"),
});

export const CheckoutCreateSchema = z.object({
  currency: z
    .string({
      required_error: "Currency is required",
      invalid_type_error: "Currency must be a string",
    })
    .min(3, "Currency must be a valid ISO currency code")
    .max(3, "Currency must be a valid ISO currency code")
    .transform((v) => v.toLowerCase()),
  customer: CheckoutCustomerSchema,
  lineItems: z
    .array(CheckoutLineItemSchema, {
      required_error: "At least one line item is required",
      invalid_type_error: "Line items must be an array",
    })
    .min(1, "At least one line item is required"),
  billingAddress: CheckoutAddressSchema.optional(),
  shippingAddress: CheckoutAddressSchema.optional(),
  successUrl: z
    .string({
      required_error: "Success URL is required",
      invalid_type_error: "Success URL must be a string",
    })
    .url("Success URL must be a valid URL"),
  cancelUrl: z
    .string({
      required_error: "Cancel URL is required",
      invalid_type_error: "Cancel URL must be a string",
    })
    .url("Cancel URL must be a valid URL"),
  metadata: z.record(z.string(), z.string()).optional(),
  allowPromotionCodes: z
    .boolean({
      invalid_type_error: "allowPromotionCodes must be a boolean",
    })
    .optional()
    .default(false),
  clientReferenceId: z
    .string({
      invalid_type_error: "Client reference ID must be a string",
    })
    .min(1, "Client reference ID cannot be empty")
    .optional(),
});

export type CheckoutCreateInput = z.infer<typeof CheckoutCreateSchema>;

export const WebhookVerifySchema = z.object({
  payload: z.union(
    [
      z.string({
        required_error: "Payload is required",
        invalid_type_error: "Payload must be a string or Buffer",
      }),
      z.instanceof(Buffer, {
        message: "Payload must be a string or Buffer",
      }),
    ],
    {
      required_error: "Payload is required",
      invalid_type_error: "Payload must be a string or Buffer",
    }
  ),
  signature: z
    .string({
      required_error: "Signature is required",
      invalid_type_error: "Signature must be a string",
    })
    .min(1, "Signature cannot be empty"),
  secret: z
    .string({
      required_error: "Secret is required",
      invalid_type_error: "Secret must be a string",
    })
    .min(1, "Secret cannot be empty"),
  tolerance: z
    .number({
      invalid_type_error: "Tolerance must be a number",
    })
    .int("Tolerance must be an integer")
    .positive("Tolerance must be positive")
    .optional(),
});

export type WebhookVerifyInput = z.infer<typeof WebhookVerifySchema>;