import bcrypt from 'bcryptjs';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface PublicUserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAdmin: boolean;
}

export class UserNotFoundError extends Error {
  public readonly code: string = 'USER_NOT_FOUND';

  constructor(message = 'User not found') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCredentialsError extends Error {
  public readonly code: string = 'INVALID_CREDENTIALS';

  constructor(message = 'Invalid email or password') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends Error {
  public readonly code: string = 'FORBIDDEN';

  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UserService {
  private readonly prisma: PrismaClient;
  private readonly passwordSaltRounds: number;

  constructor(prismaClient?: PrismaClient, passwordSaltRounds: number = 12) {
    this.prisma = prismaClient ?? prisma;
    this.passwordSaltRounds = passwordSaltRounds;
  }

  public async findByEmail(email: string): Promise<User | null> {
    if (!email) {
      throw new Error('Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  public async createUser(input: CreateUserInput): Promise<PublicUserProfile> {
    const { email, password, name } = input;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      const err = new Error('User with this email already exists');
      (err as any).code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, this.passwordSaltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name?.trim() || null,
      },
    });

    return this.toPublicProfile(user);
  }

  public async verifyPassword(email: string, password: string): Promise<User> {
    if (!email || !password) {
      throw new InvalidCredentialsError();
    }

    const user = await this.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new InvalidCredentialsError();
    }

    return user;
  }

  public async getProfile(userId: string): Promise<PublicUserProfile> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    return this.toPublicProfile(user);
  }

  public async ensureAdmin(userId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenError();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isAdmin: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.isAdmin) {
      throw new ForbiddenError('Admin privileges are required for this action');
    }
  }

  private toPublicProfile(user: User): PublicUserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isAdmin: user.isAdmin,
    };
  }
}

export const userService = new UserService();