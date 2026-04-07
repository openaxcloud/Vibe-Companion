import { Router, Request, Response, NextFunction } from "express";
import multer, { StorageEngine } from "multer";
import path from "path";

// Example types – in a real app import these from your models/types modules
interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Extend Express Request to include user for auth middleware
declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
      email: string;
    }

    interface Request {
      user?: User;
      file?: Express.Multer.File;
    }
  }
}

const router = Router();

/**
 * Multer configuration
 * For now this is a placeholder that stores files in memory.
 * In production, wire this to a file system or cloud storage provider.
 */
const storage: StorageEngine = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Only images are allowed."));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Simple placeholder in-memory store for demonstration.
// Replace with real DB integration.
const productsStore: Map<string, Product> = new Map();

// Seed with some example products
(() => {
  const now = new Date();
  const exampleProducts: Product[] = [
    {
      id: "1",
      name: "Example Product 1",
      description: "First example product",
      price: 19.99,
      category: "general",
      imageUrl: undefined,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "2",
      name: "Example Product 2",
      description: "Second example product",
      price: 29.99,
      category: "general",
      imageUrl: undefined,
      createdAt: now,
      updatedAt: now,
    },
  ];
  exampleProducts.forEach((p) => productsStore.set(p.id, p));
})();

// Placeholder admin auth middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  return next();
};

const parseNumber = (value: unknown, defaultValue: number): number => {
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return defaultValue;
};

// GET /products - list with search/filter/pagination
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        search,
        category,
        minPrice,
        maxPrice,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const offset = (page - 1) * limit;

      const minPriceNum =
        typeof minPrice === "string" ? parseFloat(minPrice) : undefined;
      const maxPriceNum =
        typeof maxPrice === "string" ? parseFloat(maxPrice) : undefined;

      let products = Array.from(productsStore.values());

      if (typeof search === "string" && search.trim() !== "") {
        const term = search.trim().toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
        );
      }

      if (typeof category === "string" && category.trim() !== "") {
        const cat = category.trim().toLowerCase();
        products = products.filter(
          (p) => p.category && p.category.toLowerCase() === cat
        );
      }

      if (!Number.isNaN(minPriceNum as number) && minPriceNum !== undefined) {
        products = products.filter((p) => p.price >= (minPriceNum as number));
      }

      if (!Number.isNaN(maxPriceNum as number) && maxPriceNum !== undefined) {
        products = products.filter((p) => p.price <= (maxPriceNum as number));
      }

      products.sort((a, b) => {
        const order = sortOrder === "asc" ? 1 : -1;
        switch (sortBy) {
          case "price":
            return (a.price - b.price) * order;
          case "name":
            return a.name.localeCompare(b.name) * order;
          case "createdAt":
          default:
            return (
              (a.createdAt.getTime() - b.createdAt.getTime()) * order
            );
        }
      });

      const total = products.length;
      const paginated = products.slice(offset, offset + limit);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const result: PaginatedResult<Product> = {
        data: paginated,
        total,
        page,
        limit,
        totalPages,
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /products/:id - get single product
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const product = productsStore.get(id);
      if (!product) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

// POST /products - create product (admin), with optional image upload
router.post(
  "/",
  requireAdmin,
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, description, price, category } = req.body;

      if (!name || typeof name !== "string") {
        res.status(400).json({ message: "Name is required" });
        return;
      }

      const priceNum = parseFloat(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        res.status(400).json({ message: "Invalid price" });
        return;
      }

      // Placeholder for image handling.
      // In a real app, upload req.file.buffer to storage and set imageUrl.
      let imageUrl: string | undefined;
      if (req.file) {
        imageUrl = `/uploads/undefined_undefined`;
        // TODO: persist the file to disk or cloud storage
      }

      const id = (productsStore.size + 1).toString();
      const now = new Date();

      const newProduct: Product = {
        id,
        name: name.trim(),
        description: description ? String(description).trim() : undefined,
        price: priceNum,
        category: category ? String(category).trim() : undefined,
        imageUrl,
        createdAt: now,
        updatedAt: now,
      };

      productsStore.set(id, newProduct);

      res.status(201).json(newProduct);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /products/:id - update product (admin), with optional image upload
router.put(
  "/:id",
  requireAdmin,
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const existing = productsStore.get(id);

      if (!existing) {
        res.status(404).json({ message: "Product not found" });
        return;
      }

      const { name, description, price, category } = req.body;

      let updatedPrice = existing.price;
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (Number.isNaN(priceNum) || priceNum < 0) {
          res.status(400).json({ message: "Invalid price" });
          return;
        }
        updatedPrice = priceNum;
      }

      let imageUrl = existing.imageUrl;
      if (req.file) {
        imageUrl = `/uploads/undefined_undefined`;
        // TODO: persist the new file and potentially delete the old one
      }

      const updated: Product = {
        ...existing,
        name: name !== undefined ? String