import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  if (typeof plainPassword !== "string" || !plainPassword) {
    throw new Error("Password must be a non-empty string");
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(plainPassword, salt);
    return hash;
  } catch (error) {
    throw new Error("Failed to hash password");
  }
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  if (typeof plainPassword !== "string" || !plainPassword) {
    throw new Error("Password must be a non-empty string");
  }

  if (typeof hashedPassword !== "string" || !hashedPassword) {
    throw new Error("Hashed password must be a non-empty string");
  }

  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error("Failed to compare password");
  }
}