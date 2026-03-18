import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer
const mockSendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

describe("email", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isEmailConfigured", () => {
    it("returns false when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      const { isEmailConfigured } = await import("../server/email");
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true when all SMTP vars are set", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "password123";
      const { isEmailConfigured } = await import("../server/email");
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("generates correct reset URL", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "password123";
      process.env.APP_URL = "https://app.test.com";
      mockSendMail.mockResolvedValue({});

      const { sendPasswordResetEmail } = await import("../server/email");
      await sendPasswordResetEmail("user@example.com", "reset-token-123");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("Reset"),
          html: expect.stringContaining("reset-token-123"),
        })
      );
    });
  });

  describe("sendVerificationEmail", () => {
    it("includes verification URL in email", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "password123";
      process.env.APP_URL = "https://app.test.com";
      mockSendMail.mockResolvedValue({});

      const { sendVerificationEmail } = await import("../server/email");
      const result = await sendVerificationEmail("user@example.com", "verify-token-456");

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("verify-token-456"),
        })
      );
    });
  });

  describe("sendTeamInviteEmail", () => {
    it("includes team name and inviter in email", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "password123";
      mockSendMail.mockResolvedValue({});

      const { sendTeamInviteEmail } = await import("../server/email");
      await sendTeamInviteEmail("new@example.com", "My Team", "John Doe", "invite-token-789");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "new@example.com",
          subject: expect.stringContaining("My Team"),
          html: expect.stringContaining("John Doe"),
        })
      );
    });
  });

  describe("email error handling", () => {
    it("returns false when sending fails", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "password123";
      mockSendMail.mockRejectedValue(new Error("Connection refused"));

      const { sendPasswordResetEmail } = await import("../server/email");
      const result = await sendPasswordResetEmail("user@example.com", "token");
      expect(result).toBe(false);
    });

    it("returns false when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      const { sendPasswordResetEmail } = await import("../server/email");
      const result = await sendPasswordResetEmail("user@example.com", "token");
      expect(result).toBe(false);
    });
  });
});
