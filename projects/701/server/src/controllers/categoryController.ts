import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { CategoryModel, ICategoryDocument } from "../models/Category";
import { AuthenticatedRequest } from "../types/express";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../middleware/asyncHandler";
import { isAdminUser } from "../utils/authUtils";

type CategoryResponseItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  path: string[];
  isActive: boolean;
  sortOrder: number;
  children?: CategoryResponseItem[];
};

type ListCategoriesQuery = {
  flat?: string;
  includeInactive?: string;
};

const buildHierarchy = (categories: ICategoryDocument[]): CategoryResponseItem[] => {
  const byId: Record<string, CategoryResponseItem> = {};
  const roots: CategoryResponseItem[] = [];

  categories.forEach((cat) => {
    const id = cat._id.toString();
    byId[id] = {
      id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ? cat.parentId.toString() : null,
      path: cat.path.map((p) => p.toString()),
      isActive: cat.isActive,
      sortOrder: cat.sortOrder ?? 0,
      children: [],
    };
  });

  Object.values(byId).forEach((cat) => {
    if (cat.parentId && byId[cat.parentId]) {
      byId[cat.parentId].children!.push(cat);
    } else {
      roots.push(cat);
    }
  });

  const sortRecursive = (nodes: CategoryResponseItem[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => {
      if (n.children && n.children.length > 0) {
        sortRecursive(n.children);
      }
    });
  };

  sortRecursive(roots);
  return roots;
};

const toFlatResponse = (categories: ICategoryDocument[]): CategoryResponseItem[] => {
  return categories
    .map((cat) => ({
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ? cat.parentId.toString() : null,
      path: cat.path.map((p) => p.toString()),
      isActive: cat.isActive,
      sortOrder: cat.sortOrder ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
};

export const listCategories = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, ListCategoriesQuery>,
    res: Response
  ): Promise<void> => {
    const { flat, includeInactive } = req.query;
    const showInactive = includeInactive === "true";

    const query: Record<string, unknown> = {};
    if (!showInactive) {
      query.isActive = true;
    }

    const categories = await CategoryModel.find(query).lean(false).exec();

    const responseData =
      flat === "true" ? toFlatResponse(categories) : buildHierarchy(categories);

    res.status(httpStatus.OK).json({
      success: true,
      data: responseData,
    });
  }
);

interface UpsertCategoryBody {
  id?: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export const upsertCategory = asyncHandler(
  async (
    req: AuthenticatedRequest<unknown, unknown, UpsertCategoryBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user || !isAdminUser(req.user)) {
      return next(new ApiError(httpStatus.FORBIDDEN, "Admin privileges required"));
    }

    const { id, name, slug, parentId, isActive = true, sortOrder = 0 } = req.body;

    if (!name || !slug) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Name and slug are required");
    }

    let parent: ICategoryDocument | null = null;
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parentId");
      }
      parent = await CategoryModel.findById(parentId).exec();
      if (!parent) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Parent category not found");
      }
    }

    let category: ICategoryDocument | null = null;
    if (id) {
      if (!Types.ObjectId.isValid(id)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid id");
      }
      category = await CategoryModel.findById(id).exec();
      if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
      }
    }

    const parentPath = parent ? [...parent.path, parent._id] : [];

    if (!category) {
      category = new CategoryModel({
        name,
        slug,
        parentId: parent ? parent._id : null,
        path: parentPath,
        isActive,
        sortOrder,
      });
    } else {
      category.name = name;
      category.slug = slug;
      category.parentId = parent ? parent._id : null;
      category.path = parentPath;
      category.isActive = isActive;
      category.sortOrder = sortOrder;
    }

    await category.save();

    res.status(category.isNew ? httpStatus.CREATED : httpStatus.OK).json({
      success: true,
      data: {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        parentId: category.parentId ? category.parentId.toString() : null,
        path: category.path.map((p) => p.toString()),
        isActive: category.isActive,
        sortOrder: category.sortOrder ?? 0,
      },
    });
  }
);