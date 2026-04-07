import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import type { Query } from 'mongoose';
import { ProductModel } from '../models/Product';
import { ApiError } from '../utils/ApiError';

const router = Router();

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest' | 'popular';

interface ProductFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

interface PaginationParams {
  page: number;
  pageSize: number;
}

interface ProductListQuery extends ProductFilters, PaginationParams {
  sort?: SortOption;
}

const querySchema = z.object({
  q: z.string().min(1).max(256).optional(),
  category: z.string().min(1).max(128).optional(),
  minPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .refine((n) => n >= 0, { message: 'minPrice must be >= 0' })
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .refine((n) => n >= 0, { message: 'maxPrice must be >= 0' })
    .optional(),
  tags: z
    .union([
      z.string().transform((v) => v.split(',').map((t) => t.trim()).filter(Boolean)),
      z.array(z.string())
    ])
    .optional(),
  sort: z
    .enum(['price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'popular'])
    .optional(),
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n > 0, { message: 'page must be > 0' })
    .optional()
    .default('1')
    .transform(Number),
  pageSize: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, { message: 'pageSize must be between 1 and 100' })
    .optional()
    .default('20')
    .transform(Number)
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

const buildProductQuery = (filters: ProductFilters): Record<string, unknown> => {
  const query: Record<string, unknown> = {};

  if (filters.q) {
    const regex = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { description: regex }];
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.minPrice != null || filters.maxPrice != null) {
    query.price = {};
    if (filters.minPrice != null) {
      (query.price as Record<string, unknown>).$gte = filters.minPrice;
    }
    if (filters.maxPrice != null) {
      (query.price as Record<string, unknown>).$lte = filters.maxPrice;
    }
  }

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $all: filters.tags };
  }

  return query;
};

const applySort = (query: Query<unknown, unknown>, sort?: SortOption): Query<unknown, unknown> => {
  switch (sort) {
    case 'price_asc':
      return query.sort({ price: 1 });
    case 'price_desc':
      return query.sort({ price: -1 });
    case 'name_asc':
      return query.sort({ name: 1 });
    case 'name_desc':
      return query.sort({ name: -1 });
    case 'newest':
      return query.sort({ createdAt: -1 });
    case 'popular':
      return query.sort({ soldCount: -1 });
    default:
      return query.sort({ createdAt: -1 });
  }
};

const parseQuery = (req: Request): ProductListQuery => {
  const result = querySchema.safeParse(req.query);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(', ');
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid query parameters: undefined`);
  }
  const value = result.data;
  return {
    q: value.q,
    category: value.category,
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    tags: value.tags,
    sort: value.sort,
    page: value.page as unknown as number,
    pageSize: value.pageSize as unknown as number
  };
};

const parseIdParam = (req: Request): string => {
  const result = idParamSchema.safeParse(req.params);
  if (!result.success) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid product id parameter');
  }
  return result.data.id;
};

router.get(
  '/products',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, category, minPrice, maxPrice, tags, sort, page, pageSize } = parseQuery(req);

      if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'minPrice cannot be greater than maxPrice');
      }

      const filters: ProductFilters = {
        q,
        category,
        minPrice,
        maxPrice,
        tags
      };

      const mongoQuery = buildProductQuery(filters);
      const skip = (page - 1) * pageSize;

      const baseQuery = ProductModel.find(mongoQuery).lean();
      const sortedQuery = applySort(baseQuery, sort);

      const [items, total, stockAggregation] = await Promise.all([
        sortedQuery.skip(skip).limit(pageSize).exec(),
        ProductModel.countDocuments(mongoQuery).exec(),
        ProductModel.aggregate([
          { $match: mongoQuery },
          {
            $group: {
              _id: null,
              totalStock: { $sum: '$stock' },
              inStockCount: {
                $sum: {
                  $cond: [{ $gt: ['$stock', 0] }, 1, 0]
                }
              },
              outOfStockCount: {
                $sum: {
                  $cond: [{ $eq: ['$stock', 0] }, 1, 0]
                }
              }
            }
          }
        ]).exec()
      ]);

      const totalPages = Math.ceil(total / pageSize) || 1;
      const stockInfo = stockAggregation[0] || {
        totalStock: 0,
        inStockCount: 0,
        outOfStockCount: 0
      };

      res.status(StatusCodes.OK).json({
        data: items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        filters: {
          q: q ?? null,
          category: category ?? null,
          minPrice: minPrice ?? null,
          maxPrice: maxPrice ?? null,
          tags: tags ?? []
        },
        sort: sort ?? 'newest',
        stock: {
          totalStock: stockInfo.totalStock,
          inStockCount: stockInfo.inStockCount,
          outOfStockCount: stockInfo.outOfStockCount
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/products/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseIdParam(req);

      const product = await ProductModel.findById(id).lean();
      if (!product) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
      }

      res.status(StatusCodes.OK).json({
        data: product
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;