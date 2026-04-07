import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { ProductService } from '../services/product.service';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { AuthenticatedRequest } from '../types/express';
import { Product, ProductDocument } from '../models/product.model';

const parseNumber = (value: unknown, fallback: number | null = null): number | null => {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
};

const parseSort = (sort?: string | string[]): Record<string, 1 | -1> | undefined => {
  if (!sort) return undefined;
  const sortStr = Array.isArray(sort) ? sort[0] : sort;
  const fields = sortStr.split(',').map((s) => s.trim()).filter(Boolean);
  if (!fields.length) return undefined;

  const sortObj: Record<string, 1 | -1> = {};
  for (const field of fields) {
    if (field.startsWith('-')) {
      sortObj[field.substring(1)] = -1;
    } else {
      sortObj[field] = 1;
    }
  }
  return sortObj;
};

export const getProducts = catchAsync(async (req: Request, res: Response) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page,
    limit,
  } = req.query;

  const pageNumber = parseNumber(page, 1) || 1;
  const limitNumber = parseNumber(limit, 20) || 20;

  const filters: {
    search?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
  } = {};

  if (typeof search === 'string' && search.trim()) {
    filters.search = search.trim();
  }

  if (typeof category === 'string' && category.trim()) {
    filters.category = category.trim();
  }

  const minPriceNum = parseNumber(minPrice);
  const maxPriceNum = parseNumber(maxPrice);

  if (minPriceNum !== null) {
    filters.priceMin = minPriceNum;
  }
  if (maxPriceNum !== null) {
    filters.priceMax = maxPriceNum;
  }

  const sortObj = parseSort(sort as string | string[] | undefined);

  const result = await ProductService.queryProducts({
    filters,
    sort: sortObj,
    page: pageNumber,
    limit: limitNumber,
  });

  res.status(httpStatus.OK).json({
    data: result.results,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    totalResults: result.totalResults,
  });
});

export const getProductById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { productId } = req.params;

  if (!Types.ObjectId.isValid(productId)) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid product id'));
  }

  const product = await ProductService.getProductById(productId);

  if (!product) {
    return next(new ApiError(httpStatus.NOT_FOUND, 'Product not found'));
  }

  res.status(httpStatus.OK).json(product);
});

export const createProduct = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isAdmin) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Admin privileges required'));
  }

  const {
    name,
    description,
    price,
    category,
    images,
    stock,
    sku,
    isActive,
    metadata,
  } = req.body;

  if (!name || typeof name !== 'string') {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Product name is required'));
  }

  const priceNum = parseNumber(price);
  if (priceNum === null || priceNum < 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Valid product price is required'));
  }

  if (!category || typeof category !== 'string') {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Product category is required'));
  }

  const stockNum = parseNumber(stock, 0);
  if (stockNum === null || stockNum < 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Stock cannot be negative'));
  }

  const payload: Partial<Product> = {
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    price: priceNum,
    category: category.trim(),
    images: Array.isArray(images) ? images.filter((i: unknown) => typeof i === 'string') : [],
    stock: stockNum,
    sku: typeof sku === 'string' ? sku.trim() : undefined,
    isActive: typeof isActive === 'boolean' ? isActive : true,
    metadata: typeof metadata === 'object' && metadata !== null ? metadata : undefined,
  };

  const product: ProductDocument = await ProductService.createProduct(payload);

  res.status(httpStatus.CREATED).json(product);
});

export const updateProduct = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isAdmin) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Admin privileges required'));
  }

  const { productId } = req.params;

  if (!Types.ObjectId.isValid(productId)) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid product id'));
  }

  const existingProduct = await ProductService.getProductById(productId);
  if (!existingProduct) {
    return next(new ApiError(httpStatus.NOT_FOUND, 'Product not found'));
  }

  const {
    name,
    description,
    price,
    category,
    images,
    stock,
    sku,
    isActive,
    metadata,
  } = req.body;

  const updatePayload: Partial<Product> = {};

  if (name !== undefined) {
    if (!name || typeof name !== 'string') {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Product name must be a non-empty string'));
    }
    updatePayload.name = name.trim();
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Description must be a string'));
    }
    updatePayload.description = description.trim();
  }

  if (price !== undefined) {
    const priceNum = parseNumber(price);
    if (priceNum === null || priceNum < 0) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Price must be a non-negative number'));
    }
    updatePayload.price = priceNum;
  }

  if (category !== undefined) {
    if (!category || typeof category !== 'string') {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Category must be a non-empty string'));
    }
    updatePayload.category = category.trim();
  }

  if (images !== undefined) {
    if (!Array.isArray(images) || !images.every((i: unknown) => typeof i === 'string')) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Images must be an array of strings'));
    }
    updatePayload.images = images;
  }

  if (stock !== undefined) {
    const stockNum = parseNumber(stock);
    if (stockNum === null || stockNum < 0) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Stock must be a non-negative number'));
    }
    updatePayload.stock = stockNum;
  }

  if (sku !== undefined) {
    if (sku !== null && typeof sku !== 'string') {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'SKU must be a string or null'));
    }
    updatePayload.sku = sku ? sku.trim() : undefined;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'isActive must be a boolean'));
    }
    updatePayload.isActive = isActive;
  }

  if (metadata !== undefined) {
    if (typeof metadata !== 'object' || metadata === null) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Metadata must be an object'));
    }
    updatePayload.metadata = metadata;
  }

  const updatedProduct = await ProductService.updateProductById(productId, updatePayload);

  res.status(httpStatus.OK).json(updatedProduct);
});

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
};