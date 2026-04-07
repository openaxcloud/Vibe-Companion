import { z } from "zod";

export const productIdSchema = z.string().min(1, "Product ID is required");

export const productStatusEnum = z.enum(["draft", "active", "archived"], {
  required_error: "Status is required",
  invalid_type_error: "Status must be one of: draft, active, archived",
});

export type ProductStatus = z.infer<typeof productStatusEnum>;

export const productBaseSchema = z.object({
  id: productIdSchema,
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(191, "Slug must be at most 191 characters"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  price: z
    .number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a number",
    })
    .nonnegative("Price must be greater than or equal to 0"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .transform((val) => val.toUpperCase()),
  status: productStatusEnum,
  sku: z
    .string()
    .max(191, "SKU must be at most 191 characters")
    .optional()
    .nullable(),
  stock: z
    .number({
      invalid_type_error: "Stock must be a number",
    })
    .int("Stock must be an integer")
    .min(0, "Stock must be greater than or equal to 0")
    .default(0),
  isFeatured: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
});

export type ProductBase = z.infer<typeof productBaseSchema>;

// Public facing list item schema
export const productListItemSchema = productBaseSchema.pick({
  id: true,
  slug: true,
  name: true,
  price: true,
  currency: true,
  status: true,
  isFeatured: true,
});

// Public facing detail schema
export const productDetailSchema = productBaseSchema.extend({
  images: z
    .array(
      z.object({
        id: z.string(),
        url: z.string().url("Image URL must be a valid URL"),
        alt: z
          .string()
          .max(255, "Alt text must be at most 255 characters")
          .optional()
          .nullable(),
        sortOrder: z.number().int().nonnegative().default(0),
      })
    )
    .default([]),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
      })
    )
    .default([]),
});

export type ProductListItem = z.infer<typeof productListItemSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;

// Admin create payload schema
export const productCreateSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(191, "Slug must be at most 191 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can contain only lowercase letters, numbers, and hyphens"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .nullable(),
  price: z
    .number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a number",
    })
    .nonnegative("Price must be greater than or equal to 0"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .transform((val) => val.toUpperCase())
    .default("USD"),
  status: productStatusEnum.default("draft"),
  sku: z
    .string()
    .max(191, "SKU must be at most 191 characters")
    .optional()
    .nullable(),
  stock: z
    .number({
      invalid_type_error: "Stock must be a number",
    })
    .int("Stock must be an integer")
    .min(0, "Stock must be greater than or equal to 0")
    .default(0),
  isFeatured: z.boolean().default(false),
  categoryIds: z.array(z.string()).optional().default([]),
  imageIds: z.array(z.string()).optional().default([]),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

// Admin update payload schema
export const productUpdateSchema = z.object({
  id: productIdSchema,
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(191, "Slug must be at most 191 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can contain only lowercase letters, numbers, and hyphens")
    .optional(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .nullable()
    .optional(),
  price: z
    .number({
      invalid_type_error: "Price must be a number",
    })
    .nonnegative("Price must be greater than or equal to 0")
    .optional(),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .transform((val) => val.toUpperCase())
    .optional(),
  status: productStatusEnum.optional(),
  sku: z
    .string()
    .max(191, "SKU must be at most 191 characters")
    .nullable()
    .optional(),
  stock: z
    .number({
      invalid_type_error: "Stock must be a number",
    })
    .int("Stock must be an integer")
    .min(0, "Stock must be greater than or equal to 0")
    .optional(),
  isFeatured: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
  imageIds: z.array(z.string()).optional(),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// Admin delete schema
export const productDeleteSchema = z.object({
  id: productIdSchema,
  hardDelete: z.boolean().default(false),
});

export type ProductDeleteInput = z.infer<typeof productDeleteSchema>;

// Filter & query parsing schemas

export const priceRangeSchema = z
  .object({
    min: z
      .preprocess(
        (val) => (typeof val === "string" && val.length ? Number(val) : val),
        z
          .number({
            invalid_type_error: "min price must be a number",
          })
          .nonnegative("min price must be >= 0")
      )
      .optional(),
    max: z
      .preprocess(
        (val) => (typeof val === "string" && val.length ? Number(val) : val),
        z
          .number({
            invalid_type_error: "max price must be a number",
          })
          .nonnegative("max price must be >= 0")
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.min === undefined ||
      data.max === undefined ||
      (typeof data.min === "number" &&
        typeof data.max === "number" &&
        data.min <= data.max),
    {
      message: "min price cannot be greater than max price",
      path: ["min"],
    }
  );

export type PriceRangeFilter = z.infer<typeof priceRangeSchema>;

const booleanStringToBoolean = (val: unknown): boolean | undefined => {
  if (typeof val === "boolean") return val;
  if (typeof val !== "string") return undefined;
  const normalized = val.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return undefined;
};

const stringToNumber = (val: unknown): number | undefined => {
  if (typeof val === "number") return Number.isNaN(val) ? undefined : val;
  if (typeof val !== "string" || !val.trim().length) return undefined;
  const parsed = Number(val);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toArrayOfStrings = (val: unknown): string[] | undefined => {
  if (Array.isArray(val)) {
    return val
      .map((item) => String(item))