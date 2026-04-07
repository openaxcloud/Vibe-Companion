import { PrismaClient, Category, Prisma } from '@prisma/client';
import createHttpError from 'http-errors';

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface CategoryQueryOptions {
  search?: string;
  take?: number;
  skip?: number;
  includeProductCount?: boolean;
}

export interface CategoryWithMetaDTO extends CategoryDTO {
  productCount?: number;
}

const prisma = new PrismaClient();

const mapToCategoryDTO = (category: Category): CategoryDTO => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const mapToCategoryWithMetaDTO = (
  category: Category & { _count?: { products: number } }
): CategoryWithMetaDTO => ({
  ...mapToCategoryDTO(category),
  productCount: category._count?.products,
});

const validateCreateInput = (input: CreateCategoryInput): void => {
  if (!input.name || typeof input.name !== 'string') {
    throw createHttpError(400, 'Category name is required');
  }
  if (!input.slug || typeof input.slug !== 'string') {
    throw createHttpError(400, 'Category slug is required');
  }
};

const validateUpdateInput = (input: UpdateCategoryInput): void => {
  if (!input.name && !input.slug && input.description === undefined) {
    throw createHttpError(400, 'No fields provided to update');
  }
};

const buildWhereClause = (options?: CategoryQueryOptions): Prisma.CategoryWhereInput => {
  const where: Prisma.CategoryWhereInput = {};

  if (options?.search) {
    const search = options.search.trim();
    if (search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  return where;
};

export const categoryService = {
  async listCategories(options?: CategoryQueryOptions): Promise<CategoryWithMetaDTO[]> {
    const where = buildWhereClause(options);

    const categories = await prisma.category.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { name: 'asc' },
      include: options?.includeProductCount
        ? {
            _count: {
              select: { products: true },
            },
          }
        : undefined,
    });

    if (options?.includeProductCount) {
      return categories.map(mapToCategoryWithMetaDTO);
    }

    return categories.map(mapToCategoryDTO);
  },

  async getCategoryById(id: string, includeProductCount = false): Promise<CategoryWithMetaDTO> {
    if (!id) {
      throw createHttpError(400, 'Category ID is required');
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: includeProductCount
        ? {
            _count: {
              select: { products: true },
            },
          }
        : undefined,
    });

    if (!category) {
      throw createHttpError(404, 'Category not found');
    }

    if (includeProductCount) {
      return mapToCategoryWithMetaDTO(category as Category & { _count: { products: number } });
    }

    return mapToCategoryDTO(category);
  },

  async getCategoryBySlug(slug: string, includeProductCount = false): Promise<CategoryWithMetaDTO> {
    if (!slug) {
      throw createHttpError(400, 'Category slug is required');
    }

    const category = await prisma.category.findUnique({
      where: { slug },
      include: includeProductCount
        ? {
            _count: {
              select: { products: true },
            },
          }
        : undefined,
    });

    if (!category) {
      throw createHttpError(404, 'Category not found');
    }

    if (includeProductCount) {
      return mapToCategoryWithMetaDTO(category as Category & { _count: { products: number } });
    }

    return mapToCategoryDTO(category);
  },

  async createCategory(input: CreateCategoryInput): Promise<CategoryDTO> {
    validateCreateInput(input);

    const existingBySlug = await prisma.category.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });

    if (existingBySlug) {
      throw createHttpError(409, 'Category slug already exists');
    }

    const category = await prisma.category.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description?.trim() || null,
      },
    });

    return mapToCategoryDTO(category);
  },

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
    if (!id) {
      throw createHttpError(400, 'Category ID is required');
    }

    validateUpdateInput(input);

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw createHttpError(404, 'Category not found');
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await prisma.category.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (slugExists) {
        throw createHttpError(409, 'Category slug already exists');
      }
    }

    const data: Prisma.CategoryUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }
    if (input.slug !== undefined) {
      data.slug = input.slug.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description ? input.description.trim() : null;
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    return mapToCategoryDTO(updated);
  },

  async deleteCategory(id: string): Promise<void> {
    if (!id) {
      throw createHttpError(400, 'Category ID is required');
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw createHttpError(404, 'Category not found');
    }

    if (category._count.products > 0) {
      throw createHttpError(
        409,
        'Cannot delete category with associated products. Reassign or delete products first.'
      );
    }

    await prisma.category.delete({
      where: { id },
    });
  },

  async assertCategoryExists(id: string): Promise<void> {
    if (!id) {
      throw createHttpError(400, 'Category ID is required');
    }

    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw createHttpError(404, 'Category not found');
    }
  },
};

export default categoryService;