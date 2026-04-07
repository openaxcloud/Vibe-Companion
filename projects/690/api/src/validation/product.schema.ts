import { z } from 'zod';

const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid ID format' });

export const productImageSchema = z.object({
  url: z
    .string()
    .url({ message: 'Image URL must be a valid URL' })
    .max(2000, { message: 'Image URL must be at most 2000 characters' }),
  alt: z
    .string()
    .trim()
    .max(255, { message: 'Image alt text must be at most 255 characters' })
    .optional()
    .nullable(),
  isPrimary: z.boolean().optional(),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Name is required' })
    .max(255, { message: 'Name must be at most 255 characters' }),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Description is required' })
    .max(5000, { message: 'Description must be at most 5000 characters' }),
  priceCents: z
    .number({
      required_error: 'Price is required',
      invalid_type_error: 'Price must be a number',
    })
    .int({ message: 'Price must be an integer (in cents)' })
    .min(0, { message: 'Price cannot be negative' })
    .max(100000000, { message: 'Price is too large' }),
  stock: z
    .number({
      required_error: 'Stock is required',
      invalid_type_error: 'Stock must be a number',
    })
    .int({ message: 'Stock must be an integer' })
    .min(0, { message: 'Stock cannot be negative' })
    .max(1000000, { message: 'Stock is too large' }),
  categoryId: uuidSchema,
  images: z
    .array(productImageSchema)
    .max(20, { message: 'A product can have at most 20 images' })
    .optional()
    .default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Name must not be empty' })
      .max(255, { message: 'Name must be at most 255 characters' })
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, { message: 'Description must not be empty' })
      .max(5000, { message: 'Description must be at most 5000 characters' })
      .optional(),
    priceCents: z
      .number({
        invalid_type_error: 'Price must be a number',
      })
      .int({ message: 'Price must be an integer (in cents)' })
      .min(0, { message: 'Price cannot be negative' })
      .max(100000000, { message: 'Price is too large' })
      .optional(),
    stock: z
      .number({
        invalid_type_error: 'Stock must be a number',
      })
      .int({ message: 'Stock must be an integer' })
      .min(0, { message: 'Stock cannot be negative' })
      .max(1000000, { message: 'Stock is too large' })
      .optional(),
    categoryId: uuidSchema.optional(),
    images: z
      .array(productImageSchema)
      .max(20, { message: 'A product can have at most 20 images' })
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.priceCents !== undefined ||
      data.stock !== undefined ||
      data.categoryId !== undefined ||
      data.images !== undefined,
    {
      message: 'At least one field must be provided to update',
      path: ['_root'],
    }
  );

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productIdParamSchema = z.object({
  productId: uuidSchema,
});

export type ProductIdParamInput = z.infer<typeof productIdParamSchema>;