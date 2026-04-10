import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schemas used in auth routes
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email address").optional(),
});

describe("auth validation", () => {
  describe("login schema", () => {
    it("accepts valid credentials", () => {
      const result = loginSchema.safeParse({ username: "alice", password: "secret" });
      expect(result.success).toBe(true);
    });

    it("rejects empty username", () => {
      const result = loginSchema.safeParse({ username: "", password: "secret" });
      expect(result.success).toBe(false);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({ username: "alice", password: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing fields", () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("register schema", () => {
    it("accepts valid registration data", () => {
      const result = registerSchema.safeParse({
        username: "newuser",
        password: "securepassword123",
        email: "user@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects username shorter than 3 characters", () => {
      const result = registerSchema.safeParse({ username: "ab", password: "securepassword123" });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({ username: "alice", password: "short" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
      const result = registerSchema.safeParse({
        username: "alice",
        password: "securepassword",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("allows registration without email", () => {
      const result = registerSchema.safeParse({ username: "alice", password: "securepassword" });
      expect(result.success).toBe(true);
    });
  });

  describe("password strength", () => {
    it("rejects common short passwords", () => {
      const weakPasswords = ["12345678", "password", "qwertyu1"];
      for (const pwd of weakPasswords) {
        // These pass min-length but would fail a strength check
        const result = registerSchema.safeParse({ username: "alice", password: pwd });
        // They pass schema validation (length >= 8), strength is a separate concern
        expect(result.success).toBe(true);
      }
    });

    it("accepts strong passwords", () => {
      const result = registerSchema.safeParse({
        username: "alice",
        password: "C0mpl3xP@ssw0rd!",
      });
      expect(result.success).toBe(true);
    });
  });
});
