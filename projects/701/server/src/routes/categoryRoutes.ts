import { Router, Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const router = Router();

// In a real application this would be replaced by a service layer or ORM model.
// For this module we define a minimal abstraction that can be wired to a real DB elsewhere.
export interface CategoryService {
  getAllCategories(): Promise<Category[]>;
  createCategory(payload: CategoryPayload): Promise<Category>;
  updateCategory(id: string, payload: CategoryPayload): Promise<Category | null>;
}

let categoryService: CategoryService | null = null;

export const registerCategoryService = (service: CategoryService): void => {
  categoryService = service;
};

const asyncWrapper =
  (handler: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

// Optional admin auth middleware hook.
// Consumers of this router can provide a real implementation.
export type AdminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

let adminAuthMiddleware: AdminAuthMiddleware | null = null;

export const registerAdminAuthMiddleware = (middleware: AdminAuthMiddleware): void => {
  adminAuthMiddleware = middleware;
};

const ensureCategoryService = (): CategoryService => {
  if (!categoryService) {
    throw new Error("CategoryService has not been registered. Call registerCategoryService() before using categoryRoutes.");
  }
  return categoryService;
};

// GET /categories
// Public endpoint for populating filter dropdowns or menus.
router.get(
  "/",
  asyncWrapper(async (_req: Request, res: Response) => {
    const service = ensureCategoryService();
    const categories = await service.getAllCategories();
    res.status(StatusCodes.OK).json(categories);
  })
);

// POST /categories (admin-only, optional)
// Creates a new category.
router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    if (adminAuthMiddleware) {
      return adminAuthMiddleware(req, res, next);
    }
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Admin operations are not enabled.",
    });
  },
  asyncWrapper(async (req: Request, res: Response) => {
    const service = ensureCategoryService();
    const payload: CategoryPayload = {
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      parentId: req.body?.parentId ?? null,
    };

    if (!payload.name || typeof payload.name !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'name' is required and must be a string." });
      return;
    }

    if (payload.slug && typeof payload.slug !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'slug' must be a string when provided." });
      return;
    }

    if (payload.description && typeof payload.description !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'description' must be a string when provided." });
      return;
    }

    if (payload.parentId !== null && payload.parentId !== undefined && typeof payload.parentId !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'parentId' must be a string when provided." });
      return;
    }

    const created = await service.createCategory(payload);
    res.status(StatusCodes.CREATED).json(created);
  })
);

// PUT /categories/:id (admin-only, optional)
// Updates an existing category.
router.put(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    if (adminAuthMiddleware) {
      return adminAuthMiddleware(req, res, next);
    }
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Admin operations are not enabled.",
    });
  },
  asyncWrapper(async (req: Request, res: Response) => {
    const service = ensureCategoryService();
    const { id } = req.params;

    if (!id) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Category 'id' parameter is required." });
      return;
    }

    const payload: CategoryPayload = {
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      parentId: req.body?.parentId ?? null,
    };

    if (payload.name !== undefined && typeof payload.name !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'name' must be a string when provided." });
      return;
    }

    if (payload.slug !== undefined && typeof payload.slug !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'slug' must be a string when provided." });
      return;
    }

    if (payload.description !== undefined && typeof payload.description !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'description' must be a string when provided." });
      return;
    }

    if (payload.parentId !== null && payload.parentId !== undefined && typeof payload.parentId !== "string") {
      res.status(StatusCodes.BAD_REQUEST).json({ message: "Field 'parentId' must be a string when provided." });
      return;
    }

    const updated = await service.updateCategory(id, payload);

    if (!updated) {
      res.status(StatusCodes.NOT_FOUND).json({ message: "Category not found." });
      return;
    }

    res.status(StatusCodes.OK).json(updated);
  })
);

export default router;