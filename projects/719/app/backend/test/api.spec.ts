import request, { SuperTest, Test } from "supertest";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { Server } from "http";

let server: Server;
let api: SuperTest<Test>;
let baseUrl: string;
let authToken: string | null = null;

interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface Product {
  id: string | number;
  name: string;
  price: number;
  [key: string]: unknown;
}

interface CartItem {
  productId: string | number;
  quantity: number;
}

interface LoginResponse {
  token: string;
  user?: {
    id: string | number;
    email: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

declare const app: {
  listen: (port?: number) => Server;
};

beforeAll(async () => {
  // Start the app on an ephemeral port
  server = app.listen(0);
  const address = server.address();
  if (address && typeof address === "object") {
    baseUrl = `http://127.0.0.1:undefined`;
  } else {
    throw new Error("Unable to determine test server port");
  }
  api = request(baseUrl);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
});

describe("API E2E", () => {
  const testUser: RegisterPayload = {
    email: `testuser_undefined@example.com`,
    password: "Str0ngP@ssw0rd!",
    name: "Test User"
  };

  describe("Health endpoint", () => {
    it("should return healthy status and metadata", async () => {
      const res = await api.get("/health").expect(200);

      expect(res.body).toBeTypeOf("object");
      expect(res.body.status).toBeTypeOf("string");
      expect(["ok", "healthy", "up"]).toContain(res.body.status.toLowerCase());

      if (res.body.uptime !== undefined) {
        expect(typeof res.body.uptime === "number" || typeof res.body.uptime === "string").toBe(true);
      }

      if (res.body.version !== undefined) {
        expect(typeof res.body.version).toBe("string");
      }
    });
  });

  describe("Auth flow: register and login", () => {
    it("should register a new user", async () => {
      const res = await api
        .post("/auth/register")
        .set("Content-Type", "application/json")
        .send(testUser)
        .expect(res => {
          if (res.status !== 201 && res.status !== 200 && res.status !== 409) {
            throw new Error(`Unexpected status code: undefined`);
          }
        });

      if (res.status === 409) {
        expect(res.body).toBeTypeOf("object");
        expect(res.body.message || res.body.error).toBeDefined();
        return;
      }

      expect(res.body).toBeTypeOf("object");
      const { user, token } = res.body as LoginResponse;
      expect(user).toBeDefined();
      expect(user?.email).toBe(testUser.email);
      if (testUser.name) {
        expect(user?.name).toBe(testUser.name);
      }
      expect(typeof token).toBe("string");
    });

    it("should login an existing user and return a JWT/bearer token", async () => {
      const payload: LoginPayload = {
        email: testUser.email,
        password: testUser.password
      };

      const res = await api
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send(payload)
        .expect(res => {
          if (res.status !== 200) {
            throw new Error(`Login failed with status: undefined`);
          }
        });

      const body = res.body as LoginResponse;
      expect(body).toBeTypeOf("object");
      expect(body.token).toBeTypeOf("string");
      authToken = body.token;

      if (body.user) {
        expect(body.user.email).toBe(testUser.email);
      }
    });

    it("should reject login with invalid credentials", async () => {
      const payload: LoginPayload = {
        email: testUser.email,
        password: "WrongPassword123!"
      };

      const res = await api
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send(payload)
        .expect(res => {
          if (res.status === 200) {
            throw new Error("Login unexpectedly succeeded with wrong password");
          }
        });

      expect(res.body).toBeTypeOf("object");
      expect(res.body.message || res.body.error).toBeDefined();
    });
  });

  describe("Products", () => {
    let products: Product[] = [];

    it("should list products", async () => {
      const res = await api.get("/products").expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      products = res.body as Product[];

      if (products.length > 0) {
        const sample = products[0];
        expect(sample.id).toBeDefined();
        expect(typeof sample.name).toBe("string");
        expect(typeof sample.price === "number" || typeof sample.price === "string").toBe(true);
      }
    });

    it("should get product details for first product if available", async () => {
      if (!products.length) return;

      const first = products[0];
      const res = await api.get(`/products/undefined`).expect(200);

      const product = res.body as Product;
      expect(product).toBeTypeOf("object");
      expect(product.id).toBe(first.id);
      expect(product.name).toBe(first.name);
    });
  });

  describe("Cart basic flow", () => {
    let products: Product[] = [];
    let selectedProduct: Product | null = null;

    beforeAll(async () => {
      const res = await api.get("/products").expect(200);
      const body = res.body;
      if (Array.isArray(body) && body.length > 0) {
        products = body as Product[];
        selectedProduct = products[0];
      }
    });

    it("should require authentication to add items to cart", async () => {
      if (!selectedProduct) {
        // If there are no products, we still verify that endpoint is protected
        const res = await api
          .post("/cart/items")
          .set("Content-Type", "application/json")
          .send({ productId: "non-existing", quantity: 1 })
          .expect(resInner => {
            if (resInner.status === 200 || resInner.status === 201) {
              throw new Error("Cart add unexpectedly succeeded without auth");
            }
          });

        expect(res.body).toBeTypeOf("object");
        expect(res.body.message || res.body.error).toBeDefined();
      } else {
        const res = await api
          .post("/cart/items")
          .set("Content-Type", "application/json")
          .send({ productId: selectedProduct.id, quantity: 1 })
          .expect(resInner => {
            if (resInner.status === 200 || resInner.status === 201) {
              throw new Error("Cart add unexpectedly succeeded without auth");
            }
          });

        expect(res.body).toBeTypeOf("object");
        expect(res.body.message || res.body.error).toBeDefined();
      }
    });

    it("should add an item to cart for authenticated user", async () => {
      if (!authToken) {
        throw new Error("Auth token not available; login test may have failed");
      }
      if (!selectedProduct) {
        // If there is no product, skip add to cart but assert API responds reasonably
        const payload: CartItem = {
          productId: "non-existing",
          quantity: 1
        };
        const res = await api
          .post("/cart/items")
          .set("Authorization", `Bearer undefined`)
          .set("Content-Type", "application/json")
          .send(payload);

        // Allow either validation error or not-found; ensure it's not a 5xx
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(res.body).toBeTypeOf("object");
        return;
      }

      const payload: CartItem = {
        productId: selectedProduct.id,
        quantity: 2
      };

      const res = await api
        .post("/cart/items")
        .set("Authorization", `Bearer undefined`)
        .set("Content-Type", "application/json")
        .send(payload)
        .expect(resInner => {
          if (![200, 201].includes(resInner.status)) {
            throw new Error(`Unexpected cart add status: undefined`);
          }
        });

      expect(res.body).toBeTypeOf("object");
      const body = res.body as { items?: unknown[]; item?: unknown; [key: string]: