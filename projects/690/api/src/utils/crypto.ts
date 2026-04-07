import bcrypt from 'bcryptjs';

export interface PasswordHashResult {
  hash: string;
  saltRounds: number;
}

const DEFAULT_SALT_ROUNDS = 12;

export const hashPassword = async (
  plainTextPassword: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<PasswordHashResult> => {
  if (!plainTextPassword || typeof plainTextPassword !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 20) {
    throw new Error('Salt rounds must be an integer between 4 and 20.');
  }

  const hash = await bcrypt.hash(plainTextPassword, saltRounds);
  return { hash, saltRounds };
};

export const comparePassword = async (
  plainTextPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  if (!plainTextPassword || typeof plainTextPassword !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  if (!hashedPassword || typeof hashedPassword !== 'string') {
    throw new Error('Hashed password must be a non-empty string.');
  }

  return bcrypt.compare(plainTextPassword, hashedPassword);
};

export const getDefaultSaltRounds = (): number => DEFAULT_SALT_ROUNDS;

export const isHashMatchingStrength = (
  hash: string,
  expectedSaltRounds: number = DEFAULT_SALT_ROUNDS
): boolean => {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  const parts = hash.split('$');
  if (parts.length < 4) {
    return false;
  }

  const cost = parseInt(parts[2], 10);
  if (Number.isNaN(cost)) {
    return false;
  }

  return cost === expectedSaltRounds;
};