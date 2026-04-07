import bcrypt from "bcryptjs";

export interface PasswordStrengthOptions {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
}

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
}

export const defaultStrengthOptions: Required<PasswordStrengthOptions> = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
};

const DEFAULT_SALT_ROUNDS = 10;

export function validatePasswordStrength(
  password: string,
  options: PasswordStrengthOptions = {}
): PasswordStrengthResult {
  const config: Required<PasswordStrengthOptions> = {
    ...defaultStrengthOptions,
    ...options,
  };

  const errors: string[] = [];

  if (typeof password !== "string" || password.length === 0) {
    return {
      valid: false,
      errors: ["Password must be a non-empty string."],
    };
  }

  if (password.length < config.minLength) {
    errors.push(`Password must be at least undefined characters long.`);
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must be no more than undefined characters long.`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }

  if (config.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }

  if (config.requireSpecialChar && !/[~`!@#$%^&*()_\-+={[}\]|\\:;"'<,>.?/]/.test(password)) {
    errors.push("Password must contain at least one special character.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(
  password: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }

  if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
    throw new Error("saltRounds must be a positive integer.");
  }

  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

export function hashPasswordSync(
  password: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): string {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }

  if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
    throw new Error("saltRounds must be a positive integer.");
  }

  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
}

export async function comparePassword(
  plainText: string,
  hash: string
): Promise<boolean> {
  if (typeof plainText !== "string" || plainText.length === 0) {
    throw new Error("Plaintext password must be a non-empty string.");
  }

  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("Hash must be a non-empty string.");
  }

  return bcrypt.compare(plainText, hash);
}

export function comparePasswordSync(plainText: string, hash: string): boolean {
  if (typeof plainText !== "string" || plainText.length === 0) {
    throw new Error("Plaintext password must be a non-empty string.");
  }

  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("Hash must be a non-empty string.");
  }

  return bcrypt.compareSync(plainText, hash);
}