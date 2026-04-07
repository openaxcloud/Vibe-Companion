import bcrypt from 'bcryptjs';

export const DEFAULT_SALT_ROUNDS = 12;

export class PasswordError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'PASSWORD_ERROR') {
    super(message);
    this.name = 'PasswordError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const hashPassword = async (
  plainTextPassword: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> => {
  if (!isNonEmptyString(plainTextPassword)) {
    throw new PasswordError('Password must be a non-empty string.', 'INVALID_PASSWORD_INPUT');
  }

  if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
    throw new PasswordError('Salt rounds must be a positive integer.', 'INVALID_SALT_ROUNDS');
  }

  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(plainTextPassword, salt);
    return hash;
  } catch (error) {
    throw new PasswordError('Failed to hash password.', 'HASHING_FAILED');
  }
};

export const verifyPassword = async (
  plainTextPassword: string,
  passwordHash: string
): Promise<boolean> => {
  if (!isNonEmptyString(plainTextPassword)) {
    throw new PasswordError('Password must be a non-empty string.', 'INVALID_PASSWORD_INPUT');
  }

  if (!isNonEmptyString(passwordHash)) {
    throw new PasswordError('Password hash must be a non-empty string.', 'INVALID_HASH_INPUT');
  }

  try {
    return await bcrypt.compare(plainTextPassword, passwordHash);
  } catch (error) {
    throw new PasswordError('Failed to verify password.', 'VERIFICATION_FAILED');
  }
};

export const needsRehash = (
  passwordHash: string,
  preferredSaltRounds: number = DEFAULT_SALT_ROUNDS
): boolean => {
  if (!isNonEmptyString(passwordHash)) {
    throw new PasswordError('Password hash must be a non-empty string.', 'INVALID_HASH_INPUT');
  }

  if (!Number.isInteger(preferredSaltRounds) || preferredSaltRounds <= 0) {
    throw new PasswordError('Salt rounds must be a positive integer.', 'INVALID_SALT_ROUNDS');
  }

  // bcrypt hash format: $2b$10$salt22characters..............restOfHash
  const parts = passwordHash.split('$');
  if (parts.length < 4) {
    throw new PasswordError('Invalid bcrypt hash format.', 'INVALID_HASH_FORMAT');
  }

  const costStr = parts[2];
  const cost = parseInt(costStr, 10);

  if (!Number.isInteger(cost)) {
    throw new PasswordError('Invalid cost factor in hash.', 'INVALID_HASH_COST');
  }

  return cost < preferredSaltRounds;
};

export default {
  hashPassword,
  verifyPassword,
  needsRehash,
  DEFAULT_SALT_ROUNDS,
  PasswordError
};