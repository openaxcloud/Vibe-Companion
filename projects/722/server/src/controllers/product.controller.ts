import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { ProductService } from "../services/product.service";
import { ApiError } from "../utils/ApiError";
import { ParsedQs } from "qs";

export interface ProductQueryFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ProductControllerDependencies {
  productService: ProductService;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseNumber = (value: string | string[] | ParsedQs | ParsedQs[] | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const str = Array.isArray(value) ? String(value[0]) : String(value);
  if (str.trim() === "") return undefined;
  const num = Number(str);
  return Number.isNaN(num) ? undefined : num;
};

const parseBoolean = (value: string | string[] | ParsedQs | ParsedQs[] | undefined): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  const str = (Array.isArray(value) ? String(value[0]) : String(value)).toLowerCase().trim();
  if (["true", "1", "yes"].includes(str)) return true;
  if (["false", "0", "no"].includes(str)) return false;
  return undefined;
};

const parsePagination = (query: Request["query"]): PaginationQuery => {
  let page = parseNumber(query.page);
  let limit = parseNumber(query.limit);

  if (!page || page < 1) page = DEFAULT_PAGE;
  if (!limit || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
};

const parseProductFilters = (query: Request["query"]): ProductQueryFilters => {
  const searchRaw = query.search;
  const categoryRaw = query.category;
  const minPriceRaw = query.minPrice;
  const maxPriceRaw = query.maxPrice;
  const inStockRaw = query.inStock;
  const sortByRaw = query.sortBy;
  const sortOrderRaw = query.sortOrder;

  const search = typeof searchRaw === "string" ? searchRaw.trim() : undefined;
  const category = typeof categoryRaw === "string" ? categoryRaw.trim() : undefined;
  const minPrice = parseNumber(minPriceRaw);
  const maxPrice = parseNumber(maxPriceRaw);
  const inStock = parseBoolean(inStockRaw);
  const sortBy = typeof sortByRaw === "string" ? sortByRaw.trim() : undefined;
  let sortOrder: "asc" | "desc" | undefined;

  if (typeof sortOrderRaw === "string") {
    const order = sortOrderRaw.toLowerCase();
    if (order === "asc" || order === "desc") {
      sortOrder = order;
    }
  }

  return {
    search: search || undefined,
    category: category || undefined,
    minPrice,
    maxPrice,
    inStock,
    sortBy,
    sortOrder,
  };
};

export class ProductController {
  private readonly productService: ProductService;

  constructor({ productService }: ProductControllerDependencies) {
    this.productService = productService;
    this.listProducts = this.listProducts.bind(this);
    this.getProductById = this.getProductById.bind(this);
    this.createProduct = this.createProduct.bind(this);
    this.updateProduct = this.updateProduct.bind(this);
    this.deleteProduct = this.deleteProduct.bind(this);
  }

  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query);
      const filters = parseProductFilters(req.query);

      const result: PaginatedResult<unknown> = await this.productService.getProducts({
        filters,
        pagination,
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
      }

      const product = await this.productService.getProductById(productId);
      if (!product) {
        throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const created = await this.productService.createProduct(payload);
      res.status(httpStatus.CREATED).json({
        success: true,
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
      }

      const payload = req.body;
      const updated = await this.productService.updateProduct(productId, payload);
      if (!updated) {
        throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Product ID is required");
      }

      const deleted = await this.productService.deleteProduct(productId);
      if (!deleted) {
        throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
      }

      res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }
}

export const createProductController = (deps: ProductControllerDependencies): ProductController => {
  return new ProductController(deps);
};