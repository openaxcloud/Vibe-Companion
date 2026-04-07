import { z } from "zod";

const stringTrimmed = z.string().trim();

export const productIdParamSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, "Product ID is required")
});

export const baseProductBodySchema = z.object({
  name: stringTrimmed
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  slug: stringTrimmed
    .min(1, "Slug is required")
    .max(200, "Slug must be at most 200 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (kebab-case)"),
  description: stringTrimmed
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: z
    .number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a number"
    })
    .finite("Price must be a valid number")
    .nonnegative("Price must be greater than or equal to 0")
    .max(1_000_000, "Price must be at most 1000000"),
  currency: stringTrimmed
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase(),
  sku: stringTrimmed
    .max(100, "SKU must be at most 100 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  barcode: stringTrimmed
    .max(100, "Barcode must be at most 100 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  categoryId: stringTrimmed
    .min(1, "Category is required"),
  brandId: stringTrimmed
    .min(1, "Brand is required")
    .optional(),
  images: z
    .array(
      z.object({
        url: stringTrimmed
          .url("Image URL must be a valid URL"),
        alt: stringTrimmed
          .max(255, "Alt text must be at most 255 characters")
          .optional()
          .or(z.literal("").transform(() => undefined)),
        isPrimary: z.boolean().optional()
      })
    )
    .max(25, "A product can have at most 25 images")
    .optional()
    .default([]),
  attributes: z
    .record(
      stringTrimmed
        .max(100, "Attribute key must be at most 100 characters"),
      z.union([
        stringTrimmed.max(500, "Attribute value must be at most 500 characters"),
        z.number().finite(),
        z.boolean()
      ])
    )
    .optional()
    .default({}),
  tags: z
    .array(
      stringTrimmed
        .min(1, "Tag cannot be empty")
        .max(50, "Tag must be at most 50 characters")
    )
    .max(50, "A product can have at most 50 tags")
    .optional()
    .default([]),
  stockQuantity: z
    .number({
      invalid_type_error: "Stock quantity must be a number"
    })
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity cannot be negative")
    .max(1_000_000, "Stock quantity must be at most 1000000")
    .optional()
    .default(0),
  isActive: z.boolean().optional().default(true),
  isPublished: z.boolean().optional().default(false),
  metadata: z
    .record(
      stringTrimmed.max(100, "Metadata key must be at most 100 characters"),
      z.union([
        stringTrimmed.max(500, "Metadata value must be at most 500 characters"),
        z.number().finite(),
        z.boolean(),
        z.null()
      ])
    )
    .optional()
    .default({})
});

export const createProductSchema = z.object({
  body: baseProductBodySchema
});

export const updateProductSchema = z.object({
  params: productIdParamSchema,
  body: baseProductBodySchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: "At least one field must be provided for update" }
    )
});

export const productSearchQuerySchema = z.object({
  q: stringTrimmed
    .max(200, "Search query must be at most 200 characters")
    .optional(),
  categoryId: stringTrimmed.optional(),
  brandId: stringTrimmed.optional(),
  tag: stringTrimmed.optional(),
  minPrice: stringTrimmed
    .regex(/^\d+(\.\d+)?$/, "minPrice must be a valid number")
    .transform((val) => parseFloat(val))
    .optional(),
  maxPrice: stringTrimmed
    .regex(/^\d+(\.\d+)?$/, "maxPrice must be a valid number")
    .transform((val) => parseFloat(val))
    .optional(),
  isActive: stringTrimmed
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      throw new Error("isActive must be 'true' or 'false'");
    })
    .optional(),
  isPublished: stringTrimmed
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      throw new Error("isPublished must be 'true' or 'false'");
    })
    .optional(),
  inStock: stringTrimmed
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      throw new Error("inStock must be 'true' or 'false'");
    })
    .optional(),
  sortBy: z
    .enum([
      "name",
      "price",
      "createdAt",
      "updatedAt",
      "popularity",
      "stockQuantity"
    ])
    .optional(),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("asc"),
  page: stringTrimmed
    .regex(/^\d+$/, "page must be a positive integer")
    .transform((val) => parseInt(val, 10))
    .optional()
    .default("1")
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  limit: stringTrimmed
    .regex(/^\d+$/, "limit must be a positive integer")
    .transform((val) => parseInt(val, 10))
    .optional()
    .default("20")
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
}).superRefine((data, ctx) => {
  if (
    typeof data.minPrice === "number" &&
    typeof data.maxPrice === "number" &&
    data.minPrice > data.maxPrice
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minPrice cannot be greater than maxPrice",
      path: ["minPrice"]
    });
  }
});

export type ProductIdParamInput = z.infer<typeof productIdParamSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];
export type ProductSearchQueryInput = z.infer<typeof productSearchQuerySchema>;