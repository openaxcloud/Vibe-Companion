import bcrypt from "bcryptjs";

export interface HashOptions {
  saltRounds?: number;
}

const DEFAULT_SALT_ROUNDS = 12;

export const hashPassword = async (
  password: string,
  options: HashOptions = {}
): Promise<string> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }

  const saltRounds =
    typeof options.saltRounds === "number" && options.saltRounds > 0
      ? options.saltRounds
      : DEFAULT_SALT_ROUNDS;

  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error("Failed to hash password.");
  }
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }

  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("Hash must be a non-empty string.");
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error("Failed to verify password.");
  }
};

export const getSaltRounds = (override?: number): number => {
  if (typeof override === "number" && override > 0) {
    return override;
  }

  const envRounds = process.env.BCRYPT_SALT_ROUNDS;
  if (envRounds) {
    const parsed = Number(envRounds);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_SALT_ROUNDS;
};

export const hashPasswordWithConfig = async (
  password: string,
  overrideSaltRounds?: number
): Promise<string> => {
  const saltRounds = getSaltRounds(overrideSaltRounds);
  return hashPassword(password, { saltRounds });
};