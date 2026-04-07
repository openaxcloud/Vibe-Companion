import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { Product } from "../src/models/Product";

const JWT_SECRET = process.env.JWT_SECRET || "test_secret";

interface TestUserPayload {
  id: string;
  role: "user" | "admin";
}

const generateToken = (payload: TestUserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
};

const adminToken = generateToken({ id: "admin-id-1", role: "admin" });
const userToken = generateToken({ id: "user-id-1", role: "user" });

describe("Product API", () => {
  beforeAll(async () => {
    await Product.deleteMany({});
    await Product.insertMany([
      {
        name: "Apple iPhone 15",
        description: "Latest Apple smartphone",
        price: 999,
        category: "Electronics",
        tags: ["phone", "apple", "smartphone"],
        stock: 10
      },
      {
        name: "Samsung Galaxy S23",
        description: "Latest Samsung smartphone",
        price: 899,
        category: "Electronics",
        tags: ["phone", "samsung", "android"],
        stock: 15
      },
      {
        name: "Dell XPS 15",
        description: "High performance laptop",
        price: 1499,
        category: "Computers",
        tags: ["laptop", "dell"],
        stock: 5
      },
      {
        name: "Apple MacBook Pro 14",
        description: "Apple laptop",
        price: 1999,
        category: "Computers",
        tags: ["laptop", "apple"],
        stock: 7
      },
      {
        name: "Sony WH-1000XM5",
        description: "Noise cancelling headphones",
        price: 349,
        category: "Audio",
        tags: ["headphones", "sony"],
        stock: 20
      }
    ]);
  });

  afterAll(async () => {
    await Product.deleteMany({});
  });

  describe("GET /api/products", () => {
    it("returns paginated product list with default values", async () => {
      const res = await request(app).get("/api/products").expect(200);

      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 5,
        pages: 1
      });
      expect(res.body.data.length).toBe(5);
    });

    it("applies custom pagination parameters", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(res.body.pagination).toMatchObject({
        page: 2,
        limit: 2,
        total: 5,
        pages: 3
      });
      expect(res.body.data.length).toBe(2);
    });

    it("returns empty data for out-of-range pages", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ page: 10, limit: 5 })
        .expect(200);

      expect(res.body.pagination).toMatchObject({
        page: 10,
        limit: 5,
        total: 5,
        pages: 1
      });
      expect(res.body.data.length).toBe(0);
    });

    it("supports search by name substring (case-insensitive)", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ search: "apple" })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      const names: string[] = res.body.data.map((p: any) =>
        String(p.name).toLowerCase()
      );
      names.forEach((name) => {
        expect(name.includes("apple")).toBe(true);
      });
    });

    it("supports filter by category", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ category: "Computers" })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p: any) => {
        expect(p.category).toBe("Computers");
      });
    });

    it("supports minPrice and maxPrice filter", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ minPrice: 900, maxPrice: 1600 })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p: any) => {
        expect(p.price).toBeGreaterThanOrEqual(900);
        expect(p.price).toBeLessThanOrEqual(1600);
      });
    });

    it("combines search and category filters", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ search: "apple", category: "Computers" })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p: any) => {
        expect(p.category).toBe("Computers");
        expect(String(p.name).toLowerCase().includes("apple")).toBe(true);
      });
    });

    it("returns 400 for invalid pagination parameters", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ page: -1, limit: 0 })
        .expect(400);

      expect(res.body).toHaveProperty("error");
      expect(typeof res.body.error).toBe("string");
    });
  });

  describe("POST /api/products", () => {
    const validProductPayload = {
      name: "Test Product",
      description: "Test description",
      price: 123.45,
      category: "Test Category",
      tags: ["tag1", "tag2"],
      stock: 3
    };

    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/products")
        .send(validProductPayload)
        .expect(401);

      expect(res.body).toHaveProperty("error");
    });

    it("rejects non-admin users", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer undefined`)
        .send(validProductPayload)
        .expect(403);

      expect(res.body).toHaveProperty("error");
    });

    it("creates product with admin auth", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer undefined`)
        .send(validProductPayload)
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe(validProductPayload.name);
      expect(res.body.price).toBe(validProductPayload.price);
      const created = await Product.findById(res.body.id).lean();
      expect(created).not.toBeNull();
      expect(created?.name).toBe(validProductPayload.name);
    });

    it("validates required fields", async () => {
      const { name, ...missingNamePayload } = validProductPayload;

      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer undefined`)
        .send(missingNamePayload)
        .expect(400);

      expect(res.body).toHaveProperty("error");
    });

    it("validates numeric constraints", async () => {
      const invalidPayload = {
        ...validProductPayload,
        price: -10,
        stock: -1
      };

      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer undefined`)
        .send(invalidPayload)
        .expect(400);

      expect(res.body).toHaveProperty("error");
    });
  });
});