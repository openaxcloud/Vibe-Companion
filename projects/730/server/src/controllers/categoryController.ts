import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Category from "../models/Category";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { validateCategoryInput, validateCategoryUpdateInput } from "../validators/categoryValidator";

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const isValidObjectId = (id: string): boolean => Types.ObjectId.isValid(id);

const buildCategoryTree = (
  categories: Array<{
    _id: Types.ObjectId;
    name: string;
    slug: string;
    parent?: Types.ObjectId | null;
    isActive: boolean;
    order: number;
  }>
) => {
  const map = new Map<string, any>();
  const roots: any[] = [];

  categories.forEach((cat) => {
    map.set(String(cat._id), {
      id: String(cat._id),
      name: cat.name,
      slug: cat.slug,
      parent: cat.parent ? String(cat.parent) : null,
      isActive: cat.isActive,
      order: cat.order,
      children: [],
    });
  });

  map.forEach((node) => {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes: any[]) => {
    nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortTree(n.children));
  };

  sortTree(roots);
  return roots;
};

export const createCategory = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
      return next(new AppError("Not authorized to create categories", 403));
    }

    const { error, value } = validateCategoryInput(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const { name, slug, parentId, isActive, order } = value;

    const existing = await Category.findOne({ slug });
    if (existing) {
      return next(new AppError("Category slug already exists", 409));
    }

    let parent = null;
    if (parentId) {
      if (!isValidObjectId(parentId)) {
        return next(new AppError("Invalid parent category id", 400));
      }
      parent = await Category.findById(parentId);
      if (!parent) {
        return next(new AppError("Parent category not found", 404));
      }
    }

    const category = await Category.create({
      name,
      slug,
      parent: parent ? parent._id : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
      order: typeof order === "number" ? order : 0,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json({
      status: "success",
      data: {
        category,
      },
    });
  }
);

export const updateCategory = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
      return next(new AppError("Not authorized to update categories", 403));
    }

    const categoryId = req.params.id;
    if (!isValidObjectId(categoryId)) {
      return next(new AppError("Invalid category id", 400));
    }

    const { error, value } = validateCategoryUpdateInput(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const { name, slug, parentId, isActive, order } = value;

    const category = await Category.findById(categoryId);
    if (!category) {
      return next(new AppError("Category not found", 404));
    }

    if (slug && slug !== category.slug) {
      const existing = await Category.findOne({ slug, _id: { $ne: categoryId } });
      if (existing) {
        return next(new AppError("Category slug already exists", 409));
      }
      category.slug = slug;
    }

    if (typeof name === "string") {
      category.name = name;
    }

    if (typeof isActive === "boolean") {
      category.isActive = isActive;
    }

    if (typeof order === "number") {
      category.order = order;
    }

    if (typeof parentId !== "undefined") {
      if (parentId === null || parentId === "") {
        category.parent = null;
      } else {
        if (!isValidObjectId(parentId)) {
          return next(new AppError("Invalid parent category id", 400));
        }
        if (String(category._id) === parentId) {
          return next(new AppError("Category cannot be its own parent", 400));
        }
        const parent = await Category.findById(parentId);
        if (!parent) {
          return next(new AppError("Parent category not found", 404));
        }
        const isDescendant = async (targetId: string, possibleChildId: string): Promise<boolean> => {
          const children = await Category.find({ parent: targetId }, "_id");
          for (const child of children) {
            if (String(child._id) === possibleChildId) return true;
            if (await isDescendant(String(child._id), possibleChildId)) return true;
          }
          return false;
        };
        if (await isDescendant(String(category._id), parentId)) {
          return next(new AppError("Cannot move category under its own descendant", 400));
        }
        category.parent = parent._id;
      }
    }

    category.updatedBy = req.user.id;
    await category.save();

    res.status(200).json({
      status: "success",
      data: {
        category,
      },
    });
  }
);

export const deleteCategory = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
      return next(new AppError("Not authorized to delete categories", 403));
    }

    const categoryId = req.params.id;
    if (!isValidObjectId(categoryId)) {
      return next(new AppError("Invalid category id", 400));
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return next(new AppError("Category not found", 404));
    }

    const children = await Category.find({ parent: categoryId }, "_id");
    if (children.length > 0) {
      return next(
        new AppError(
          "Cannot delete category with child categories. Reassign or remove children first.",
          400
        )
      );
    }

    await Category.findByIdAndDelete(categoryId);

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);

export const getPublicCategoriesFlat = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const categories = await Category.find({ isActive: true })
      .select("name slug parent isActive order")
      .sort({ order: 1, name: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: {
        categories: categories.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: c.slug,
          parent: c.parent ? String(c.parent) : null,
          isActive: c.isActive,
          order: c.order,
        })),
      },
    });
  }
);

export const getPublicCategoriesTree = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const categories = await Category.find({ isActive: true })
      .select("name slug parent isActive order")
      .lean();

    const tree = buildCategoryTree(categories as any);

    res.status(200).json({
      status: "success",
      results: tree.length,
      data: {
        categories: tree,
      },
    });
  }
);

export const getAdminCategories = catchAsync(
  async (_req: AuthRequest, res: Response, _next: NextFunction) => {
    const categories = await Category.find()
      .select("name slug parent isActive order createdAt updatedAt")
      .sort({ order: 1, name: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: {
        categories: categories.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: c.slug,
          parent: c.parent ? String(c.parent) : null,
          isActive: c.isActive,
          order: c.order,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      },
    });
  }
);

export const getAdminCategoryTree = catchAsync(
  async (_req: Auth