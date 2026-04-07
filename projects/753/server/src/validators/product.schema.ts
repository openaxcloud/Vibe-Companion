import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid UUID format" });

const nonEmptyString = (fieldName: string) =>
  z
    .string({ required_error: `undefined is required` })
    .trim()
    .min(1, { message: `undefined cannot be empty` });

const optionalNonEmptyString = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `undefined cannot be empty` })
    .optional();

const positiveNumberSchema = (fieldName: string) =>
  z
    .number({ required_error: `undefined is required` })
    .positive({ message: `undefined must be greater than 0` });

const nonNegativeNumberSchema = (fieldName: string) =>
  z
    .number({ required_error: `undefined is required` })
    .nonnegative({ message: `undefined must be greater than or equal to 0` });

const optionalBoolean = z
  .union([z.boolean(), z.string().transform((val) => val === "true")])
  .optional();

export const productBaseSchema = z.object({
  name: nonEmptyString("Name").max(255, { message: "Name must be at most 255 characters long" }),
  description: nonEmptyString("Description").max(2000, {
    message: "Description must be at most 2000 characters long",
  }),
  price: positiveNumberSchema("Price"),
  stock: nonNegativeNumberSchema("Stock").int({ message: "Stock must be an integer" }),
  sku: nonEmptyString("SKU").max(100, { message: "SKU must be at most 100 characters long" }),
  categoryId: uuidSchema,
  isActive: z.boolean().optional().default(true),
  images: z
    .array(nonEmptyString("Image URL"))
    .max(20, { message: "A product can have at most 20 images" })
    .optional()
    .default([]),
  tags: z
    .array(nonEmptyString("Tag"))
    .max(50, { message: "A product can have at most 50 tags" })
    .optional()
    .default([]),
});

export const productCreateSchema = productBaseSchema;

export const productUpdateSchema = productBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
  });

export const productIdParamSchema = z.object({
  id: uuidSchema,
});

export const productListQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "page must be a positive integer",
    })
    .optional()
    .default(1),
  limit: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0 && val <= 100, {
      message: "limit must be a positive integer between 1 and 100",
    })
    .optional()
    .default(20),
  sortBy: z
    .enum(["name", "price", "createdAt", "updatedAt", "stock"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
  search: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional(),
  categoryId: z
    .string()
    .uuid()
    .optional(),
  minPrice: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val) && val >= 0, {
      message: "minPrice must be a number greater than or equal to 0",
    })
    .optional(),
  maxPrice: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val) && val >= 0, {
      message: "maxPrice must be a number greater than or equal to 0",
    })
    .optional(),
  isActive: optionalBoolean,
  inStockOnly: optionalBoolean,
  tags: z
    .string()
    .transform((val) => val.split(",").map((tag) => tag.trim()).filter(Boolean))
    .optional(),
}).refine(
  (data) =>
    data.minPrice === undefined ||
    data.maxPrice === undefined ||
    data.minPrice <= data.maxPrice,
  {
    message: "minPrice cannot be greater than maxPrice",
    path: ["minPrice"],
  }
);

export type ProductBaseInput = z.infer<typeof productBaseSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductIdParamInput = z.infer<typeof productIdParamSchema>;
export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;