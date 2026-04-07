import * as crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  private ivLength = 16;
  private tagLength = 16;
  private saltLength = 64;
  private pbkdf2Iterations = 100000;
  
  private masterKey: Buffer;

  constructor() {
    // In production, this should come from environment variable or secure key management
    const masterPassword = process.env.ENCRYPTION_MASTER_KEY || 'default-master-key-change-in-production';
    const salt = process.env.ENCRYPTION_SALT || 'default-salt-change-in-production';
    
    // Derive master key from password
    this.masterKey = crypto.pbkdf2Sync(
      masterPassword,
      salt,
      this.pbkdf2Iterations,
      this.keyLength,
      'sha256'
    );
  }

  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      Buffer.from(encryptedData.iv, 'hex')
    ) as crypto.DecipherGCM;
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Encrypt a secret and return a single string that can be stored
  encryptSecret(secret: string): string {
    const { encrypted, iv, tag } = this.encrypt(secret);
    // Combine all parts into a single string
    return `${iv}:${tag}:${encrypted}`;
  }

  // Decrypt a secret from the stored format
  decryptSecret(encryptedSecret: string): string {
    const [iv, tag, encrypted] = encryptedSecret.split(':');
    return this.decrypt({ encrypted, iv, tag });
  }

  // Generate a secure random token
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash a value (for comparison, not for passwords)
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();