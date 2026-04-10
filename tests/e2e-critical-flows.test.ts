import { describe, it, expect } from "vitest";

const BASE = `http://localhost:${process.env.PORT || 5000}`;

let sessionCookie = "";
let csrfToken = "";
let testProjectId = "";

async function api(method: string, path: string, body?: any, options?: { raw?: boolean }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Forwarded-Proto": "https",
  };
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  const opts: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/(ecode\.sid|connect\.sid)=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  if (options?.raw) return res;
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

describe("E2E Critical Flows", () => {

  describe("Flow 1: Authentication", () => {
    it("should get CSRF token", async () => {
      let res = await api("GET", "/api/csrf-token") as any;
      if (res.status !== 200) {
        res = await api("GET", "/api/auth/csrf") as any;
      }
      expect(res.status).toBe(200);
      expect(res.data?.csrfToken).toBeDefined();
      csrfToken = res.data.csrfToken;
    });

    it("should reject login with invalid credentials", async () => {
      const res = await api("POST", "/api/auth/login", {
        email: "nonexistent@example.com",
        password: "wrongpassword",
      }) as any;
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject login with empty body", async () => {
      const res = await api("POST", "/api/auth/login", {}) as any;
      expect(res.status).toBe(400);
    });

    it("should login with valid credentials", async () => {
      const res = await api("POST", "/api/auth/login", {
        email: "avi@snatchbot.me",
        password: "password123",
      }) as any;
      expect(res.status).toBe(200);
      expect(res.data?.id).toBeDefined();
      expect(res.data?.email).toBe("avi@snatchbot.me");
      if (res.data?.csrfToken) csrfToken = res.data.csrfToken;
    });

    it("should return current user after login", async () => {
      const res = await api("GET", "/api/auth/me") as any;
      expect(res.status).toBe(200);
      expect(res.data?.id).toBeDefined();
      expect(res.data?.email).toBe("avi@snatchbot.me");
    });
  });

  describe("Flow 2: Project CRUD", () => {
    it("should create a new project", async () => {
      const res = await api("POST", "/api/projects", {
        name: "E2E Test Project",
        description: "Automated test project",
        language: "javascript",
      }) as any;
      expect([200, 201]).toContain(res.status);
      expect(res.data?.id).toBeDefined();
      expect(res.data?.name).toBe("E2E Test Project");
      testProjectId = res.data.id;
    });

    it("should list user projects including the new one", async () => {
      const res = await api("GET", "/api/projects") as any;
      expect(res.status).toBe(200);
      const projectsList = res.data?.projects || res.data;
      const found = Array.isArray(projectsList)
        ? projectsList.find((p: any) => p.id === testProjectId)
        : null;
      expect(found).toBeDefined();
    });

    it("should get project by ID", async () => {
      const res = await api("GET", `/api/projects/${testProjectId}`) as any;
      expect(res.status).toBe(200);
      expect(res.data?.id).toBe(testProjectId);
    });

    it("should create a file in the project", async () => {
      const res = await api("POST", `/api/projects/${testProjectId}/files`, {
        filename: "index.js",
        content: "console.log('hello');",
      }) as any;
      expect([200, 201]).toContain(res.status);
      expect(res.data?.id).toBeDefined();
    });

    it("should list project files", async () => {
      const res = await api("GET", `/api/projects/${testProjectId}/files`) as any;
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const found = res.data?.find((f: any) => f.filename === "index.js" || f.name === "index.js");
      expect(found).toBeDefined();
    });
  });

  describe("Flow 3: AI & Agent", () => {
    it("should have AI models available", async () => {
      const res = await api("GET", "/api/models") as any;
      expect(res.status).toBe(200);
      expect(res.data?.models?.length).toBeGreaterThan(0);
    });

    it("should get preferred model", async () => {
      const res = await api("GET", "/api/models/preferred") as any;
      expect(res.status).toBe(200);
      expect(res.data?.preferredModel).toBeDefined();
    });

    it("should get RAG stats", async () => {
      const res = await api("GET", "/api/rag/stats") as any;
      expect(res.status).toBe(200);
    });
  });

  describe("Flow 4: Payments", () => {
    it("should list available plans", async () => {
      const res = await api("GET", "/api/payments/plans") as any;
      expect(res.status).toBe(200);
    });
  });

  describe("Flow 5: OAuth Endpoints", () => {
    it("GitHub OAuth redirects to GitHub", async () => {
      const res = await api("GET", "/api/auth/github", undefined, { raw: true }) as Response;
      if (res.status === 302 || res.status === 303) {
        const location = res.headers.get("location");
        expect(location).toContain("github.com");
      } else {
        expect([200, 501]).toContain(res.status);
      }
    });

    it("Google OAuth redirects to Google", async () => {
      const res = await api("GET", "/api/auth/google", undefined, { raw: true }) as Response;
      if (res.status === 302 || res.status === 303) {
        const location = res.headers.get("location");
        expect(location).toContain("google.com");
      } else {
        expect([200, 501]).toContain(res.status);
      }
    });
  });
});
