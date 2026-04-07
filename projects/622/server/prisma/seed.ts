import { PrismaClient, Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const TEST_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer@example.com';
const TEST_CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'Customer123!';
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10);

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function upsertUser(params: {
  email: string;
  password: string;
  name: string;
  role: Role;
}): Promise<void> {
  const { email, password, name, role } = params;
  const hashedPassword = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      passwordHash: hashedPassword,
      updatedAt: new Date(),
    },
    create: {
      email,
      name,
      role,
      passwordHash: hashedPassword,
    },
  });
}

async function seedCategories(): Promise<Prisma.CategoryUncheckedCreateInput[]> {
  const categoriesData: Prisma.CategoryUncheckedCreateInput[] = [
    {
      id: 1,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Devices, gadgets, and accessories.',
    },
    {
      id: 2,
      name: 'Books',
      slug: 'books',
      description: 'Fiction, non-fiction, and educational books.',
    },
    {
      id: 3,
      name: 'Clothing',
      slug: 'clothing',
      description: 'Men’s, women’s, and children’s apparel.',
    },
    {
      id: 4,
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      description: 'Home appliances, decor, and kitchenware.',
    },
  ];

  for (const category of categoriesData) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description ?? null,
        updatedAt: new Date(),
      },
      create: category,
    });
  }

  return categoriesData;
}

async function seedProducts(): Promise<void> {
  const categories = await prisma.category.findMany();
  const categoryBySlug = new Map<string, number>();
  categories.forEach((c) => categoryBySlug.set(c.slug, c.id));

  const productsData: {
    name: string;
    slug: string;
    description: string;
    price: number;
    sku: string;
    categorySlug: string;
    inventoryQuantity: number;
    imageUrl?: string;
    isActive?: boolean;
  }[] = [
    {
      name: 'Wireless Noise-Cancelling Headphones',
      slug: 'wireless-noise-cancelling-headphones',
      description:
        'High-fidelity over-ear wireless headphones with active noise cancellation and 30-hour battery life.',
      price: 199.99,
      sku: 'ELEC-HEADPHONES-001',
      categorySlug: 'electronics',
      inventoryQuantity: 25,
      imageUrl: '/images/products/headphones-1.jpg',
      isActive: true,
    },
    {
      name: '4K Ultra HD Smart TV 55"',
      slug: '4k-ultra-hd-smart-tv-55',
      description:
        '55-inch 4K UHD HDR Smart TV with built-in streaming apps and voice control.',
      price: 599.0,
      sku: 'ELEC-TV-4K-055',
      categorySlug: 'electronics',
      inventoryQuantity: 10,
      imageUrl: '/images/products/tv-1.jpg',
      isActive: true,
    },
    {
      name: 'Modern JavaScript: Deep Dive',
      slug: 'modern-javascript-deep-dive',
      description:
        'Comprehensive guide to modern JavaScript, including ES6+, async programming, and TypeScript basics.',
      price: 39.5,
      sku: 'BOOK-JS-001',
      categorySlug: 'books',
      inventoryQuantity: 50,
      imageUrl: '/images/products/book-js-1.jpg',
      isActive: true,
    },
    {
      name: 'Classic Cotton T-Shirt (Unisex)',
      slug: 'classic-cotton-tshirt-unisex',
      description:
        'Soft, breathable 100% cotton t-shirt, available in multiple sizes and colors.',
      price: 19.99,
      sku: 'CLOTH-TSHIRT-001',
      categorySlug: 'clothing',
      inventoryQuantity: 100,
      imageUrl: '/images/products/tshirt-1.jpg',
      isActive: true,
    },
    {
      name: 'Non-Stick Frying Pan 10"',
      slug: 'non-stick-frying-pan-10',
      description:
        'Durable non-stick frying pan with ergonomic handle, suitable for all stovetops.',
      price: 29.99,
      sku: 'HOME-PAN-010',
      categorySlug: 'home-kitchen',
      inventoryQuantity: 40,
      imageUrl: '/images/products/pan-1.jpg',
      isActive: true,
    },
  ];

  for (const product of productsData) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) {
      continue;
    }

    const upsertedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        sku: product.sku,
        categoryId,
        imageUrl: product.imageUrl ?? null,
        isActive: product.isActive ?? true,
        updatedAt: new Date(),
      },
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        sku: product.sku,
        categoryId,
        imageUrl: product.imageUrl ?? null,
        isActive: product.isActive ?? true,
      },
    });

    const existingInventory = await prisma.inventory.findUnique({
      where: { productId: upsertedProduct.id },
    });

    if (existingInventory) {
      await prisma.inventory.update({
        where: { productId: upsertedProduct.id },
        data: {
          quantity: product.inventoryQuantity,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.inventory.create({
        data: {
          productId: upsertedProduct.id,
          quantity: product.inventoryQuantity,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  await prisma.$transaction(async (tx) => {
    const currentCount = await tx.user.count();
    console.log(`Current user count: undefined`);
  });

  console.log('Creating or updating admin user...');
  await upsertUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: 'Admin User',
    role: 'ADMIN',
  });

  console.log('Creating or updating test customer user...');
  await upsertUser({
    email: TEST_CUSTOMER_EMAIL,
    password: TEST_CUSTOMER_PASSWORD,
    name: 'Test Customer',
    role: 'CUSTOMER',
  });

  console.log('Seeding categories...');
  await seedCategories();

  console.log('Seeding products and inventory...');
  await seedProducts();

  console.log('✅ Database seeding completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Error during database seeding:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });