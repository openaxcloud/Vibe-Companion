import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { ProductService } from "../services/product.service";
import { ApiError } from "../utils/ApiError";
import { pick } from "../utils/pick";
import { validateObjectId } from "../utils/validateObjectId";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles: string[];
  };
}

const productService = new ProductService();

const productFilterFields = [
  "search",
  "category",
  "minPrice",
  "maxPrice",
  "isActive",
  "inStock",
  "tags",
];

const productOptionsFields = [
  "sortBy",
  "limit",
  "page",
  "select",
  "populate",
];

export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body;

    if (!payload.name || !payload.price) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product name and price are required"
      );
    }

    if (payload.category && !validateObjectId(payload.category)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category id");
    }

    const createdBy = req.user?.id ?? null;

    const product = await productService.createProduct({
      ...payload,
      createdBy,
    });

    res.status(httpStatus.CREATED).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = pick(req.query, productFilterFields);
    const options = pick(req.query, productOptionsFields);

    const parsedFilters: Record<string, unknown> = {};
    const parsedOptions: Record<string, unknown> = {};

    if (typeof filters.search === "string" && filters.search.trim() !== "") {
      parsedFilters.search = filters.search.trim();
    }

    if (typeof filters.category === "string") {
      if (!validateObjectId(filters.category)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category filter");
      }
      parsedFilters.category = new Types.ObjectId(filters.category);
    }

    if (typeof filters.minPrice === "string") {
      const min = Number(filters.minPrice);
      if (!Number.isNaN(min)) {
        parsedFilters.minPrice = min;
      }
    }

    if (typeof filters.maxPrice === "string") {
      const max = Number(filters.maxPrice);
      if (!Number.isNaN(max)) {
        parsedFilters.maxPrice = max;
      }
    }

    if (typeof filters.isActive === "string") {
      parsedFilters.isActive = filters.isActive === "true";
    }

    if (typeof filters.inStock === "string") {
      parsedFilters.inStock = filters.inStock === "true";
    }

    if (typeof filters.tags === "string" && filters.tags.trim()) {
      parsedFilters.tags = filters.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    if (typeof options.sortBy === "string") {
      parsedOptions.sortBy = options.sortBy;
    }

    if (typeof options.limit === "string") {
      const limit = Number(options.limit);
      if (!Number.isNaN(limit) && limit > 0) {
        parsedOptions.limit = limit;
      }
    }

    if (typeof options.page === "string") {
      const page = Number(options.page);
      if (!Number.isNaN(page) && page > 0) {
        parsedOptions.page = page;
      }
    }

    parsedOptions.populate = [
      { path: "category", select: "name slug" },
      { path: "images", select: "url altText" },
    ];

    const result = await productService.queryProducts(parsedFilters, parsedOptions);

    res.status(httpStatus.OK).json({
      success: true,
      data: result.results,
      meta: {
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        totalResults: result.totalResults,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validateObjectId(productId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product id");
    }

    const product = await productService.getProductById(productId, [
      { path: "category", select: "name slug" },
      { path: "images", select: "url altText" },
    ]);

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
};

export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validateObjectId(productId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product id");
    }

    const updateData = req.body;

    if (updateData.category && !validateObjectId(updateData.category)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category id");
    }

    const updatedBy = req.user?.id ?? null;

    const product = await productService.updateProductById(productId, {
      ...updateData,
      updatedBy,
    });

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
};

export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validateObjectId(productId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product id");
    }

    const deleted = await productService.deleteProductById(productId);

    if (!deleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
    }

    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

export const toggleProductActive = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validateObjectId(productId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product id");
    }

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "isActive must be a boolean value"
      );
    }

    const updatedBy = req.user?.id ?? null;

    const product = await productService.updateProductById(productId, {
      isActive,
      updatedBy,
    });

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
};

export const attachProductImages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validateObjectId(productId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product id");
    }

    const { imageIds } = req.body as { imageIds: string[] };

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "imageIds must be a non-empty array"
      );
    }

    const invalidId = imageIds.find((id) => !validateObjectId(id));
    if (invalidId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "One or more image ids are invalid");
    }

    const updatedBy = req.user?.id ?? null;

    const product = await productService.addImagesToProduct(
      productId,
      imageIds,
      updatedBy
    );

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
};

export const detachProductImage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId, imageId } = req.params;