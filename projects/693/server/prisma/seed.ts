import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

const categoriesData: Prisma.CategoryCreateInput[] = [
  {
    name: 'Books',
    slug: 'books',
    description: 'Fiction, non-fiction, and educational books.',
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Gadgets, devices, and electronic accessories.',
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Home appliances, kitchen tools, and decor.',
  },
  {
    name: 'Clothing',
    slug: 'clothing',
    description: 'Men and women clothing and accessories.',
  },
];

const productsData: (Prisma.ProductCreateInput & { initialStock: number })[] = [
  {
    name: 'The Pragmatic Programmer',
    slug: 'the-pragmatic-programmer',
    description:
      'A classic book on software engineering and best practices for modern developers.',
    price: 3999,
    currency: 'USD',
    initialStock: 25,
    category: {
      connect: { slug: 'books' },
    },
    images: {
      create: [
        {
          url: 'https://images.example.com/products/pragmatic-programmer/main.jpg',
          altText: 'Cover of The Pragmatic Programmer book',
          isPrimary: true,
        },
        {
          url: 'https://images.example.com/products/pragmatic-programmer/back.jpg',
          altText: 'Back cover of The Pragmatic Programmer book',
          isPrimary: false,
        },
      ],
    },
  },
  {
    name: 'Noise Cancelling Headphones',
    slug: 'noise-cancelling-headphones',
    description:
      'Wireless over-ear headphones with active noise cancellation and 30-hour battery life.',
    price: 12999,
    currency: 'USD',
    initialStock: 40,
    category: {
      connect: { slug: 'electronics' },
    },
    images: {
      create: [
        {
          url: 'https://images.example.com/products/headphones/main.jpg',
          altText: 'Black wireless noise cancelling headphones',
          isPrimary: true,
        },
        {
          url: 'https://images.example.com/products/headphones/side.jpg',
          altText: 'Side view of black wireless headphones',
          isPrimary: false,
        },
      ],
    },
  },
  {
    name: 'Stainless Steel Chef Knife',
    slug: 'stainless-steel-chef-knife',
    description:
      '8-inch professional chef knife made from high-carbon stainless steel with ergonomic handle.',
    price: 4999,
    currency: 'USD',
    initialStock: 50,
    category: {
      connect: { slug: 'home-kitchen' },
    },
    images: {
      create: [
        {
          url: 'https://images.example.com/products/chef-knife/main.jpg',
          altText: '8-inch stainless steel chef knife',
          isPrimary: true,
        },
      ],
    },
  },
  {
    name: 'Unisex Cotton T-Shirt',
    slug: 'unisex-cotton-tshirt',
    description:
      'Soft 100% cotton unisex t-shirt available in multiple colors and sizes.',
    price: 1999,
    currency: 'USD',
    initialStock: 100,
    category: {
      connect: { slug: 'clothing' },
    },
    images: {
      create: [
        {
          url: 'https://images.example.com/products/cotton-tshirt/main.jpg',
          altText: 'Plain unisex cotton t-shirt on hanger',
          isPrimary: true,
        },
      ],
    },
  },
];

async function seedUser(): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
  });

  if (existingUser) {
    return;
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, saltRounds);

  await prisma.user.create({
    data: {
      email: TEST_USER_EMAIL,
      name: 'Test User',
      passwordHash,
      role: 'USER',
      isActive: true,
    },
  });
}

async function seedCategories(): Promise<void> {
  for (const category of categoriesData) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: category,
    });
  }
}

async function seedProducts(): Promise<void> {
  for (const product of productsData) {
    const { initialStock, ...productData } = product;

    const createdProduct = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {
        name: productData.name,
        description: productData.description,
        price: productData.price,
        currency: productData.currency,
        category: productData.category,
      },
      create: {
        ...productData,
      },
      include: {
        inventory: true,
      },
    });

    if (!createdProduct.inventory) {
      await prisma.inventory.create({
        data: {
          productId: createdProduct.id,
          quantity: initialStock,
        },
      });
    } else {
      await prisma.inventory.update({
        where: { id: createdProduct.inventory.id },
        data: { quantity: initialStock },
      });
    }
  }
}

async function main(): Promise<void> {
  await seedCategories();
  await seedProducts();
  await seedUser();
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });