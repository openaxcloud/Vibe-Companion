import { z } from "zod";

export const orderIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Order id is required")
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid order id format"),
});

export type OrderIdParamSchema = z.infer<typeof orderIdParamSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"], {
    errorMap: () => ({
      message:
        "Invalid status. Allowed values: pending, processing, shipped, delivered, cancelled",
    }),
  }),
});

export type UpdateOrderStatusSchema = z.infer<typeof updateOrderStatusSchema>;

export const orderStatusQuerySchema = z.object({
  status: z
    .enum(["pending", "processing", "shipped", "delivered", "cancelled"])
    .optional(),
});

export type OrderStatusQuerySchema = z.infer<typeof orderStatusQuerySchema>;