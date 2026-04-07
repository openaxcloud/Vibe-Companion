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
    throw new Error("Password must be a non-empty string");
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
    throw new Error("Failed to hash password");
  }
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }
  if (typeof hash !== "string" || hash.length === 0) {
    throw new Error("Hash must be a non-empty string");
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch {
    return false;
  }
};

export const getSaltRoundsFromEnv = (
  envVarName = "BCRYPT_SALT_ROUNDS"
): number => {
  const envValue = process.env[envVarName];

  if (!envValue) {
    return DEFAULT_SALT_ROUNDS;
  }

  const parsed = Number.parseInt(envValue, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_SALT_ROUNDS;
  }

  return parsed;
};

export default {
  hashPassword,
  comparePassword,
  getSaltRoundsFromEnv,
};