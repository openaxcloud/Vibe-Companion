import { Prisma, Product, Category } from '@prisma/client';
import { prisma } from '../prismaClient';

export interface ProductFilter {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface SortOptions {
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const buildProductWhereClause = (filter?: ProductFilter): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (!filter) {
    return where;
  }

  const { search, categoryId, minPrice, maxPrice, inStock } = filter;
  const AND: Prisma.ProductWhereInput[] = [];

  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    AND.push({
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (typeof categoryId === 'number') {
    AND.push({ categoryId });
  }

  if (typeof minPrice === 'number' || typeof maxPrice === 'number') {
    const priceFilter: Prisma.DecimalFilter = {};
    if (typeof minPrice === 'number') {
      priceFilter.gte = new Prisma.Decimal(minPrice);
    }
    if (typeof maxPrice === 'number') {
      priceFilter.lte = new Prisma.Decimal(maxPrice);
    }
    AND.push({ price: priceFilter });
  }

  if (typeof inStock === 'boolean') {
    if (inStock) {
      AND.push({ stock: { gt: 0 } });
    } else {
      AND.push({ stock: { lte: 0 } });
    }
  }

  if (AND.length > 0) {
    where.AND = AND;
  }

  return where;
};

const buildProductOrderBy = (sort?: SortOptions): Prisma.ProductOrderByWithRelationInput => {
  const sortBy = sort?.sortBy ?? 'createdAt';
  const sortOrder = sort?.sortOrder ?? 'desc';

  return {
    [sortBy]: sortOrder,
  } as Prisma.ProductOrderByWithRelationInput;
};

export const productRepository = {
  async getProducts(
    filter?: ProductFilter,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Product>> {
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const pageSize =
      pagination?.pageSize && pagination.pageSize > 0 && pagination.pageSize <= 100
        ? pagination.pageSize
        : 20;

    const where = buildProductWhereClause(filter);
    const orderBy = buildProductOrderBy(sort);

    const [total, data] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async getProductById(id: number): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { slug },
    });
  },

  async createProduct(data: Prisma.ProductCreateInput): Promise<Product> {
    return prisma.product.create({
      data,
    });
  },

  async updateProduct(id: number, data: Prisma.ProductUpdateInput): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data,
    });
  },

  async deleteProduct(id: number): Promise<Product> {
    return prisma.product.delete({
      where: { id },
    });
  },

  async getCategories(): Promise<Category[]> {
    return prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  },

  async getCategoryById(id: number): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { id },
    });
  },

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { slug },
    });
  },

  async createCategory(data: Prisma.CategoryCreateInput): Promise<Category> {
    return prisma.category.create({
      data,
    });
  },

  async updateCategory(id: number, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data,
    });
  },

  async deleteCategory(id: number): Promise<Category> {
    return prisma.category.delete({
      where: { id },
    });
  },

  async getProductsByCategoryId(
    categoryId: number,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Product>> {
    return this.getProducts({ categoryId }, pagination, sort);
  },

  async getDistinctCategoriesWithCounts(): Promise<
    { category: Category; productCount: number }[]
  > {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      _count: {
        id: true,
      },
    });

    const countMap = new Map<number, number>();
    counts.forEach((c) => {
      if (c.categoryId != null) {
        countMap.set(c.categoryId, c._count.id);
      }
    });

    return categories.map((category) => ({
      category,
      productCount: countMap.get(category.id) ?? 0,
    }));
  },
};