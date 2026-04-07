import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export type UserRole = "user" | "admin";

export interface IUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export class User implements IUser {
  public id: string;
  public name: string;
  public email: string;
  public passwordHash: string;
  public role: UserRole;
  public createdAt: Date;
  public updatedAt: Date;

  private static readonly SALT_ROUNDS = 12;

  constructor(params: IUser) {
    this.id = params.id;
    this.name = params.name;
    this.email = params.email.toLowerCase().trim();
    this.passwordHash = params.passwordHash;
    this.role = params.role;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || plainPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
    const salt = await bcrypt.genSalt(User.SALT_ROUNDS);
    return bcrypt.hash(plainPassword, salt);
  }

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!plainPassword) return false;
    return bcrypt.compare(plainPassword, this.passwordHash);
  }

  static async create(input: UserCreateInput): Promise<User> {
    const now = new Date();

    const passwordHash = await User.hashPassword(input.password);

    const user: IUser = {
      id: uuidv4(),
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role ?? "user",
      createdAt: now,
      updatedAt: now,
    };

    return new User(user);
  }

  async update(input: UserUpdateInput): Promise<void> {
    let hasChanges = false;

    if (typeof input.name === "string") {
      const trimmed = input.name.trim();
      if (trimmed && trimmed !== this.name) {
        this.name = trimmed;
        hasChanges = true;
      }
    }

    if (typeof input.email === "string") {
      const normalized = input.email.toLowerCase().trim();
      if (normalized && normalized !== this.email) {
        this.email = normalized;
        hasChanges = true;
      }
    }

    if (typeof input.role === "string" && input.role !== this.role) {
      this.role = input.role;
      hasChanges = true;
    }

    if (typeof input.password === "string" && input.password.length > 0) {
      this.passwordHash = await User.hashPassword(input.password);
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();
    }
  }

  touch(): void {
    this.updatedAt = new Date();
  }

  toJSON(): Omit<IUser, "passwordHash"> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPersistence(record: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    createdAt: string | Date;
    updatedAt: string | Date;
  }): User {
    return new User({
      id: record.id,
      name: record.name,
      email: record.email,
      passwordHash: record.passwordHash,
      role: record.role,
      createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
    });
  }

  static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  static isAdmin(user: Pick<IUser, "role">): boolean {
    return user.role === "admin";
  }
}