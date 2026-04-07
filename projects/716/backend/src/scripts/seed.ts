import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  description?: string | null;
};

type SeedProduct = {
  name: string;
  description?: string | null;
  price: number;
  sku: string;
  stock: number;
  categoryName: string;
  imageUrl?: string | null;
  isActive?: boolean;
};

const seedCategories: SeedCategory[] = [
  {
    name: 'Electronics',
    description: 'Devices, gadgets, and accessories.',
  },
  {
    name: 'Books',
    description: 'Fiction, non-fiction, and educational materials.',
  },
  {
    name: 'Home & Kitchen',
    description: 'Home appliances, decor, and kitchenware.',
  },
  {
    name: 'Clothing',
    description: 'Men’s and women’s apparel.',
  },
];

const seedProducts: SeedProduct[] = [
  {
    name: 'Wireless Headphones',
    description: 'Noise-cancelling over-ear wireless headphones with 30h battery life.',
    price: 129.99,
    sku: 'ELEC-WH-001',
    stock: 50,
    categoryName: 'Electronics',
    imageUrl: 'https://example.com/images/wireless-headphones.jpg',
    isActive: true,
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB backlit mechanical keyboard with blue switches.',
    price: 89.5,
    sku: 'ELEC-MK-002',
    stock: 30,
    categoryName: 'Electronics',
    imageUrl: 'https://example.com/images/mech-keyboard.jpg',
    isActive: true,
  },
  {
    name: 'Stainless Steel Cookware Set',
    description: '10-piece stainless steel cookware set suitable for all cooktops.',
    price: 159.99,
    sku: 'HOME-CK-003',
    stock: 20,
    categoryName: 'Home & Kitchen',
    imageUrl: 'https://example.com/images/cookware-set.jpg',
    isActive: true,
  },
  {
    name: 'Throw Pillow Set',
    description: 'Set of 4 decorative throw pillows with removable covers.',
    price: 39.99,
    sku: 'HOME-TP-004',
    stock: 60,
    categoryName: 'Home & Kitchen',
    imageUrl: 'https://example.com/images/throw-pillows.jpg',
    isActive: true,
  },
  {
    name: 'Classic Cotton T-Shirt',
    description: 'Unisex classic fit cotton t-shirt available in multiple colors.',
    price: 19.99,
    sku: 'CLOTH-TS-005',
    stock: 100,
    categoryName: 'Clothing',
    imageUrl: 'https://example.com/images/cotton-tshirt.jpg',
    isActive: true,
  },
  {
    name: 'Denim Jeans',
    description: 'Slim-fit stretch denim jeans.',
    price: 49.99,
    sku: 'CLOTH-DJ-006',
    stock: 75,
    categoryName: 'Clothing',
    imageUrl: 'https://example.com/images/denim-jeans.jpg',
    isActive: true,
  },
  {
    name: 'Intro to TypeScript',
    description: 'Beginner friendly guide to learning TypeScript for JavaScript developers.',
    price: 29.99,
    sku: 'BOOK-TS-007',
    stock: 40,
    categoryName: 'Books',
    imageUrl: 'https://example.com/images/typescript-book.jpg',
    isActive: true,
  },
  {
    name: 'Clean Architecture',
    description: 'A Handbook of Agile Software Craftsmanship.',
    price: 34.99,
    sku: 'BOOK-CA-008',
    stock: 25,
    categoryName: 'Books',
    imageUrl: 'https://example.com/images/clean-architecture.jpg',
    isActive: true,
  },
];

const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@example.com';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin123';
const DEMO_ADMIN_NAME = process.env.DEMO_ADMIN_NAME || 'Demo Admin';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function upsertAdminUser(): Promise<void> {
  console.log('Seeding demo admin user...');

  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);

  const adminUser = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      name: DEMO_ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: DEMO_ADMIN_EMAIL,
      name: DEMO_ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`Demo admin user ready: undefined`);
}

async function seedCategoriesAndProducts(): Promise<void> {
  console.log('Seeding categories...');

  const categoryMap = new Map<string, string>();

  for (const category of seedCategories) {
    const created = await prisma.category.upsert({
      where: { name: category.name },
      update: {
        description: category.description ?? null,
      },
      create: {
        name: category.name,
        description: category.description ?? null,
      },
    });

    categoryMap.set(created.name, created.id);
    console.log(`Category ready: undefined`);
  }

  console.log('Seeding products...');

  for (const product of seedProducts) {
    const categoryId = categoryMap.get(product.categoryName);
    if (!categoryId) {
      console.warn(
        `Skipping product "undefined" because category "undefined" was not found.`
      );
      continue;
    }

    const existing = await prisma.product.findUnique({
      where: { sku: product.sku },
      select: { id: true },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          description: product.description ?? null,
          price: product.price,
          stock: product.stock,
          categoryId,
          imageUrl: product.imageUrl ?? null,
          isActive: product.isActive ?? true,
        },
      });
      console.log(`Updated product: undefined (undefined)`);
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description ?? null,
          price: product.price,
          sku: product.sku,
          stock: product.stock,
          categoryId,
          imageUrl: product.imageUrl ?? null,
          isActive: product.isActive ?? true,
        },
      });
      console.log(`Created product: undefined (undefined)`);
    }
  }
}

async function main(): Promise<void> {
  console.log('Starting database seed...');
  await upsertAdminUser();
  await seedCategoriesAndProducts();
  console.log('Database seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });