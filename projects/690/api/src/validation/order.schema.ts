import { z } from "zod";

export enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum PaymentMethod {
  CARD = "CARD",
  PAYPAL = "PAYPAL",
  BANK_TRANSFER = "BANK_TRANSFER",
  CASH_ON_DELIVERY = "CASH_ON_DELIVERY",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  AUTHORIZED = "AUTHORIZED",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export const orderItemSchema = z
  .object({
    productId: z.string().min(1, "Product ID is required"),
    variantId: z.string().min(1, "Variant ID is required").optional(),
    name: z.string().min(1, "Product name is required"),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1"),
    unitPrice: z
      .number()
      .nonnegative("Unit price must be greater than or equal to 0"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .toUpperCase(),
  })
  .strict();

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const shippingAddressSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    company: z.string().max(255).optional().nullable(),
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().max(255).optional().nullable(),
    city: z.string().min(1, "City is required"),
    state: z.string().max(255).optional().nullable(),
    postalCode: z.string().min(1, "Postal code is required"),
    country: z
      .string()
      .length(2, "Country must be a 2-letter ISO code")
      .toUpperCase(),
    phone: z.string().min(5, "Phone number is required").max(32),
  })
  .strict();

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

export const shippingMethodSchema = z
  .object({
    id: z.string().min(1, "Shipping method ID is required"),
    name: z.string().min(1, "Shipping method name is required"),
    price: z.number().nonnegative("Shipping price must be >= 0"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .toUpperCase(),
    estimatedDaysMin: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Minimum estimated delivery days"),
    estimatedDaysMax: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Maximum estimated delivery days"),
  })
  .strict()
  .refine(
    (val) =>
      val.estimatedDaysMin === undefined ||
      val.estimatedDaysMax === undefined ||
      val.estimatedDaysMin <= val.estimatedDaysMax,
    {
      message: "estimatedDaysMin must be less than or equal to estimatedDaysMax",
      path: ["estimatedDaysMin"],
    }
  );

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;

export const paymentMethodSchema = z
  .object({
    method: z.nativeEnum(PaymentMethod),
    cardLast4: z
      .string()
      .length(4, "Last 4 digits must be 4 characters")
      .optional(),
    cardBrand: z.string().max(64).optional(),
    paypalEmail: z.string().email().optional(),
    bankReference: z.string().max(128).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    switch (val.method) {
      case PaymentMethod.CARD:
        if (!val.cardLast4 || !val.cardBrand) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Card payments require cardLast4 and cardBrand",
            path: ["cardLast4"],
          });
        }
        break;
      case PaymentMethod.PAYPAL:
        if (!val.paypalEmail) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "PayPal payments require paypalEmail",
            path: ["paypalEmail"],
          });
        }
        break;
      case PaymentMethod.BANK_TRANSFER:
        if (!val.bankReference) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Bank transfer requires bankReference",
            path: ["bankReference"],
          });
        }
        break;
      case PaymentMethod.CASH_ON_DELIVERY:
      default:
        break;
    }
  });

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export const orderTotalsSchema = z
  .object({
    subtotal: z
      .number()
      .nonnegative("Subtotal must be greater than or equal to 0"),
    shipping: z
      .number()
      .nonnegative("Shipping must be greater than or equal to 0"),
    tax: z.number().nonnegative("Tax must be greater than or equal to 0"),
    discount: z
      .number()
      .nonnegative("Discount must be greater than or equal to 0")
      .default(0),
    total: z.number().nonnegative("Total must be greater than or equal to 0"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .toUpperCase(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const computedTotal = Number(
      (val.subtotal + val.shipping + val.tax - val.discount).toFixed(2)
    );
    const providedTotal = Number(val.total.toFixed(2));
    if (computedTotal !== providedTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total does not match the sum of subtotal, shipping, tax, and discount (expected undefined, got undefined)`,
        path: ["total"],
      });
    }
  });

export type OrderTotalsInput = z.infer<typeof orderTotalsSchema>;

export const orderMetadataSchema = z
  .record(z.string().max(255))
  .optional()
  .describe("Arbitrary metadata key/value pairs for the order");

export type OrderMetadataInput = z.infer<typeof orderMetadataSchema>;

export const createOrderSchema = z
  .object({
    customerId: z.string().min(1, "Customer ID is required"),
    items: z
      .array(orderItemSchema)
      .min(1, "At least one order item is required"),
    shippingAddress: shippingAddressSchema,
    shippingMethod: shippingMethodSchema,
    paymentMethod: paymentMethodSchema,
    totals: orderTotalsSchema,
    notes: z.string().max(2000).optional(),
    metadata: orderMetadataSchema,
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusUpdateSchema = z
  .object({
    orderId: z.string().min(1, "Order ID is required"),
    status: z.nativeEnum(OrderStatus),
    reason: z
      .string()
      .max(2000)
      .optional()
      .describe("Optional reason for status change"),
  })
  .strict()
  .superRefine((val, ctx) => {
    const statusRequiringReason = new Set<OrderStatus>([
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ]);
    if (statusRequiringReason.has(val.status) && !val.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reason is required when cancelling or refunding an order",
        path: ["reason"],
      });
    }
  });

export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

export const paymentStatusUpdateSchema = z
  .object({
    orderId: z.string().min(1, "Order ID is required"),
    paymentStatus: z.nativeEnum(PaymentStatus),
    transactionId: z
      .string()
      .min(1, "Transaction ID is required for paid/authorized/refunded")
      .optional(),
    failureCode: z.string().max(128).optional(),
    failureMessage: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const needsTransaction = new Set<PaymentStatus>([
      PaymentStatus.AUTHORIZED,
      PaymentStatus.PAID,
      PaymentStatus.REFUNDED,
    ]);
    if (needsTransaction.has(val.paymentStatus) && !val.transactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "transactionId is required for this payment status",
        path: