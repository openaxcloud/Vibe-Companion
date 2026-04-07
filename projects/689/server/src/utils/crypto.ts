import crypto from "crypto";
import bcrypt from "bcryptjs";

export interface PasswordHashOptions {
  /**
   * Number of bcrypt salt rounds.
   * Defaults to 12 which is a good balance between security and performance for most apps.
   */
  saltRounds?: number;
}

const DEFAULT_SALT_ROUNDS = 12;

/**
 * Generates a cryptographically secure random byte buffer.
 * @param length Number of bytes to generate.
 */
export const generateRandomBytes = (length: number): Buffer => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("length must be a positive integer");
  }
  return crypto.randomBytes(length);
};

/**
 * Generates a cryptographically secure random string encoded as hex.
 * @param length Number of bytes before encoding (resulting string length will be length * 2).
 */
export const generateRandomHex = (length: number): string => {
  return generateRandomBytes(length).toString("hex");
};

/**
 * Generates a cryptographically secure random string encoded as base64url.
 * Uses URL-safe base64 without padding.
 * @param length Number of bytes before encoding.
 */
export const generateRandomBase64Url = (length: number): string => {
  const bytes = generateRandomBytes(length);
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

/**
 * Hash a password using bcrypt.
 */
export const hashPassword = async (
  password: string,
  options: PasswordHashOptions = {}
): Promise<string> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password must be a non-empty string");
  }

  const saltRounds =
    typeof options.saltRounds === "number" && options.saltRounds > 0
      ? options.saltRounds
      : DEFAULT_SALT_ROUNDS;

  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare a plain text password to a bcrypt hash.
 */
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password must be a non-empty string");
  }
  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("hash must be a non-empty string");
  }

  return bcrypt.compare(password, hash);
};

/**
 * Timing-safe string comparison using crypto.timingSafeEqual.
 * Falls back to a manual constant-time comparison if lengths differ.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");

  if (aBuf.length !== bBuf.length) {
    let result = 0;
    const len = Math.max(aBuf.length, bBuf.length);
    for (let i = 0; i < len; i++) {
      const aVal = i < aBuf.length ? aBuf[i] : 0;
      const bVal = i < bBuf.length ? bBuf[i] : 0;
      result |= aVal ^ bVal;
    }
    return result === 0 && a === b;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
};

/**
 * Create a cryptographically secure token (hex-encoded).
 * @param byteLength Number of random bytes; resulting token length will be byteLength * 2.
 */
export const createSecureToken = (byteLength = 32): string => {
  return generateRandomHex(byteLength);
};

/**
 * Derive a key from a password using PBKDF2.
 */
export const deriveKeyFromPassword = async (
  password: string,
  salt: string | Buffer,
  iterations = 310000,
  keyLength = 32,
  digest: "sha256" | "sha512" = "sha256"
): Promise<Buffer> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password must be a non-empty string");
  }

  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, "utf8");

  return new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, saltBuf, iterations, keyLength, digest, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
};

/**
 * Compute an HMAC for a message using the given secret and algorithm.
 */
export const createHmac = (
  message: string,
  secret: string | Buffer,
  algorithm: "sha256" | "sha512" = "sha256",
  outputEncoding: crypto.HexBase64Latin1Encoding = "hex"
): string => {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(message, "utf8");
  return hmac.digest(outputEncoding);
};