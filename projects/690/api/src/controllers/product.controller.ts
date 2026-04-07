import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { ProductService } from '../services/product.service';
import { ApiError } from '../utils/ApiError';

const productService = new ProductService();

/**
 * Get public list of products with filters, pagination, and sorting
 */
export const listProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      sort = 'createdAt:desc',
      search,
      category,
      minPrice,
      maxPrice,
      isActive,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;

    const [sortField, sortDirection] = String(sort).split(':');
    const sortBy = {
      field: sortField || 'createdAt',
      direction: sortDirection === 'asc' ? 'asc' : 'desc',
    } as const;

    const filters = {
      search: search ? String(search) : undefined,
      category: category ? String(category) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      isActive:
        typeof isActive === 'string'
          ? isActive === 'true'
          : undefined,
    };

    const result = await productService.listProducts({
      page: pageNumber,
      limit: limitNumber,
      sortBy,
      filters,
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product detail by slug or id
 */
export const getProductDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { idOrSlug } = req.params;

    if (!idOrSlug) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product identifier is required');
    }

    const product = await productService.getProductByIdOrSlug(idOrSlug);

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get list of products (includes inactive, draft, etc.)
 */
export const adminListProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      sort = 'createdAt:desc',
      search,
      category,
      minPrice,
      maxPrice,
      isActive,
      sku,
      visibility,
      status,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;

    const [sortField, sortDirection] = String(sort).split(':');
    const sortBy = {
      field: sortField || 'createdAt',
      direction: sortDirection === 'asc' ? 'asc' : 'desc',
    } as const;

    const filters = {
      search: search ? String(search) : undefined,
      category: category ? String(category) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      isActive:
        typeof isActive === 'string'
          ? isActive === 'true'
          : undefined,
      sku: sku ? String(sku) : undefined,
      visibility: visibility ? String(visibility) : undefined,
      status: status ? String(status) : undefined,
    };

    const result = await productService.adminListProducts({
      page: pageNumber,
      limit: limitNumber,
      sortBy,
      filters,
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get single product (with admin details)
 */
export const adminGetProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!productId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
    }

    const product = await productService.adminGetProductById(productId);

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create new product
 */
export const adminCreateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body;

    const product = await productService.adminCreateProduct(payload);

    res.status(httpStatus.CREATED).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update product
 */
export const adminUpdateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!productId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
    }

    const payload = req.body;

    const product = await productService.adminUpdateProduct(productId, payload);

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete product (soft or hard depending on service implementation)
 */
export const adminDeleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!productId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
    }

    await productService.adminDeleteProduct(productId);

    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Toggle product active status
 */
export const adminToggleProductActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { isActive } = req.body as { isActive?: boolean };

    if (!productId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
    }

    if (typeof isActive !== 'boolean') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'isActive boolean is required');
    }

    const product = await productService.adminToggleProductActive(
      productId,
      isActive
    );

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get all product categories (with counts)
 */
export const listProductCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const includeEmpty = String(req.query.includeEmpty || 'false') === 'true';
    const categories = await productService.listCategories({ includeEmpty });

    res.status(httpStatus.OK).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get single category with products
 */
export const getCategoryWithProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const {
      page = '1',
      limit = '20',
      sort = 'createdAt:desc',
    } = req.query;

    if (!slug) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Category slug is required');
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;

    const [sortField, sortDirection] = String