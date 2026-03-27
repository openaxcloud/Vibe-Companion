import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("encryption", () => {
  const originalEnv = { ...process.env };
  const VALID_KEY = "a".repeat(64); // 32 bytes in hex

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encrypt", () => {
    it("returns a string in iv:tag:encrypted format", async () => {
      const { encrypt } = await import("../server/encryption");
      const result = encrypt("hello world");
      const parts = result.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // IV: 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32); // Tag: 16 bytes = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", async () => {
      const { encrypt } = await import("../server/encryption");
      const a = encrypt("test");
      const b = encrypt("test");
      expect(a).not.toBe(b);
    });

    it("throws when ENCRYPTION_KEY is not set", async () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypt } = await import("../server/encryption");
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is not set");
    });

    it("throws when ENCRYPTION_KEY is wrong length", async () => {
      process.env.ENCRYPTION_KEY = "short";
      const { encrypt } = await import("../server/encryption");
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be 32 bytes");
    });
  });

  describe("decrypt", () => {
    it("correctly decrypts an encrypted value", async () => {
      const { encrypt, decrypt } = await import("../server/encryption");
      const encrypted = encrypt("secret data 123");
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe("secret data 123");
    });

    it("handles empty string encryption/decryption", async () => {
      const { encrypt, decrypt } = await import("../server/encryption");
      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("handles unicode and special characters", async () => {
      const { encrypt, decrypt } = await import("../server/encryption");
      const original = "Hello 🌍 café naïve résumé 日本語";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it("returns plaintext for non-encrypted strings (backward compatibility)", async () => {
      const { decrypt } = await import("../server/encryption");
      const plaintext = "just-a-regular-string";
      const result = decrypt(plaintext);
      expect(result).toBe(plaintext);
    });

    it("throws on corrupted encrypted data", async () => {
      const { encrypt, decrypt } = await import("../server/encryption");
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      // Corrupt the encrypted data
      parts[2] = "corrupted_data";
      const corrupted = parts.join(":");
      expect(() => decrypt(corrupted)).toThrow("Failed to decrypt data");
    });

    it("throws on wrong key", async () => {
      const { encrypt } = await import("../server/encryption");
      const encrypted = encrypt("test");

      // Reset modules and use a different key
      vi.resetModules();
      process.env.ENCRYPTION_KEY = "b".repeat(64);
      const { decrypt } = await import("../server/encryption");
      expect(() => decrypt(encrypted)).toThrow("Failed to decrypt data");
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted strings", async () => {
      const { encrypt, isEncrypted } = await import("../server/encryption");
      const encrypted = encrypt("test");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("returns false for plaintext strings", async () => {
      const { isEncrypted } = await import("../server/encryption");
      expect(isEncrypted("hello world")).toBe(false);
      expect(isEncrypted("just:two:parts")).toBe(false);
      expect(isEncrypted("")).toBe(false);
    });
  });

  describe("migrateToEncrypted", () => {
    it("encrypts plaintext values", async () => {
      const { migrateToEncrypted, decrypt } = await import("../server/encryption");
      const migrated = migrateToEncrypted("my-api-key");
      expect(migrated).not.toBe("my-api-key");
      expect(decrypt(migrated)).toBe("my-api-key");
    });

    it("does not double-encrypt already-encrypted values", async () => {
      const { encrypt, migrateToEncrypted } = await import("../server/encryption");
      const encrypted = encrypt("test");
      const migrated = migrateToEncrypted(encrypted);
      expect(migrated).toBe(encrypted);
    });
  });
});
