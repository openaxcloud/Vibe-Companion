import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { Product } from "../models/product.model";
import { Inventory } from "../models/inventory.model";

type SortOrder = "asc" | "desc";

interface ListProductsQuery {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

interface CreateProductBody {
  name: string;
  description?: string;
  category?: string;
  price: number;
  sku?: string;
  images?: string[];
  isActive?: boolean;
  inventory?: {
    quantity: number;
    location?: string;
  };
}

interface UpdateProductBody {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  sku?: string;
  images?: string[];
  isActive?: boolean;
  inventory?: {
    quantity?: number;
    location?: string;
  } | null;
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

const buildProductFilters = (query: ListProductsQuery) => {
  const filters: Record<string, unknown> = { isDeleted: { $ne: true } };

  if (query.q) {
    const regex = new RegExp(query.q, "i");
    filters.$or = [
      { name: regex },
      { description: regex },
      { sku: regex },
      { category: regex },
    ];
  }

  if (query.category) {
    filters.category = query.category;
  }

  const minPrice = parseNumber(query.minPrice);
  const maxPrice = parseNumber(query.maxPrice);
  if (minPrice !== undefined || maxPrice !== undefined) {
    filters.price = {};
    if (minPrice !== undefined) {
      (filters.price as Record<string, number>).$gte = minPrice;
    }
    if (maxPrice !== undefined) {
      (filters.price as Record<string, number>).$lte = maxPrice;
    }
  }

  return filters;
};

const buildSortOptions = (
  sortParam: string | undefined
): Record<string, 1 | -1> => {
  if (!sortParam) {
    return { createdAt: -1 };
  }

  const [field, order] = sortParam.split(":");
  const sortOrder: SortOrder = order === "asc" ? "asc" : "desc";

  const allowedFields: Record<string, string> = {
    created: "createdAt",
    price: "price",
    name: "name",
    updated: "updatedAt",
  };

  const sortField = allowedFields[field] || "createdAt";
  return {
    [sortField]: sortOrder === "asc" ? 1 : -1,
  };
};

export const listProducts = async (
  req: Request<unknown, unknown, unknown, ListProductsQuery>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page: pageStr = "1",
      limit: limitStr = "20",
      sort,
    } = req.query;

    const page = Math.max(parseInt(pageStr, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100);

    const filters = buildProductFilters(req.query);
    const sortOptions = buildSortOptions(sort);

    const [items, total] = await Promise.all([
      Product.find(filters)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filters),
    ]);

    res.status(httpStatus.OK).json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Invalid product id" });
      return;
    }

    const product = await Product.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).lean();

    if (!product) {
      res.status(httpStatus.NOT_FOUND).json({ message: "Product not found" });
      return;
    }

    res.status(httpStatus.OK).json({ data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (
  req: Request<unknown, unknown, CreateProductBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      price,
      sku,
      images,
      isActive = true,
      inventory,
    } = req.body;

    if (!name || typeof price !== "number") {
      res.status(httpStatus.BAD_REQUEST).json({
        message: "Missing required fields: name, price",
      });
      return;
    }

    const session = await Product.startSession();
    session.startTransaction();

    try {
      const product = await Product.create(
        [
          {
            name,
            description,
            category,
            price,
            sku,
            images: images || [],
            isActive,
          },
        ],
        { session }
      );

      const createdProduct = product[0];

      if (inventory && typeof inventory.quantity === "number") {
        await Inventory.create(
          [
            {
              productId: createdProduct._id,
              quantity: inventory.quantity,
              location: inventory.location || "default",
            },
          ],
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      const populatedProduct = await Product.findById(createdProduct._id)
        .lean()
        .exec();

      res.status(httpStatus.CREATED).json({ data: populatedProduct });
    } catch (innerError) {
      await session.abortTransaction();
      session.endSession();
      throw innerError;
    }
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request<{ id: string }, unknown, UpdateProductBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      price,
      sku,
      images,
      isActive,
      inventory,
    } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Invalid product id" });
      return;
    }

    const session = await Product.startSession();
    session.startTransaction();

    try {
      const product = await Product.findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        {
          $set: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(category !== undefined && { category }),
            ...(price !== undefined && { price }),
            ...(sku !== undefined && { sku }),
            ...(images !== undefined && { images }),
            ...(isActive !== undefined && { isActive }),
          },
        },
        { new: true, session }
      ).lean();

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        res.status(httpStatus.NOT_FOUND).json({ message: "Product not found" });
        return;
      }

      if (inventory !== undefined) {
        if (inventory === null) {
          await Inventory.deleteOne({ productId: product._id }).session(
            session
          );
        } else {
          const existingInventory = await Inventory.findOne({
            productId: product._id,
          })
            .session(session)
            .exec();

          if (!existingInventory) {
            if (typeof inventory.quantity === "number") {
              await Inventory.create(
                [
                  {
                    productId: product._id,
                    quantity: inventory.quantity,
                    location: inventory.location || "default",
                  },
                ],
                { session }
              );
            }
          } else {
            await Inventory.updateOne(
              { _id: existingInventory._id },
              {
                $set: {
                  ...(typeof inventory.quantity === "number" && {
                    quantity: inventory.quantity,
                  }),
                  ...(inventory.location !== undefined && {
                    location: inventory.location,
                  }),
                },
              }
            ).session(session);
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      const updatedProduct = await Product.findById(id).lean().exec();

      res.status(httpStatus.OK).json({ data: updatedProduct });
    } catch (innerError) {
      await session.abortTransaction();
      session.endSession();
      throw innerError;
    }
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request<{ id: string