import { describe, it, expect, beforeAll } from "vitest";

const BASE = `http://localhost:${process.env.PORT || 5000}`;

async function api(method: string, path: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

describe("Auth endpoints", () => {
  it("POST /api/auth/login with missing fields returns 400", async () => {
    const { status, data } = await api("POST", "/api/auth/login", {});
    expect(status).toBe(400);
    expect(data?.message).toBeDefined();
  });

  it("POST /api/auth/login with bad credentials returns 401", async () => {
    const { status, data } = await api("POST", "/api/auth/login", {
      email: "nonexistent@test.com",
      password: "wrongpassword",
    });
    expect(status).toBe(401);
    expect(data?.message).toContain("Invalid");
  });

  it("GET /api/auth/me without session returns 401", async () => {
    const { status } = await api("GET", "/api/auth/me");
    expect(status).toBe(401);
  });

  it("GET /api/health returns healthy status", async () => {
    const { status, data } = await api("GET", "/api/health");
    expect(status).toBe(200);
    expect(data?.status).toBe("healthy");
    expect(data?.uptime).toBeGreaterThan(0);
  });

  it("GET /api/csrf-token returns a token", async () => {
    const { status, data } = await api("GET", "/api/csrf-token");
    expect(status).toBe(200);
    expect(data?.csrfToken).toBeDefined();
    expect(typeof data.csrfToken).toBe("string");
    expect(data.csrfToken.length).toBeGreaterThan(20);
  });
});

describe("Protected endpoints require auth", () => {
  it("GET /api/projects without auth returns empty or 401", async () => {
    const { status, data } = await api("GET", "/api/projects");
    expect([200, 401]).toContain(status);
  });

  it("GET /api/user/export without auth returns 401", async () => {
    const { status } = await api("GET", "/api/user/export");
    expect(status).toBe(401);
  });

  it("GET /api/admin/users without auth returns 401 or 403", async () => {
    const { status } = await api("GET", "/api/admin/users");
    expect([401, 403]).toContain(status);
  });
});

describe("Preview access control", () => {
  it("GET /api/preview/nonexistent-id/ returns 404", async () => {
    const res = await fetch(`${BASE}/api/preview/nonexistent-project-id/`);
    expect(res.status).toBe(404);
  });
});
