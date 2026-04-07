import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'user' | 'admin';
    [key: string]: unknown;
  };
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

type SortField = 'price' | 'name' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const querySchema = z.object({
  q: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  minPrice: z
    .string()
    .transform((val) => (val === undefined ? undefined : Number(val)))
    .refine((val) => val === undefined || (!Number.isNaN(val) && val >= 0), {
      message: 'minPrice must be a non-negative number',
    })
    .optional(),
  maxPrice: z
    .string()
    .transform((val) => (val === undefined ? undefined : Number(val)))
    .refine((val) => val === undefined || (!Number.isNaN(val) && val >= 0), {
      message: 'maxPrice must be a non-negative number',
    })
    .optional(),
  sort: z
    .string()
    .trim()
    .transform((val) => (val === undefined ? undefined : val.toLowerCase()))
    .refine(
      (val) =>
        val === undefined ||
        ['price_asc', 'price_desc', 'name_asc', 'name_desc', 'createdAt_asc', 'createdAt_desc'].includes(val),
      {
        message:
          'sort must be one of price_asc, price_desc, name_asc, name_desc, createdAt_asc, createdAt_desc',
      }
    )
    .optional(),
  page: z
    .string()
    .transform((val) => (val === undefined ? 1 : Number(val)))
    .refine((val) => Number.isInteger(val) && val >= 1, {
      message: 'page must be an integer >= 1',
    })
    .optional(),
  pageSize: z
    .string()
    .transform((val) => (val === undefined ? 20 : Number(val)))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
      message: 'pageSize must be an integer between 1 and 100',
    })
    .optional(),
});

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

const productBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  price: z.number().nonnegative(),
  categoryId: z.string().trim().optional(),
});

type ProductBody = z.infer<typeof productBodySchema>;

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(StatusCodes.FORBIDDEN).json({ error: 'Admin privileges required' });
    return;
  }
  next();
};

const asyncHandler =
  <
    P = Record<string, unknown>,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any,
  >(
    fn: (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => Promise<void>,
  ) =>
  (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Placeholder in-memory store; replace with real DB integration
const productsStore: Product[] = [];

const parseSort = (sort?: string): { field: SortField; order: SortOrder } | undefined => {
  if (!sort) return undefined;
  const [field, order] = sort.split('_') as [SortField, SortOrder];
  if (!field || !order) return undefined;
  return { field, order };
};

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = querySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { q, categoryId, minPrice, maxPrice, sort, page = 1, pageSize = 20 } = parseResult.data;

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Invalid price range',
        details: { minPrice: ['minPrice cannot be greater than maxPrice'] },
      });
      return;
    }

    let filtered = [...productsStore];

    if (q) {
      const lowerQ = q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQ) ||
          (p.description && p.description.toLowerCase().includes(lowerQ)),
      );
    }

    if (categoryId) {
      filtered = filtered.filter((p) => p.categoryId === categoryId);
    }

    if (minPrice !== undefined) {
      filtered = filtered.filter((p) => p.price >= minPrice);
    }

    if (maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.price <= maxPrice);
    }

    const sortConfig = parseSort(sort);
    if (sortConfig) {
      const { field, order } = sortConfig;
      filtered.sort((a, b) => {
        let aVal: string | number | Date = a[field];
        let bVal: string | number | Date = b[field];
        if (aVal instanceof Date && bVal instanceof Date) {
          return order === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return order === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return order === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    } else {
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    res.status(StatusCodes.OK).json({
      data: paginated,
      meta: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
      },
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = idParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Invalid product id',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { id } = parseResult.data;
    const product = productsStore.find((p) => p.id === id);

    if (!product) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'Product not found' });
      return;
    }

    res.status(StatusCodes.OK).json(product);
  }),
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = productBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Invalid product data',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const body: ProductBody = parseResult.data;
    const now = new Date();
    const newProduct: Product = {
      id: `undefined-undefined`,
      name: body.name,
      description: body.description,
      price: body.price,
      categoryId: body.categoryId,
      createdAt: now,
      updatedAt: now,
    };

    productsStore.push(newProduct);

    res.status(StatusCodes.CREATED).json(newProduct);
  }),
);

router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response