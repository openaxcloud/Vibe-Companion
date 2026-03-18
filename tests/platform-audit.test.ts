import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

/**
 * Platform production readiness audit tests.
 * These verify configuration, security, and best practices
 * across the entire platform before going live.
 */
describe("Platform Production Readiness", () => {
  describe("Security Configuration", () => {
    it("does not contain hardcoded secrets in .replit", () => {
      const replitConfig = readFileSync(resolve(ROOT, ".replit"), "utf-8");
      // Check for hardcoded encryption keys, API keys, passwords
      expect(replitConfig).not.toMatch(/ENCRYPTION_KEY\s*=\s*"[a-f0-9]{64}"/);
      expect(replitConfig).not.toMatch(/STRIPE_SECRET_KEY\s*=\s*"sk_/);
      expect(replitConfig).not.toMatch(/password\s*=\s*"/i);
    });

    it("does not contain hardcoded secrets in source code", () => {
      const filesToCheck = [
        "server/index.ts",
        "server/encryption.ts",
        "server/email.ts",
      ];
      for (const file of filesToCheck) {
        const path = resolve(ROOT, file);
        if (!existsSync(path)) continue;
        const content = readFileSync(path, "utf-8");
        expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
        expect(content).not.toMatch(/sk_test_[a-zA-Z0-9]{20,}/);
        expect(content).not.toMatch(/whsec_[a-zA-Z0-9]+/);
      }
    });

    it(".env.example exists and documents required variables", () => {
      const envExample = readFileSync(resolve(ROOT, ".env.example"), "utf-8");
      expect(envExample).toContain("DATABASE_URL");
      expect(envExample).toContain("SESSION_SECRET");
      expect(envExample).toContain("ENCRYPTION_KEY");
    });

    it(".gitignore exists and excludes sensitive files", () => {
      const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf-8");
      expect(gitignore).toContain("node_modules");
      expect(gitignore).toContain(".env");
    });
  });

  describe("Package Configuration", () => {
    let pkg: any;

    it("package.json is valid JSON", () => {
      const raw = readFileSync(resolve(ROOT, "package.json"), "utf-8");
      pkg = JSON.parse(raw);
      expect(pkg).toBeDefined();
    });

    it("has required scripts", () => {
      const raw = readFileSync(resolve(ROOT, "package.json"), "utf-8");
      pkg = JSON.parse(raw);
      expect(pkg.scripts).toHaveProperty("dev");
      expect(pkg.scripts).toHaveProperty("build");
      expect(pkg.scripts).toHaveProperty("start");
      expect(pkg.scripts).toHaveProperty("test");
      expect(pkg.scripts).toHaveProperty("check");
    });

    it("test script uses vitest", () => {
      const raw = readFileSync(resolve(ROOT, "package.json"), "utf-8");
      pkg = JSON.parse(raw);
      expect(pkg.scripts.test).toContain("vitest");
    });

    it("build script includes type checking", () => {
      const raw = readFileSync(resolve(ROOT, "package.json"), "utf-8");
      pkg = JSON.parse(raw);
      expect(pkg.scripts.build).toContain("tsc");
    });

    it("has critical dependencies", () => {
      const raw = readFileSync(resolve(ROOT, "package.json"), "utf-8");
      pkg = JSON.parse(raw);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(deps).toHaveProperty("express");
      expect(deps).toHaveProperty("react");
      expect(deps).toHaveProperty("drizzle-orm");
      expect(deps).toHaveProperty("helmet");
      expect(deps).toHaveProperty("cors");
      expect(deps).toHaveProperty("vitest");
      expect(deps).toHaveProperty("typescript");
    });
  });

  describe("Frontend Configuration", () => {
    it("index.html has proper meta tags for SEO", () => {
      const html = readFileSync(resolve(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain('meta name="description"');
      expect(html).toContain('meta name="viewport"');
      expect(html).toContain('meta property="og:title"');
      expect(html).toContain('meta property="og:description"');
      expect(html).toContain('meta property="og:image"');
      expect(html).toContain('meta name="twitter:card"');
    });

    it("index.html allows user scaling for accessibility", () => {
      const html = readFileSync(resolve(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain("user-scalable=yes");
      expect(html).not.toContain("user-scalable=no");
    });

    it("index.html has apple-mobile-web-app meta tags", () => {
      const html = readFileSync(resolve(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain("apple-mobile-web-app-capable");
    });

    it("index.html has dns-prefetch for external services", () => {
      const html = readFileSync(resolve(ROOT, "client/index.html"), "utf-8");
      expect(html).toContain("dns-prefetch");
    });

    it("CSS has reduced motion support", () => {
      const css = readFileSync(resolve(ROOT, "client/src/index.css"), "utf-8");
      expect(css).toContain("prefers-reduced-motion");
    });

    it("CSS has high contrast support", () => {
      const css = readFileSync(resolve(ROOT, "client/src/index.css"), "utf-8");
      expect(css).toContain("prefers-contrast");
    });

    it("CSS has print styles", () => {
      const css = readFileSync(resolve(ROOT, "client/src/index.css"), "utf-8");
      expect(css).toContain("@media print");
    });

    it("App has skip-to-main-content link for accessibility", () => {
      const app = readFileSync(resolve(ROOT, "client/src/App.tsx"), "utf-8");
      expect(app).toContain("skip-to-main");
    });
  });

  describe("Backend Configuration", () => {
    it("server has global error handlers", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("uncaughtException");
      expect(index).toContain("unhandledRejection");
    });

    it("server has health check endpoint", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("/api/health");
      expect(index).toContain("/api/ready");
    });

    it("server validates required environment variables", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("validateEnvironment");
      expect(index).toContain("DATABASE_URL");
      expect(index).toContain("SESSION_SECRET");
      expect(index).toContain("ENCRYPTION_KEY");
    });

    it("server has CORS configured", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("cors(");
      expect(index).toContain("credentials: true");
    });

    it("server has helmet security headers", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("helmet(");
      expect(index).toContain("contentSecurityPolicy");
      expect(index).toContain("hsts");
    });

    it("server has graceful shutdown handling", () => {
      const index = readFileSync(resolve(ROOT, "server/index.ts"), "utf-8");
      expect(index).toContain("SIGTERM");
      expect(index).toContain("SIGINT");
      expect(index).toContain("SIGHUP");
      expect(index).toContain("gracefulShutdown");
    });

    it("encryption module throws on decrypt failure instead of returning plaintext", () => {
      const enc = readFileSync(resolve(ROOT, "server/encryption.ts"), "utf-8");
      expect(enc).toContain('throw new Error("Failed to decrypt data');
      // Should NOT silently return ciphertext
      expect(enc).not.toMatch(/catch\s*\{[\s\n]*return ciphertext/);
    });
  });

  describe("Replit Compatibility", () => {
    it(".replit file exists and has correct deployment config", () => {
      const replit = readFileSync(resolve(ROOT, ".replit"), "utf-8");
      expect(replit).toContain("[deployment]");
      expect(replit).toContain("autoscale");
      expect(replit).toContain("npm");
    });

    it(".replit does not contain hardcoded encryption keys", () => {
      const replit = readFileSync(resolve(ROOT, ".replit"), "utf-8");
      expect(replit).not.toMatch(/ENCRYPTION_KEY\s*=\s*"[a-f0-9]{32,}"/);
    });

    it(".replit has correct port configuration", () => {
      const replit = readFileSync(resolve(ROOT, ".replit"), "utf-8");
      expect(replit).toContain("localPort = 5000");
      expect(replit).toContain("externalPort = 80");
    });
  });

  describe("Database Configuration", () => {
    it("drizzle config exists", () => {
      expect(existsSync(resolve(ROOT, "drizzle.config.ts"))).toBe(true);
    });

    it("schema file exists", () => {
      expect(existsSync(resolve(ROOT, "shared/schema.ts"))).toBe(true);
    });

    it("migrations directory exists", () => {
      expect(existsSync(resolve(ROOT, "migrations"))).toBe(true);
    });
  });

  describe("TypeScript Configuration", () => {
    it("tsconfig.json exists and has strict mode", () => {
      const raw = readFileSync(resolve(ROOT, "tsconfig.json"), "utf-8");
      const config = JSON.parse(raw);
      expect(config.compilerOptions.strict).toBe(true);
    });

    it("vitest.config.ts exists", () => {
      expect(existsSync(resolve(ROOT, "vitest.config.ts"))).toBe(true);
    });
  });
});
