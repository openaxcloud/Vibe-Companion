import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

type SeedProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  variants: Array<{
    sku: string;
    name: string;
    attributes?: Prisma.JsonValue;
    stock: number;
  }>;
};

const sampleProducts: SeedProductInput[] = [
  {
    sku: 'TSHIRT-BASIC',
    name: 'Basic T-Shirt',
    description: 'Classic unisex basic t-shirt, 100% cotton.',
    price: 1999,
    currency: 'USD',
    variants: [
      {
        sku: 'TSHIRT-BASIC-BLK-M',
        name: 'Basic T-Shirt Black / M',
        attributes: { color: 'Black', size: 'M' },
        stock: 50,
      },
      {
        sku: 'TSHIRT-BASIC-BLK-L',
        name: 'Basic T-Shirt Black / L',
        attributes: { color: 'Black', size: 'L' },
        stock: 35,
      },
      {
        sku: 'TSHIRT-BASIC-WHT-M',
        name: 'Basic T-Shirt White / M',
        attributes: { color: 'White', size: 'M' },
        stock: 40,
      },
    ],
  },
  {
    sku: 'MUG-CLASSIC',
    name: 'Classic Mug',
    description: 'Ceramic mug suitable for hot and cold drinks.',
    price: 1299,
    currency: 'USD',
    variants: [
      {
        sku: 'MUG-CLASSIC-300',
        name: 'Classic Mug 300ml',
        attributes: { volumeMl: 300, color: 'White' },
        stock: 80,
      },
      {
        sku: 'MUG-CLASSIC-450',
        name: 'Classic Mug 450ml',
        attributes: { volumeMl: 450, color: 'Black' },
        stock: 60,
      },
    ],
  },
  {
    sku: 'HOODIE-ZIP',
    name: 'Zip Hoodie',
    description: 'Comfortable zip hoodie with front pockets.',
    price: 4999,
    currency: 'USD',
    variants: [
      {
        sku: 'HOODIE-ZIP-GRY-M',
        name: 'Zip Hoodie Grey / M',
        attributes: { color: 'Grey', size: 'M' },
        stock: 20,
      },
      {
        sku: 'HOODIE-ZIP-GRY-XL',
        name: 'Zip Hoodie Grey / XL',
        attributes: { color: 'Grey', size: 'XL' },
        stock: 15,
      },
    ],
  },
];

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function seedAdminUser(): Promise<void> {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
}

async function seedProducts(): Promise<void> {
  for (const product of sampleProducts) {
    const existingProduct = await prisma.product.findUnique({
      where: { sku: product.sku },
    });

    let productRecord;
    if (existingProduct) {
      productRecord = existingProduct;
    } else {
      productRecord = await prisma.product.create({
        data: {
          sku: product.sku,
          name: product.name,
          description: product.description ?? null,
          price: product.price,
          currency: product.currency,
          isActive: true,
        },
      });
    }

    for (const variant of product.variants) {
      const existingVariant = await prisma.productVariant.findUnique({
        where: { sku: variant.sku },
      });

      let variantRecord;
      if (existingVariant) {
        variantRecord = existingVariant;
      } else {
        variantRecord = await prisma.productVariant.create({
          data: {
            sku: variant.sku,
            name: variant.name,
            attributes: variant.attributes ?? {},
            productId: productRecord.id,
            isActive: true,
          },
        });
      }

      const existingStock = await prisma.stock.findFirst({
        where: { variantId: variantRecord.id },
      });

      if (!existingStock) {
        await prisma.stock.create({
          data: {
            variantId: variantRecord.id,
            quantity: variant.stock,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await seedAdminUser();
  await seedProducts();
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