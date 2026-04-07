import request, { SuperTest, Test } from "supertest";
import http from "http";
import { AddressInfo } from "net";
import { beforeAll, afterAll, describe, it, expect } from "@jest/globals";
import app from "../src/app";
import { prisma } from "../src/db/client";

let server: http.Server;
let baseUrl: string;
let agent: SuperTest<Test>;

const TEST_USER = {
  email: "testuser@example.com",
  password: "StrongPassw0rd!",
  name: "Test User",
};

describe("Auth Flow", () => {
  beforeAll(async () => {
    if (prisma && prisma.$connect) {
      await prisma.$connect();
    }
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:undefined`;
    agent = request(baseUrl);
    if (prisma && prisma.user) {
      await prisma.user.deleteMany({});
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    if (prisma && prisma.$disconnect) {
      await prisma.$disconnect();
    }
  });

  it("registers a new user and sets auth cookie", async () => {
    const res = await agent
      .post("/auth/register")
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      })
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.name).toBe(TEST_USER.name);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie)).toBe(true);
    const hasTokenCookie =
      Array.isArray(setCookie) &&
      setCookie.some((cookie: string) => cookie.toLowerCase().startsWith("token="));
    expect(hasTokenCookie).toBe(true);
  });

  it("logs in an existing user and sets auth cookie", async () => {
    const res = await agent
      .post("/auth/login")
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password,
      })
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_USER.email);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie)).toBe(true);
    const hasTokenCookie =
      Array.isArray(setCookie) &&
      setCookie.some((cookie: string) => cookie.toLowerCase().startsWith("token="));
    expect(hasTokenCookie).toBe(true);
  });

  it("returns current user on /me with auth cookie", async () => {
    const loginRes = await agent
      .post("/auth/login")
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password,
      })
      .expect(200);

    const setCookie = loginRes.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie)).toBe(true);

    const tokenCookie =
      Array.isArray(setCookie) &&
      setCookie.find((cookie: string) => cookie.toLowerCase().startsWith("token="));
    expect(tokenCookie).toBeDefined();

    const meRes = await agent.get("/auth/me").set("Cookie", tokenCookie as string).expect(200);

    expect(meRes.body).toBeDefined();
    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.email).toBe(TEST_USER.email);
    expect(meRes.body.user.name).toBe(TEST_USER.name);
  });

  it("rejects /me without auth cookie", async () => {
    await agent.get("/auth/me").expect(401);
  });
});