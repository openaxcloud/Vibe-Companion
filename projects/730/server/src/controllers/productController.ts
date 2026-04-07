import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { ProductModel } from "../models/Product";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ParsedQs } from "qs";

type SortDirection = 1 | -1;

interface ProductQueryFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
}

interface ListProductsQuery extends ParsedQs {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  isActive?: string;
}

const parseBoolean = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return undefined;
};

const buildProductFilter = (query: ProductQueryFilters) => {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const regex = new RegExp(query.search, "i");
    filter.$or = [{ name: regex }, { description: regex }];
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (typeof query.isActive === "boolean") {
    filter.isActive = query.isActive;
  } else {
    filter.isActive = true;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) {
      (filter.price as Record<string, number>).$gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      (filter.price as Record<string, number>).$lte = query.maxPrice;
    }
  }

  return filter;
};

const parsePagination = (query: ListProductsQuery) => {
  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const limit = Math.max(parseInt(query.limit || "20", 10), 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseSorting = (query: ListProductsQuery) => {
  const sortBy = query.sortBy || "createdAt";
  const sortOrderStr = query.sortOrder || "desc";
  const sortOrder: SortDirection = sortOrderStr === "asc" ? 1 : -1;
  return { [sortBy]: sortOrder };
};

export const listProducts = asyncHandler(
  async (req: Request<unknown, unknown, unknown, ListProductsQuery>, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSorting(req.query);

    const filters: ProductQueryFilters = {
      search: req.query.search,
      category: req.query.category,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      isActive: parseBoolean(req.query.isActive),
    };

    const filterQuery = buildProductFilter(filters);

    const [items, total] = await Promise.all([
      ProductModel.find(filterQuery).sort(sort).skip(skip).limit(limit).lean().exec(),
      ProductModel.countDocuments(filterQuery).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        })
      );
  }
);

export const getProductById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID");
    }

    const product = await ProductModel.findById(id).lean().exec();

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    if (!product.isActive && !(req as any).user?.isAdmin) {
      throw new ApiError(403, "Product is inactive");
    }

    return res.status(200).json(new ApiResponse(200, product));
  }
);

interface CreateProductBody {
  name: string;
  description?: string;
  price: number;
  category?: string;
  stock?: number;
  isActive?: boolean;
  images?: string[];
  [key: string]: unknown;
}

export const createProduct = asyncHandler(
  async (req: Request<unknown, unknown, CreateProductBody>, res: Response) => {
    const { name, description, price, category, stock, isActive, images, ...rest } = req.body;

    if (!name || typeof name !== "string") {
      throw new ApiError(400, "Product name is required");
    }

    if (price === undefined || typeof price !== "number" || price < 0) {
      throw new ApiError(400, "Valid product price is required");
    }

    const product = await ProductModel.create({
      name: name.trim(),
      description: description?.trim() || "",
      price,
      category: category?.trim(),
      stock: typeof stock === "number" && stock >= 0 ? stock : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
      images: Array.isArray(images) ? images : [],
      ...rest,
    });

    return res.status(201).json(new ApiResponse(201, product));
  }
);

interface UpdateProductBody {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  stock?: number;
  isActive?: boolean;
  images?: string[];
  [key: string]: unknown;
}

export const updateProduct = asyncHandler(
  async (req: Request<{ id: string }, unknown, UpdateProductBody>, res: Response) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID");
    }

    const updatableFields: UpdateProductBody = {};
    const { name, description, price, category, stock, isActive, images, ...rest } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== "string") {
        throw new ApiError(400, "Product name must be a non-empty string");
      }
      updatableFields.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        throw new ApiError(400, "Description must be a string");
      }
      updatableFields.description = description.trim();
    }

    if (price !== undefined) {
      if (typeof price !== "number" || price < 0) {
        throw new ApiError(400, "Price must be a positive number");
      }
      updatableFields.price = price;
    }

    if (category !== undefined) {
      if (typeof category !== "string") {
        throw new ApiError(400, "Category must be a string");
      }
      updatableFields.category = category.trim();
    }

    if (stock !== undefined) {
      if (typeof stock !== "number" || stock < 0) {
        throw new ApiError(400, "Stock must be a non-negative number");
      }
      updatableFields.stock = stock;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        throw new ApiError(400, "isActive must be a boolean");
      }
      updatableFields.isActive = isActive;
    }

    if (images !== undefined) {
      if (!Array.isArray(images)) {
        throw new ApiError(400, "Images must be an array of strings");
      }
      updatableFields.images = images;
    }

    Object.assign(updatableFields, rest);

    const product = await ProductModel.findByIdAndUpdate(id, updatableFields, {
      new: true,
      runValidators: true,
    })
      .lean()
      .exec();

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return res.status(200).json(new ApiResponse(200, product));
  }
);

export const toggleProductActive = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID");
    }

    const product = await ProductModel.findById(id).exec();

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json(
      new ApiResponse(200, {
        id: product._id,