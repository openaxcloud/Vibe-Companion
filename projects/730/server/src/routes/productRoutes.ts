import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  sortBy?: 'price' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductService {
  listProducts(params: ProductQueryParams): Promise<PaginatedResult<Product>>;
  getProductByIdOrSlug(idOrSlug: string): Promise<Product | null>;
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

const parseNumber = (value: unknown, defaultValue: number | undefined = undefined): number | undefined => {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : defaultValue;
};

const parseStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  const str = String(value).trim();
  if (!str) return undefined;
  return str
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
};

const parseSortBy = (value: unknown): ProductQueryParams['sortBy'] | undefined => {
  if (!value) return undefined;
  const v = String(value);
  if (v === 'price' || v === 'name' || v === 'createdAt') return v;
  return undefined;
};

const parseSortOrder = (value: unknown): ProductQueryParams['sortOrder'] | undefined => {
  if (!value) return undefined;
  const v = String(value).toLowerCase();
  if (v === 'asc' || v === 'desc') return v;
  return undefined;
};

const buildPaginationMeta = <T>(result: PaginatedResult<T>) => ({
  page: result.page,
  limit: result.limit,
  total: result.total,
  totalPages: result.totalPages,
});

export interface CreateProductRouterOptions {
  productService: ProductService;
  basePath?: string;
}

export const createProductRouter = (options: CreateProductRouterOptions): Router => {
  const { productService } = options;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const page = parseNumber(req.query.page, 1) || 1;
      const limit = parseNumber(req.query.limit, 20) || 20;

      const search = req.query.search ? String(req.query.search).trim() : undefined;
      const category = req.query.category ? String(req.query.category).trim() : undefined;
      const minPrice = parseNumber(req.query.minPrice);
      const maxPrice = parseNumber(req.query.maxPrice);
      const tags = parseStringArray(req.query.tags);
      const sortBy = parseSortBy(req.query.sortBy);
      const sortOrder = parseSortOrder(req.query.sortOrder) ?? 'asc';

      const queryParams: ProductQueryParams = {
        page,
        limit,
        search,
        category,
        minPrice,
        maxPrice,
        tags,
        sortBy,
        sortOrder,
      };

      const result = await productService.listProducts(queryParams);

      res.status(StatusCodes.OK).json({
        data: result.items,
        meta: buildPaginationMeta(result),
      });
    })
  );

  router.get(
    '/:idOrSlug',
    asyncHandler(async (req: Request, res: Response) => {
      const { idOrSlug } = req.params;

      const product = await productService.getProductByIdOrSlug(idOrSlug);

      if (!product || !product.isActive) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
          },
        });
        return;
      }

      res.status(StatusCodes.OK).json({
        data: product,
      });
    })
  );

  return router;
};

export default createProductRouter;