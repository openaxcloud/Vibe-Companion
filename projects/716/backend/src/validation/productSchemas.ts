import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, { message: "Invalid ID format" });

export const productTitleSchema = z
  .string()
  .min(3, { message: "Title must be at least 3 characters long" })
  .max(200, { message: "Title must be at most 200 characters long" })
  .trim();

export const productDescriptionSchema = z
  .string()
  .min(10, { message: "Description must be at least 10 characters long" })
  .max(5000, { message: "Description must be at most 5000 characters long" })
  .trim();

export const productPriceSchema = z
  .number({
    invalid_type_error: "Price must be a number",
    required_error: "Price is required",
  })
  .finite({ message: "Price must be a finite number" })
  .nonnegative({ message: "Price must be greater than or equal to 0" });

export const productDiscountPriceSchema = z
  .number({
    invalid_type_error: "Discount price must be a number",
  })
  .finite({ message: "Discount price must be a finite number" })
  .nonnegative({ message: "Discount price must be greater than or equal to 0" })
  .optional();

export const productInventoryQuantitySchema = z
  .number({
    invalid_type_error: "Inventory quantity must be a number",
    required_error: "Inventory quantity is required",
  })
  .int({ message: "Inventory quantity must be an integer" })
  .min(0, { message: "Inventory quantity cannot be negative" });

export const productImageUrlSchema = z
  .string()
  .url({ message: "Image must be a valid URL" });

export const productImageSchema = z.object({
  url: productImageUrlSchema,
  alt: z
    .string()
    .max(255, { message: "Alt text must be at most 255 characters long" })
    .trim()
    .optional(),
});

export const productImagesSchema = z
  .array(productImageSchema)
  .max(15, { message: "A product can have at most 15 images" })
  .optional();

export const productCategoryIdSchema = objectIdSchema;

export const productStatusSchema = z.enum(["draft", "active", "archived"], {
  required_error: "Status is required",
});

export const productCreateSchema = z
  .object({
    title: productTitleSchema,
    description: productDescriptionSchema,
    price: productPriceSchema,
    discountPrice: productDiscountPriceSchema,
    images: productImagesSchema,
    inventoryQuantity: productInventoryQuantitySchema,
    categoryId: productCategoryIdSchema,
    status: productStatusSchema.default("draft"),
    sku: z
      .string()
      .max(100, { message: "SKU must be at most 100 characters long" })
      .trim()
      .optional(),
    tags: z
      .array(
        z
          .string()
          .min(1, { message: "Tag cannot be empty" })
          .max(50, { message: "Tag must be at most 50 characters long" })
          .trim()
      )
      .max(50, { message: "A product can have at most 50 tags" })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.discountPrice === "number" &&
      data.discountPrice >= data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount price must be less than original price",
        path: ["discountPrice"],
      });
    }
  });

export const productUpdateSchema = z
  .object({
    title: productTitleSchema.optional(),
    description: productDescriptionSchema.optional(),
    price: productPriceSchema.optional(),
    discountPrice: productDiscountPriceSchema,
    images: productImagesSchema,
    inventoryQuantity: productInventoryQuantitySchema.optional(),
    categoryId: productCategoryIdSchema.optional(),
    status: productStatusSchema.optional(),
    sku: z
      .string()
      .max(100, { message: "SKU must be at most 100 characters long" })
      .trim()
      .optional(),
    tags: z
      .array(
        z
          .string()
          .min(1, { message: "Tag cannot be empty" })
          .max(50, { message: "Tag must be at most 50 characters long" })
          .trim()
      )
      .max(50, { message: "A product can have at most 50 tags" })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.discountPrice === "number" &&
      typeof data.price === "number" &&
      data.discountPrice >= data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount price must be less than original price",
        path: ["discountPrice"],
      });
    }
  });

export const productSearchQuerySchema = z.object({
  q: z
    .string()
    .max(200, { message: "Search query must be at most 200 characters long" })
    .trim()
    .optional(),
  category: objectIdSchema.optional(),
  minPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/, {
      message: "minPrice must be a valid number",
    })
    .transform((val) => Number(val))
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/, {
      message: "maxPrice must be a valid number",
    })
    .transform((val) => Number(val))
    .optional(),
  inStock: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  status: z
    .enum(["draft", "active", "archived"])
    .optional(),
  sortBy: z
    .enum(["createdAt", "price", "title", "popularity"])
    .optional(),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, { message: "limit must be an integer" })
    .transform((val) => Number(val))
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/, { message: "offset must be an integer" })
    .transform((val) => Number(val))
    .optional(),
  tags: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
    .optional(),
});

export const productIdParamSchema = z.object({
  productId: objectIdSchema,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;