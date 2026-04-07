import { PrismaClient, Product, Category, Prisma } from '@prisma/client';

export interface ProductFilterOptions {
  search?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  tags?: string[];
  includeOutOfStock?: boolean;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface SortOptions {
  sortBy?: 'createdAt' | 'price' | 'name' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListProductsOptions {
  filters?: ProductFilterOptions;
  pagination?: PaginationOptions;
  sort?: SortOptions;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  stock: number;
  isActive?: boolean;
  isFeatured?: boolean;
  mainImageUrl?: string;
  galleryImageUrls?: string[];
  categoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  sku?: string;
  stock?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  mainImageUrl?: string;
  galleryImageUrls?: string[];
  categoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface ProductWithRelations extends Product {
  categories?: Category[];
  relatedProducts?: Product[];
}

export class ProductService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  async listProducts(options: ListProductsOptions = {}): Promise<PaginatedResult<ProductWithRelations>> {
    const {
      filters = {},
      pagination = {},
      sort = {},
    } = options;

    const {
      search,
      categoryIds,
      minPrice,
      maxPrice,
      isFeatured,
      isActive = true,
      tags,
      includeOutOfStock = true,
    } = filters;

    const {
      page = 1,
      pageSize = 20,
    } = pagination;

    const {
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = sort;

    const where: Prisma.ProductWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (typeof isFeatured === 'boolean') {
      where.isFeatured = isFeatured;
    }

    if (!includeOutOfStock) {
      where.stock = { gt: 0 };
    }

    if (typeof minPrice === 'number' || typeof maxPrice === 'number') {
      where.price = {};
      if (typeof minPrice === 'number') {
        where.price.gte = minPrice;
      }
      if (typeof maxPrice === 'number') {
        where.price.lte = maxPrice;
      }
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags,
      };
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (categoryIds && categoryIds.length > 0) {
      where.categories = {
        some: {
          id: { in: categoryIds },
        },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          categories: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getProductById(id: string): Promise<ProductWithRelations | null> {
    if (!id) {
      throw new Error('Product id is required');
    }

    return this.prisma.product.findUnique({
      where: { id },
      include: {
        categories: true,
      },
    });
  }

  async getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
    if (!slug) {
      throw new Error('Product slug is required');
    }

    return this.prisma.product.findUnique({
      where: { slug },
      include: {
        categories: true,
      },
    });
  }

  async createProduct(input: CreateProductInput): Promise<ProductWithRelations> {
    const {
      name,
      slug,
      description,
      price,
      currency,
      sku,
      stock,
      isActive = true,
      isFeatured = false,
      mainImageUrl,
      galleryImageUrls,
      categoryIds,
      tags,
      metadata,
    } = input;

    if (!name || !slug) {
      throw new Error('Product name and slug are required');
    }

    const data: Prisma.ProductCreateInput = {
      name,
      slug,
      description: description ?? null,
      price,
      currency,
      sku: sku ?? null,
      stock,
      isActive,
      isFeatured,
      mainImageUrl: mainImageUrl ?? null,
      galleryImageUrls: galleryImageUrls ?? [],
      tags: tags ?? [],
      metadata: metadata ?? Prisma.JsonNull,
      categories: categoryIds && categoryIds.length > 0 ? {
        connect: categoryIds.map((id) => ({ id })),
      } : undefined,
    };

    return this.prisma.product.create({
      data,
      include: {
        categories: true,
      },
    });
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductWithRelations> {
    if (!id) {
      throw new Error('Product id is required');
    }

    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Product not found');
    }

    const {
      name,
      slug,
      description,
      price,
      currency,
      sku,
      stock,
      isActive,
      isFeatured,
      mainImageUrl,
      galleryImageUrls,
      categoryIds,
      tags,
      metadata,
    } = input;

    const data: Prisma.ProductUpdateInput = {};

    if (typeof name !== 'undefined') data.name = name;
    if (typeof slug !== 'undefined') data.slug = slug;
    if (typeof description !== 'undefined') data.description = description;
    if (typeof price !== 'undefined') data.price = price;
    if (typeof currency !== 'undefined') data.currency = currency;
    if (typeof sku !== 'undefined') data.sku = sku;
    if (typeof stock !== 'undefined') data.stock = stock;
    if (typeof isActive !== 'undefined') data.isActive = isActive;
    if (typeof isFeatured !== 'undefined') data.isFeatured = isFeatured;
    if (typeof mainImageUrl !== 'undefined') data.mainImageUrl = mainImageUrl;
    if (typeof galleryImageUrls !== 'undefined') data.galleryImageUrls = galleryImageUrls;
    if (typeof tags !== 'undefined') data.tags = tags;
    if (typeof metadata !== 'undefined') {
      data.metadata = metadata === null ? Prisma.JsonNull : metadata;
    }

    if (categoryIds) {
      data.categories = {
        set: [],
        connect: categoryIds.map((id) => ({ id })),
      };
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        categories: true,
      },
    });
  }

  async setProductCategories(productId: string, categoryIds: string[]): Promise<ProductWithRelations> {
    if (!productId) {
      throw new Error('Product id is required');
    }

    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        categories: {
          set: [],
          connect: categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        categories: true,
      },
    });
  }

  async addProductCategories(productId: string, categoryIds: string[]): Promise<ProductWithRelations> {
    if (!productId) {
      throw new Error('Product id is required');
    }

    if