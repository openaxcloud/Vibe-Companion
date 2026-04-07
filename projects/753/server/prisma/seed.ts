import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type Role = 'USER' | 'ADMIN';

const DEMO_USERS: Array<{
  email: string;
  name: string;
  password: string;
  role: Role;
}> = [
  {
    email: 'demo.user@example.com',
    name: 'Demo User',
    password: 'password123',
    role: 'USER',
  },
  {
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'adminpassword',
    role: 'ADMIN',
  },
];

const CATEGORIES: Array<{
  slug: string;
  name: string;
  description?: string;
}> = [
  {
    slug: 'electronics',
    name: 'Electronics',
    description: 'Smart devices, computers, and accessories.',
  },
  {
    slug: 'books',
    name: 'Books',
    description: 'Fiction, non-fiction, and educational materials.',
  },
  {
    slug: 'apparel',
    name: 'Apparel',
    description: 'Clothing and fashion accessories.',
  },
];

const PRODUCTS: Array<{
  slug: string;
  name: string;
  description: string;
  price: number;
  categorySlug: string;
  images: string[];
  inventoryCount: number;
  isActive?: boolean;
}> = [
  {
    slug: 'wireless-headphones',
    name: 'Wireless Headphones',
    description:
      'Noise-cancelling over-ear wireless headphones with 30 hours of battery life.',
    price: 129.99,
    categorySlug: 'electronics',
    images: [
      '/images/products/wireless-headphones-1.jpg',
      '/images/products/wireless-headphones-2.jpg',
    ],
    inventoryCount: 50,
    isActive: true,
  },
  {
    slug: 'smartphone-128gb',
    name: 'Smartphone 128GB',
    description:
      'High-performance smartphone with 128GB storage and an amazing camera.',
    price: 699.0,
    categorySlug: 'electronics',
    images: [
      '/images/products/smartphone-128gb-1.jpg',
      '/images/products/smartphone-128gb-2.jpg',
    ],
    inventoryCount: 30,
    isActive: true,
  },
  {
    slug: 'modern-javascript-book',
    name: 'Modern JavaScript Book',
    description:
      'A comprehensive guide to modern JavaScript, covering ES6+ and beyond.',
    price: 39.99,
    categorySlug: 'books',
    images: ['/images/products/modern-javascript-book-1.jpg'],
    inventoryCount: 100,
    isActive: true,
  },
  {
    slug: 'cotton-tshirt',
    name: 'Cotton T-Shirt',
    description: 'Comfortable 100% cotton t-shirt available in multiple sizes.',
    price: 19.99,
    categorySlug: 'apparel',
    images: ['/images/products/cotton-tshirt-1.jpg'],
    inventoryCount: 200,
    isActive: true,
  },
];

async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}

async function upsertUser(user: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  const passwordHash = await hashPassword(user.password);

  return prisma.user.upsert({
    where: { email: user.email },
    create: {
      email: user.email,
      name: user.name,
      passwordHash,
      role: user.role,
    },
    update: {
      name: user.name,
      role: user.role,
      passwordHash,
    },
  });
}

async function upsertCategory(category: {
  slug: string;
  name: string;
  description?: string;
}) {
  return prisma.category.upsert({
    where: { slug: category.slug },
    create: {
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
    },
    update: {
      name: category.name,
      description: category.description ?? null,
    },
  });
}

async function upsertProduct(
  product: (typeof PRODUCTS)[number],
  categoryId: string,
) {
  const productData: Prisma.ProductUpsertArgs = {
    where: { slug: product.slug },
    create: {
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive ?? true,
      category: {
        connect: { id: categoryId },
      },
      inventory: {
        create: {
          quantity: product.inventoryCount,
        },
      },
      images: {
        create: product.images.map((url, index) => ({
          url,
          altText: `undefined image undefined`,
          order: index,
        })),
      },
    },
    update: {
      name: product.name,
      description: product.description,
      price: product.price,
      isActive: product.isActive ?? true,
      category: {
        connect: { id: categoryId },
      },
      inventory: {
        upsert: {
          create: {
            quantity: product.inventoryCount,
          },
          update: {
            quantity: product.inventoryCount,
          },
        },
      },
      images: {
        deleteMany: {},
        create: product.images.map((url, index) => ({
          url,
          altText: `undefined image undefined`,
          order: index,
        })),
      },
    },
  };

  return prisma.product.upsert(productData);
}

async function main() {
  console.log('🌱 Starting database seed...');

  console.log('🔐 Seeding users (demo + admin)...');
  for (const user of DEMO_USERS) {
    const seededUser = await upsertUser(user);
    console.log(`  - User upserted: undefined`);
  }

  console.log('📂 Seeding categories...');
  const categoryMap = new Map<string, string>();

  for (const category of CATEGORIES) {
    const seededCategory = await upsertCategory(category);
    categoryMap.set(category.slug, seededCategory.id);
    console.log(`  - Category upserted: undefined`);
  }

  console.log('🛒 Seeding products, images, and inventory...');
  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categorySlug);

    if (!categoryId) {
      console.warn(
        `  ! Skipping product "undefined" - category "undefined" not found`,
      );
      continue;
    }

    const seededProduct = await upsertProduct(product, categoryId);
    console.log(
      `  - Product upserted: undefined (category: undefined)`,
    );
  }

  console.log('✅ Database seeding completed.');
}

main()
  .catch((error) => {
    console.error('❌ Error during database seeding:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });