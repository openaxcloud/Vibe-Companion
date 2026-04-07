import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Product from "../models/product.model";
import Category from "../models/category.model";
import InventoryAdjustment from "../models/inventoryAdjustment.model";
import Order from "../models/order.model";

interface PaginatedQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

const parsePagination = (query: PaginatedQuery) => {
  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const limit = Math.max(parseInt(query.limit || "20", 10), 1);
  const skip = (page - 1) * limit;

  const sortField = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

  return { page, limit, skip, sort };
};

const buildSearchFilter = (search?: string, fields: string[] = []) => {
  if (!search || !search.trim()) return {};
  const regex = new RegExp(search.trim(), "i");
  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      description,
      price,
      categoryId,
      sku,
      stock,
      images,
      isActive,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (price == null || isNaN(Number(price))) {
      return res.status(400).json({ message: "Valid product price is required" });
    }

    let category: Types.ObjectId | undefined;
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }
      const existingCategory = await Category.findById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      category = existingCategory._id;
    }

    const product = await Product.create({
      name,
      description: description || "",
      price: Number(price),
      category,
      sku: sku || undefined,
      stock: stock != null ? Number(stock) : 0,
      images: Array.isArray(images) ? images : [],
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const {
      name,
      description,
      price,
      categoryId,
      sku,
      stock,
      images,
      isActive,
    } = req.body;

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Product name is required" });
      }
      update.name = name;
    }

    if (description !== undefined) {
      update.description = description;
    }

    if (price !== undefined) {
      if (price == null || isNaN(Number(price))) {
        return res.status(400).json({ message: "Valid product price is required" });
      }
      update.price = Number(price);
    }

    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === "") {
        update.category = undefined;
      } else {
        if (!Types.ObjectId.isValid(categoryId)) {
          return res.status(400).json({ message: "Invalid categoryId" });
        }
        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory) {
          return res.status(404).json({ message: "Category not found" });
        }
        update.category = existingCategory._id;
      }
    }

    if (sku !== undefined) {
      update.sku = sku;
    }

    if (stock !== undefined) {
      if (isNaN(Number(stock))) {
        return res.status(400).json({ message: "Stock must be a number" });
      }
      update.stock = Number(stock);
    }

    if (images !== undefined) {
      if (!Array.isArray(images)) {
        return res.status(400).json({ message: "Images must be an array" });
      }
      update.images = images;
    }

    if (isActive !== undefined) {
      update.isActive = Boolean(isActive);
    }

    const product = await Product.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listProducts = async (
  req: Request<unknown, unknown, unknown, PaginatedQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const { search, ...rest } = req.query;

    const filters: Record<string, unknown> = {
      ...buildSearchFilter(search, ["name", "sku", "description"]),
    };

    if (rest["categoryId"]) {
      const categoryId = rest["categoryId"] as string;
      if (Types.ObjectId.isValid(categoryId)) {
        filters.category = new Types.ObjectId(categoryId);
      }
    }

    if (rest["isActive"] !== undefined) {
      filters.isActive = rest["isActive"] === "true";
    }

    const [items, total] = await Promise.all([
      Product.find(filters)
        .populate("category")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filters),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(id).populate("category");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, parentId, isActive } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Category name is required" });
    }

    let parent: Types.ObjectId | undefined;
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ message: "Invalid parentId" });
      }
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: "Parent category not found" });
      }
      parent = parentCategory._id;
    }

    const category = await Category.create({
      name,
      description: description || "",
      parent,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction