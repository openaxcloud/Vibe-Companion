import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminPass123!';
const DEMO_USERS = [
  {
    email: 'demo1@example.com',
    password: 'DemoPass123!',
    name: 'Demo User One',
  },
  {
    email: 'demo2@example.com',
    password: 'DemoPass123!',
    name: 'Demo User Two',
  },
  {
    email: 'demo3@example.com',
    password: 'DemoPass123!',
    name: 'Demo User Three',
  },
];

const CATEGORIES = [
  {
    name: 'Electronics',
    description: 'Latest gadgets, devices, and accessories.',
    products: [
      {
        name: 'Wireless Headphones',
        description: 'Noise-cancelling over-ear wireless headphones with 30h battery life.',
        price: 129.99,
        sku: 'ELEC-WH-001',
        inventory: 50,
      },
      {
        name: '4K Monitor 27"',
        description: 'Ultra HD 4K IPS monitor, 27-inch, ideal for work and gaming.',
        price: 349.5,
        sku: 'ELEC-MON-027',
        inventory: 20,
      },
      {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical keyboard with blue switches and detachable wrist rest.',
        price: 89.0,
        sku: 'ELEC-KBD-MECH',
        inventory: 75,
      },
    ],
  },
  {
    name: 'Home & Kitchen',
    description: 'Essentials and accessories for your home and kitchen.',
    products: [
      {
        name: 'Stainless Steel Cookware Set',
        description: '10-piece stainless steel cookware set compatible with all cooktops.',
        price: 199.99,
        sku: 'HOME-COOK-SET10',
        inventory: 30,
      },
      {
        name: 'Air Purifier',
        description: 'HEPA air purifier suitable for rooms up to 400 sq. ft.',
        price: 149.0,
        sku: 'HOME-AIR-PUR',
        inventory: 40,
      },
    ],
  },
  {
    name: 'Books',
    description: 'Fiction, non-fiction, and educational books.',
    products: [
      {
        name: 'The Pragmatic Programmer',
        description: 'Classic book on software craftsmanship and professional development.',
        price: 42.0,
        sku: 'BOOK-PRAG-PROG',
        inventory: 60,
      },
      {
        name: 'Clean Code',
        description: 'A Handbook of Agile Software Craftsmanship by Robert C. Martin.',
        price: 39.5,
        sku: 'BOOK-CLEAN-CODE',
        inventory: 45,
      },
      {
        name: 'Atomic Habits',
        description: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones.',
        price: 24.99,
        sku: 'BOOK-ATOM-HAB',
        inventory: 80,
      },
    ],
  },
];

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function upsertAdminUser(): Promise<void> {
  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      name: 'Administrator',
      isActive: true,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: hashedPassword,
      role: Role.ADMIN,
      name: 'Administrator',
      isActive: true,
    },
  });
}

async function seedDemoUsers(): Promise<void> {
  for (const demoUser of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: demoUser.email },
    });

    if (existing) {
      continue;
    }

    const hashedPassword = await hashPassword(demoUser.password);

    await prisma.user.create({
      data: {
        email: demoUser.email,
        passwordHash: hashedPassword,
        role: Role.USER,
        name: demoUser.name,
        isActive: true,
      },
    });
  }
}

async function seedCategoriesAndProducts(): Promise<void> {
  for (const category of CATEGORIES) {
    const existingCategory = await prisma.category.findUnique({
      where: { name: category.name },
    });

    const categoryRecord =
      existingCategory ??
      (await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
        },
      }));

    for (const product of category.products) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku: product.sku },
      });

      if (existingProduct) {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name: product.name,
            description: product.description,
            price: product.price,
            categoryId: categoryRecord.id,
            inventory: {
              update: {
                quantity: product.inventory,
              },
            },
          },
        });
      } else {
        await prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            price: product.price,
            sku: product.sku,
            categoryId: categoryRecord.id,
            inventory: {
              create: {
                quantity: product.inventory,
              },
            },
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');
  await upsertAdminUser();
  console.log('✅ Admin user seeded/updated');

  await seedDemoUsers();
  console.log('✅ Demo users seeded');

  await seedCategoriesAndProducts();
  console.log('✅ Categories, products, and inventory seeded');

  console.log('🌱 Database seed completed successfully');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });