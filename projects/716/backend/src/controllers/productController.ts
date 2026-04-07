import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { ParsedQs } from 'qs';
import productService from '../services/productService';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta } from '../utils/pagination';
import { Product, ProductFilters, ProductSortBy, ProductStatus } from '../types/productTypes';

interface TypedRequestQuery<T extends ParsedQs = ParsedQs> extends Request {
  query: T;
}

interface ListProductsQuery extends ParsedQs {
  search?: string;
  category?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  status?: ProductStatus | ProductStatus[];
  tags?: string | string[];
  sortBy?: ProductSortBy;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
  includeInactive?: string;
}

interface ProductCreateBody {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  sku?: string;
  stock?: number;
  status?: ProductStatus;
  tags?: string[];
  images?: string[];
  metadata?: Record<string, unknown>;
}

interface ProductUpdateBody extends Partial<ProductCreateBody> {}

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase().trim();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const parseNumber = (value: string | undefined, defaultValue?: number): number | undefined => {
  if (value === undefined) return defaultValue;
  const num = Number(value);
  if (Number.isNaN(num)) return defaultValue;
  return num;
};

const parseStringArray = (value: string | string[] | undefined): string[] | undefined => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap(v => v.split(','))
      .map(v => v.trim())
      .filter(Boolean);
  }
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
};

const getPaginationParams = (query: ParsedQs) => {
  const page = parseNumber(query.page as string | undefined, 1) || 1;
  const limit = parseNumber(query.limit as string | undefined, 20) || 20;

  return {
    page: page < 1 ? 1 : page,
    limit: limit < 1 ? 20 : limit > 100 ? 100 : limit,
  };
};

const buildFiltersFromQuery = (query: ListProductsQuery, isAdmin: boolean): ProductFilters => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    inStock,
    status,
    tags,
    sortBy,
    sortOrder,
    includeInactive,
  } = query;

  const filters: ProductFilters = {
    search: search?.trim() || undefined,
    categories: parseStringArray(category),
    minPrice: parseNumber(minPrice),
    maxPrice: parseNumber(maxPrice),
    inStock: typeof inStock === 'string' ? parseBoolean(inStock) : undefined,
    tags: parseStringArray(tags),
    sortBy: sortBy as ProductSortBy | undefined,
    sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
  };

  const statusValues = parseStringArray(status as string | string[] | undefined) as
    | ProductStatus[]
    | undefined;

  if (isAdmin) {
    filters.statuses = statusValues;
    filters.includeInactive = parseBoolean(includeInactive, true);
  } else {
    filters.statuses = statusValues && statusValues.length > 0 ? statusValues : ['ACTIVE'];
    filters.includeInactive = false;
  }

  return filters;
};

export const getPublicProducts = async (
  req: TypedRequestQuery<ListProductsQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams(req.query);
    const filters = buildFiltersFromQuery(req.query, false);

    const { items, total } = await productService.listProducts({
      filters,
      pagination: { page, limit },
    });

    const meta = buildPaginationMeta({ page, limit, total });

    res.status(httpStatus.OK).json({
      data: items,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminProducts = async (
  req: TypedRequestQuery<ListProductsQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams(req.query);
    const filters = buildFiltersFromQuery(req.query, true);

    const { items, total } = await productService.listProducts({
      filters,
      pagination: { page, limit },
      includeDeleted: true,
    });

    const meta = buildPaginationMeta({ page, limit, total });

    res.status(httpStatus.OK).json({
      data: items,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id, { includeInactive: false });

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({ data: product });
  } catch (error) {
    next(error);
  }
};

export const getAdminProductById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id, {
      includeInactive: true,
      includeDeleted: true,
    });

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({ data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (
  req: Request<unknown, unknown, ProductCreateBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = req.body;

    const created: Product = await productService.createProduct({
      name: payload.name,
      description: payload.description,
      price: payload.price,
      categoryId: payload.categoryId,
      sku: payload.sku,
      stock: payload.stock,
      status: payload.status,
      tags: payload.tags,
      images: payload.images,
      metadata: payload.metadata,
      createdBy: (req as any).user?.id,
    });

    res.status(httpStatus.CREATED).json({ data: created });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request<{ id: string }, unknown, ProductUpdateBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const updated = await productService.updateProduct(id, {
      ...payload,
      updatedBy: (req as any).user?.id,
    });

    if (!updated) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await productService.deleteProduct(id, {
      deletedBy: (req as any).user?.id,
    });

    if (!deleted) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

export const restoreProduct = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const restored = await productService.restoreProduct(id, {
      restoredBy: (req as any).user?.id,
    });

    if (!restored) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found or not deleted');
    }

    res.status(httpStatus.OK).json({ data: restored });
  } catch (error) {
    next(error);
  }
};

export const updateProductStatus = async (
  req: Request<{ id: string }, unknown, { status: ProductStatus }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await productService.updateProductStatus(id,