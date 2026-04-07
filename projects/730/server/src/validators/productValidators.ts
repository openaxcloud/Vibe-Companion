import { z, ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

const MIN_PRICE = 0;
const MAX_PRICE = 1_000_000;
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SKU_LENGTH = 64;
const MAX_CATEGORY_LENGTH = 128;
const MAX_BRAND_LENGTH = 128;
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 64;
const MAX_IMAGES = 20;
const MAX_IMAGE_URL_LENGTH = 2048;

export const productBaseSchema = z.object({
  name: z
    .string({
      required_error: 'Product name is required',
      invalid_type_error: 'Product name must be a string',
    })
    .trim()
    .min(1, 'Product name is required')
    .max(MAX_NAME_LENGTH, `Product name must be at most undefined characters`),

  description: z
    .string({
      invalid_type_error: 'Description must be a string',
    })
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `Description must be at most undefined characters`)
    .optional()
    .or(z.literal('').transform(() => undefined)),

  price: z
    .number({
      required_error: 'Price is required',
      invalid_type_error: 'Price must be a number',
    })
    .finite('Price must be a finite number')
    .min(MIN_PRICE, `Price must be at least undefined`)
    .max(MAX_PRICE, `Price must be at most undefined`),

  currency: z
    .string({
      required_error: 'Currency is required',
      invalid_type_error: 'Currency must be a string',
    })
    .trim()
    .length(3, 'Currency must be a valid 3-letter ISO code')
    .transform((val) => val.toUpperCase()),

  sku: z
    .string({
      invalid_type_error: 'SKU must be a string',
    })
    .trim()
    .min(1, 'SKU cannot be empty')
    .max(MAX_SKU_LENGTH, `SKU must be at most undefined characters`)
    .optional(),

  category: z
    .string({
      invalid_type_error: 'Category must be a string',
    })
    .trim()
    .min(1, 'Category cannot be empty')
    .max(MAX_CATEGORY_LENGTH, `Category must be at most undefined characters`)
    .optional(),

  brand: z
    .string({
      invalid_type_error: 'Brand must be a string',
    })
    .trim()
    .min(1, 'Brand cannot be empty')
    .max(MAX_BRAND_LENGTH, `Brand must be at most undefined characters`)
    .optional(),

  tags: z
    .array(
      z
        .string({
          invalid_type_error: 'Tag must be a string',
        })
        .trim()
        .min(1, 'Tag cannot be empty')
        .max(MAX_TAG_LENGTH, `Tag must be at most undefined characters`),
      {
        invalid_type_error: 'Tags must be an array of strings',
      }
    )
    .max(MAX_TAGS, `A maximum of undefined tags are allowed`)
    .optional(),

  images: z
    .array(
      z
        .string({
          invalid_type_error: 'Image URL must be a string',
        })
        .trim()
        .url('Image URL must be a valid URL')
        .max(MAX_IMAGE_URL_LENGTH, `Image URL must be at most undefined characters`),
      {
        invalid_type_error: 'Images must be an array of URLs',
      }
    )
    .max(MAX_IMAGES, `A maximum of undefined images are allowed`)
    .optional(),

  inventory: z
    .object({
      quantity: z
        .number({
          required_error: 'Inventory quantity is required',
          invalid_type_error: 'Inventory quantity must be a number',
        })
        .int('Inventory quantity must be an integer')
        .min(0, 'Inventory quantity cannot be negative')
        .max(Number.MAX_SAFE_INTEGER, 'Inventory quantity is too large'),

      allowBackorder: z
        .boolean({
          invalid_type_error: 'allowBackorder must be a boolean',
        })
        .optional()
        .default(false),
    })
    .optional(),

  isActive: z
    .boolean({
      invalid_type_error: 'isActive must be a boolean',
    })
    .optional()
    .default(true),
});

export const createProductSchema = productBaseSchema.strict();

export const updateProductSchema = productBaseSchema
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided for update',
      path: [],
    }
  );

export type ProductCreateInput = z.infer<typeof createProductSchema>;
export type ProductUpdateInput = z.infer<typeof updateProductSchema>;

type ValidatedRequest<TBody> = Request & { validatedBody: TBody };

function handleZodError(error: ZodError, res: Response): void {
  const formatted = error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  res.status(400).json({
    error: 'ValidationError',
    details: formatted,
  });
}

function validateSchema<TSchema extends ZodSchema>(
  schema: TSchema
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      (req as ValidatedRequest<unknown>).validatedBody = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        handleZodError(err, res);
        return;
      }
      next(err);
    }
  };
}

export const validateCreateProduct = validateSchema(createProductSchema) as (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export const validateUpdateProduct = validateSchema(updateProductSchema) as (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type { ValidatedRequest };