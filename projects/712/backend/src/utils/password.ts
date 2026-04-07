import bcrypt from 'bcryptjs';

const DEFAULT_SALT_ROUNDS = 12;

export interface PasswordHashOptions {
  /**
   * Number of salt rounds to use for hashing.
   * Higher values are more secure but slower.
   * Defaults to DEFAULT_SALT_ROUNDS.
   */
  saltRounds?: number;
}

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param password - The plaintext password to hash
 * @param options - Optional hashing options
 * @returns A bcrypt hash of the password
 */
export async function hashPassword(
  password: string,
  options: PasswordHashOptions = {}
): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  const saltRounds =
    typeof options.saltRounds === 'number' && options.saltRounds > 0
      ? options.saltRounds
      : DEFAULT_SALT_ROUNDS;

  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Compares a plaintext password against a bcrypt hash.
 *
 * @param password - The plaintext password
 * @param hash - The bcrypt hash to compare against
 * @returns True if the password matches the hash, false otherwise
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0) {
    return false;
  }

  if (typeof hash !== 'string' || hash.length === 0) {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return Boolean(isMatch);
  } catch {
    // In case of any error during comparison, fail closed
    return false;
  }
}

/**
 * Synchronous variant of hashPassword.
 * Prefer the async version in most cases.
 *
 * @param password - The plaintext password to hash
 * @param options - Optional hashing options
 * @returns A bcrypt hash of the password
 */
export function hashPasswordSync(
  password: string,
  options: PasswordHashOptions = {}
): string {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  const saltRounds =
    typeof options.saltRounds === 'number' && options.saltRounds > 0
      ? options.saltRounds
      : DEFAULT_SALT_ROUNDS;

  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
}

/**
 * Synchronous variant of comparePassword.
 * Prefer the async version in most cases.
 *
 * @param password - The plaintext password
 * @param hash - The bcrypt hash to compare against
 * @returns True if the password matches the hash, false otherwise
 */
export function comparePasswordSync(password: string, hash: string): boolean {
  if (typeof password !== 'string' || password.length === 0) {
    return false;
  }

  if (typeof hash !== 'string' || hash.length === 0) {
    return false;
  }

  try {
    const isMatch = bcrypt.compareSync(password, hash);
    return Boolean(isMatch);
  } catch {
    return false;
  }
}

/**
 * Checks if a given string looks like a bcrypt hash.
 * This is a heuristic check and does not guarantee validity.
 *
 * @param value - The string to check
 * @returns True if the string appears to be a bcrypt hash
 */
export function looksLikeBcryptHash(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Typical bcrypt hash format: $2[abxy]$10$<22-char-salt><31-char-hash>
  const bcryptRegex = /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/;
  return bcryptRegex.test(value);
}

/**
 * Exposes the default salt rounds used for password hashing.
 */
export function getDefaultSaltRounds(): number {
  return DEFAULT_SALT_ROUNDS;
}