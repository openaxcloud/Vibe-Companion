import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "AdminPassword123!";
const ADMIN_NAME = "Store Admin";

const CATEGORY_SEED: Prisma.CategoryCreateInput[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Phones, laptops, and other electronic devices.",
  },
  {
    name: "Books",
    slug: "books",
    description: "Fiction, non-fiction, and educational books.",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Home appliances, kitchen tools, and decor.",
  },
];

type DemoProductSeed = {
  name: string;
  slug: string;
  description: string;
  price: number;
  categorySlug: string;
  images: {
    url: string;
    alt: string;
    isPrimary?: boolean;
  }[];
  inventoryCount: number;
};

const PRODUCT_SEED: DemoProductSeed[] = [
  {
    name: "Smartphone X200",
    slug: "smartphone-x200",
    description:
      "A powerful smartphone with stunning display and excellent battery life.",
    price: 79900,
    categorySlug: "electronics",
    images: [
      {
        url: "https://picsum.photos/seed/smartphone-x200-front/800/600",
        alt: "Smartphone X200 front view",
        isPrimary: true,
      },
      {
        url: "https://picsum.photos/seed/smartphone-x200-back/800/600",
        alt: "Smartphone X200 back view",
      },
    ],
    inventoryCount: 25,
  },
  {
    name: "Ultrabook Pro 14",
    slug: "ultrabook-pro-14",
    description:
      "Lightweight ultrabook with long battery life, perfect for productivity.",
    price: 129900,
    categorySlug: "electronics",
    images: [
      {
        url: "https://picsum.photos/seed/ultrabook-pro-14/800/600",
        alt: "Ultrabook Pro 14 open on desk",
        isPrimary: true,
      },
    ],
    inventoryCount: 15,
  },
  {
    name: "Modern JavaScript Guide",
    slug: "modern-javascript-guide",
    description:
      "Comprehensive guide to modern JavaScript including ES2023 and beyond.",
    price: 4900,
    categorySlug: "books",
    images: [
      {
        url: "https://picsum.photos/seed/js-book-cover/800/600",
        alt: "Modern JavaScript Guide book cover",
        isPrimary: true,
      },
    ],
    inventoryCount: 40,
  },
  {
    name: "Non-Stick Cookware Set",
    slug: "non-stick-cookware-set",
    description:
      "Durable non-stick cookware set with pans and pots for everyday cooking.",
    price: 9900,
    categorySlug: "home-kitchen",
    images: [
      {
        url: "https://picsum.photos/seed/cookware-set/800/600",
        alt: "Non-stick cookware set in kitchen",
        isPrimary: true,
      },
    ],
    inventoryCount: 30,
  },
];

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function upsertAdminUser(): Promise<void> {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
}

async function seedCategories(): Promise<Map<string, number>> {
  const categorySlugToId = new Map<string, number>();

  for (const category of CATEGORY_SEED) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: category,
    });

    categorySlugToId.set(created.slug, created.id);
  }

  return categorySlugToId;
}

async function seedProducts(categorySlugToId: Map<string, number>): Promise<void> {
  for (const product of PRODUCT_SEED) {
    const categoryId = categorySlugToId.get(product.categorySlug);
    if (!categoryId) continue;

    const createdProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        category: { connect: { id: categoryId } },
      },
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        category: { connect: { id: categoryId } },
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: createdProduct.id },
    });

    if (product.images && product.images.length > 0) {
      await prisma.productImage.createMany({
        data: product.images.map((image, index) => ({
          productId: createdProduct.id,
          url: image.url,
          alt: image.alt,
          isPrimary: image.isPrimary ?? index === 0,
          sortOrder: index,
        })),
      });
    }

    await prisma.inventory.upsert({
      where: { productId: createdProduct.id },
      update: { quantity: product.inventoryCount },
      create: {
        productId: createdProduct.id,
        quantity: product.inventoryCount,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log("🌱 Starting database seed...");

  console.log("Creating/updating admin user...");
  await upsertAdminUser();

  console.log("Seeding categories...");
  const categorySlugToId = await seedCategories();

  console.log("Seeding products and inventory...");
  await seedProducts(categorySlugToId);

  console.log("✅ Seeding completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });