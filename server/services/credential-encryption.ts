import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY or SESSION_SECRET environment variable is required for credential encryption');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptToken(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]).toString('base64');
  
  return {
    ciphertext: combined,
    iv: iv.toString('hex')
  };
}

export function decryptToken(ciphertext: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  
  const combined = Buffer.from(ciphertext, 'base64');
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function isEncryptionConfigured(): boolean {
  return !!(process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET);
}
