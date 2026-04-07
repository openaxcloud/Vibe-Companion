import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createLogger } from "../utils/logger";

const logger = createLogger("public-forms");
const router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(320),
  company: z.string().max(255).optional(),
  reason: z.string().max(64).optional(),
  message: z.string().min(1).max(10000),
  phone: z.string().max(50).optional(),
  pagePath: z.string().max(255).optional(),
  subject: z.string().max(255).optional(),
});

const salesContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(320),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  message: z.string().max(10000).optional(),
  companySize: z.string().max(64).optional(),
  useCase: z.string().max(255).optional(),
  subject: z.string().max(255).optional(),
  pagePath: z.string().max(255).optional(),
});

const newsletterSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().max(120).optional(),
});

router.post("/contact", async (req, res) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid form data", details: parsed.error.flatten() });
    }
    const { name, email, company, reason, message, subject } = parsed.data;

    const contactSubject = subject || (reason ? `${reason} inquiry` : "General Inquiry");
    const description = `From: ${name} <${email}>${company ? ` (${company})` : ""}\n\n${message}`;

    const [result] = await db.execute(sql`
      INSERT INTO customer_requests (type, subject, description, status, priority)
      VALUES (${"contact"}, ${contactSubject}, ${description}, ${"pending"}, ${"medium"})
      RETURNING id
    `);

    logger.info("Contact form submitted", { email, reason, requestId: (result as any)?.id });
    res.json({ success: true, message: "Your message has been received. We'll be in touch within 24 hours." });
  } catch (error) {
    logger.error("Contact form error", { error: String(error) });
    res.status(500).json({ error: "Failed to submit contact form. Please try again." });
  }
});

router.post("/contact/sales", async (req, res) => {
  try {
    const parsed = salesContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid form data", details: parsed.error.flatten() });
    }
    const { name, email, company, phone, message, companySize, useCase, subject } = parsed.data;

    const salesSubject = subject || "Enterprise Sales Inquiry";
    const description = [
      `From: ${name} <${email}>`,
      company ? `Company: ${company}` : null,
      companySize ? `Company Size: ${companySize}` : null,
      phone ? `Phone: ${phone}` : null,
      useCase ? `Use Case: ${useCase}` : null,
      message ? `\nMessage:\n${message}` : null,
    ].filter(Boolean).join("\n");

    const [result] = await db.execute(sql`
      INSERT INTO customer_requests (type, subject, description, status, priority)
      VALUES (${"sales"}, ${salesSubject}, ${description}, ${"pending"}, ${"high"})
      RETURNING id
    `);

    logger.info("Sales contact form submitted", { email, company, companySize, requestId: (result as any)?.id });
    res.json({ success: true, message: "Thank you! Our sales team will contact you within 24 hours." });
  } catch (error) {
    logger.error("Sales contact form error", { error: String(error) });
    res.status(500).json({ error: "Failed to submit. Please try again." });
  }
});

router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const parsed = newsletterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const { email } = parsed.data;

    const existing = await db.execute(sql`
      SELECT id, is_active FROM newsletter_subscribers WHERE email = ${email} LIMIT 1
    `);
    // postgres-js returns array directly; node-postgres returns { rows: [...] }
    const rows = Array.isArray(existing) ? existing : (existing as any).rows ?? [];

    if (rows.length > 0) {
      const row = rows[0] as any;
      if (!row.is_active) {
        await db.execute(sql`
          UPDATE newsletter_subscribers SET is_active = true, unsubscribed_at = NULL WHERE email = ${email}
        `);
        return res.json({ success: true, message: "Welcome back! You've been re-subscribed." });
      }
      return res.json({ success: true, message: "You're already subscribed!" });
    }

    await db.execute(sql`
      INSERT INTO newsletter_subscribers (email, is_active) VALUES (${email}, true)
    `);

    logger.info("Newsletter subscription", { email });
    res.json({ success: true, message: "You're subscribed! Welcome to the E-Code community." });
  } catch (error) {
    logger.error("Newsletter subscribe error", { error: String(error) });
    res.status(500).json({ error: "Failed to subscribe. Please try again." });
  }
});

router.post("/newsletter/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const existing = await db.execute(sql`
      SELECT id FROM newsletter_subscribers WHERE email = ${email} LIMIT 1
    `);
    const rows = Array.isArray(existing) ? existing : (existing as any).rows ?? [];

    if (rows.length === 0) {
      return res.status(404).json({ error: "Email not found in our subscriber list" });
    }

    await db.execute(sql`
      UPDATE newsletter_subscribers SET is_active = false, unsubscribed_at = NOW() WHERE email = ${email}
    `);

    logger.info("Newsletter unsubscription", { email });
    res.json({ success: true, message: "You've been successfully unsubscribed." });
  } catch (error) {
    logger.error("Newsletter unsubscribe error", { error: String(error) });
    res.status(500).json({ error: "Failed to unsubscribe. Please try again." });
  }
});

export default router;
