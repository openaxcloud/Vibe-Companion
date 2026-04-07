import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  slug: string;
  description?: string | null;
};

type SeedProductImage = {
  url: string;
  altText: string;
  order: number;
};

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  sku: string;
  categorySlug: string;
  stock: number;
  images: SeedProductImage[];
  isActive?: boolean;
};

type SeedUser = {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER';
};

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

const categories: SeedCategory[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Latest gadgets, smartphones, and electronics.',
  },
  {
    name: 'Books',
    slug: 'books',
    description: 'Fiction, non-fiction, and educational books.',
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Essentials and accessories for your home and kitchen.',
  },
];

const products: SeedProduct[] = [
  {
    name: 'Wireless Noise-Cancelling Headphones',
    slug: 'wireless-noise-cancelling-headphones',
    description:
      'Premium over-ear wireless headphones with active noise cancellation and 30-hour battery life.',
    price: 199.99,
    sku: 'ELEC-HEADPHONES-001',
    categorySlug: 'electronics',
    stock: 25,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/3394664/pexels-photo-3394664.jpeg',
        altText: 'Black over-ear wireless headphones on a table',
        order: 1,
      },
      {
        url: 'https://images.pexels.com/photos/159643/spotify-app-music-streaming-159643.jpeg',
        altText: 'Person wearing headphones listening to music',
        order: 2,
      },
    ],
  },
  {
    name: 'Smartphone 128GB',
    slug: 'smartphone-128gb',
    description:
      'Modern smartphone with 128GB storage, dual camera system, and edge-to-edge display.',
    price: 699.0,
    sku: 'ELEC-PHONE-128-001',
    categorySlug: 'electronics',
    stock: 15,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg',
        altText: 'Smartphone with colorful screen on a desk',
        order: 1,
      },
      {
        url: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg',
        altText: 'Person holding smartphone in hand',
        order: 2,
      },
    ],
  },
  {
    name: 'Stainless Steel Chef Knife',
    slug: 'stainless-steel-chef-knife',
    description:
      '8-inch high carbon stainless steel chef knife with ergonomic handle for professional and home cooks.',
    price: 39.99,
    sku: 'HOME-KNIFE-8IN-001',
    categorySlug: 'home-kitchen',
    stock: 40,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/952478/pexels-photo-952478.jpeg',
        altText: 'Chef knife on a cutting board with vegetables',
        order: 1,
      },
    ],
  },
  {
    name: 'Non-Stick Frying Pan 12"',
    slug: 'non-stick-frying-pan-12',
    description:
      'Durable non-stick 12-inch frying pan suitable for all stovetops, including induction.',
    price: 49.5,
    sku: 'HOME-PAN-12-001',
    categorySlug: 'home-kitchen',
    stock: 30,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/4109951/pexels-photo-4109951.jpeg',
        altText: 'Non-stick frying pan on a stove',
        order: 1,
      },
    ],
  },
  {
    name: 'Bestselling Mystery Novel',
    slug: 'bestselling-mystery-novel',
    description:
      'A gripping mystery thriller that will keep you on the edge of your seat until the very last page.',
    price: 14.99,
    sku: 'BOOK-MYSTERY-001',
    categorySlug: 'books',
    stock: 60,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/46274/pexels-photo-46274.jpeg',
        altText: 'Open book on a wooden table',
        order: 1,
      },
    ],
  },
  {
    name: 'Productivity Guide Book',
    slug: 'productivity-guide-book',
    description:
      'A practical guide to improving your productivity, focus, and work-life balance.',
    price: 24.0,
    sku: 'BOOK-PRODUCTIVITY-001',
    categorySlug: 'books',
    stock: 45,
    isActive: true,
    images: [
      {
        url: 'https://images.pexels.com/photos/159621/books-book-pages-read-literature-159621.jpeg',
        altText: 'Stack of books on a table',
        order: 1,
      },
    ],
  },
];

const getAdminCredentials = (): { email: string; password: string } => {
  const email = process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password =
    process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Admin email or password is not set in environment variables.');
  }

  return { email, password };
};

const createAdminUser = async (): Promise<void> => {
  const { email, password } = getAdminCredentials();

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const data: Prisma.UserCreateInput = {
    email,
    passwordHash: hashedPassword,
    name: 'Administrator',
    role: 'ADMIN',
    isActive: true,
  };

  await prisma.user.create({ data });
};

const seedCategories = async (): Promise<Map<string, number>> => {
  const slugToId = new Map<string, number>();

  for (const category of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
    });

    if (existing) {
      slugToId.set(category.slug, existing.id);
      continue;
    }

    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        isActive: true,
      },
    });

    slugToId.set(category.slug, created.id);
  }

  return slugToId;
};

const seedProducts = async (categorySlugToId: Map<string, number>): Promise<void> => {
  for (const product of products) {
    const categoryId = categorySlugToId.get(product.categorySlug);
    if (!categoryId) {
      // Skip product if category does not exist; this indicates a configuration issue
      // but we avoid throwing to let other data seed
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping product "undefined" because category "undefined" was not found.`,
      );
      continue;
    }

    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });

    if (existing) {
      continue;
    }

    await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: new Prisma.Decimal(product.price),
        sku: product.sku,
        isActive: product.isActive ?? true,
        category: {
          connect: { id: categoryId },
        },
        stockItems: {
          create: {
            quantity: product.stock,
            reserved: 0,
            location: 'MAIN',
          },
        },
        images: {
          create: product.images.map((img) => ({
            url: img.url,
            altText: img.altText,
            order: img.order,
            isPrimary: img.order === 1,
          })),
        },
      },
    });
  }
};

const main = async (): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('Seeding database...');

  try {
    const categorySlugToId = await seedCategories();
    await seedProducts(categorySlugToId);
    await createAdminUser();

    // eslint-disable-next-line no-console
    console.log('Seeding completed successfully.');
  } catch (error) {
    // eslint-disable