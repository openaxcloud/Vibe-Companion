import { z } from "zod";

export const OrderStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "FAILED",
]);

export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: OrderStatusEnum,
    reason: z
      .string()
      .trim()
      .min(1, "Reason is required")
      .max(500, "Reason must be at most 500 characters")
      .optional(),
  }),
  params: z.object({
    orderId: z
      .string()
      .trim()
      .min(1, "Order ID is required"),
  }),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>["body"] & {
  orderId: string;
};

const positiveIntString = z
  .string()
  .regex(/^\d+$/, "Must be a positive integer")
  .transform((val) => parseInt(val, 10))
  .refine((val) => val > 0, "Must be greater than 0");

const nonNegativeIntString = z
  .string()
  .regex(/^\d+$/, "Must be a non-negative integer")
  .transform((val) => parseInt(val, 10))
  .refine((val) => val >= 0, "Must be greater than or equal to 0");

export const orderPaginationQuerySchema = z.object({
  query: z.object({
    page: nonNegativeIntString.optional().default("0"),
    limit: positiveIntString.optional().default("20"),
    status: OrderStatusEnum.optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "totalAmount"])
      .optional()
      .default("createdAt"),
    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .default("desc"),
    fromDate: z
      .string()
      .datetime()
      .optional(),
    toDate: z
      .string()
      .datetime()
      .optional(),
    search: z
      .string()
      .trim()
      .max(200, "Search query must be at most 200 characters")
      .optional(),
    customerId: z
      .string()
      .trim()
      .min(1, "Customer ID cannot be empty")
      .optional(),
  }),
}).refine(
  (data) => {
    const { fromDate, toDate } = data.query;
    if (!fromDate || !toDate) return true;
    return new Date(fromDate) <= new Date(toDate);
  },
  {
    message: "fromDate must be earlier than or equal to toDate",
    path: ["query", "fromDate"],
  }
);

export type OrderPaginationQueryInputRaw = z.input<typeof orderPaginationQuerySchema>["query"];

export interface OrderPaginationQueryFilters {
  page: number;
  limit: number;
  status?: OrderStatus;
  sortBy: "createdAt" | "updatedAt" | "totalAmount";
  sortOrder: "asc" | "desc";
  fromDate?: string;
  toDate?: string;
  search?: string;
  customerId?: string;
}

export const parseOrderPaginationFilters = (
  query: unknown
): OrderPaginationQueryFilters => {
  const result = orderPaginationQuerySchema.parse({ query });
  return {
    page: result.query.page as number,
    limit: result.query.limit as number,
    status: result.query.status,
    sortBy: result.query.sortBy as "createdAt" | "updatedAt" | "totalAmount",
    sortOrder: result.query.sortOrder as "asc" | "desc",
    fromDate: result.query.fromDate,
    toDate: result.query.toDate,
    search: result.query.search,
    customerId: result.query.customerId,
  };
};