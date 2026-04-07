import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../authService';

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

type MockPrisma = DeepMockProxy<PrismaClient>;

describe('AuthService', () => {
  let prisma: MockPrisma;
  let authService: AuthService;

  const JWT_SECRET = 'test-jwt-secret';
  const SALT_ROUNDS = 10;

  const userFixture = {
    id: 'user-id-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    authService = new AuthService(prisma as unknown as PrismaClient, {
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      bcryptSaltRounds: SALT_ROUNDS,
    });
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should hash password and create user, then return JWT and user', async () => {
      const plainPassword = 'PlainPass123!';
      const hashedPassword = 'hashedPassword123';
      const token = 'signed-jwt-token';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      prisma.user.create.mockResolvedValue({
        ...userFixture,
        passwordHash: hashedPassword,
      });
      (jwt.sign as jest.Mock).mockReturnValue(token);

      const result = await authService.register({
        email: userFixture.email,
        password: plainPassword,
      });

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, SALT_ROUNDS);

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userFixture.email,
          passwordHash: hashedPassword,
        },
      });

      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userFixture.id, email: userFixture.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      expect(result).toEqual({
        token,
        user: {
          id: userFixture.id,
          email: userFixture.email,
          createdAt: userFixture.createdAt,
          updatedAt: userFixture.updatedAt,
        },
      });
    });

    it('should throw error when email is already taken', async () => {
      const plainPassword = 'PlainPass123!';
      prisma.user.findUnique.mockResolvedValue({
        ...userFixture,
      });

      await expect(
        authService.register({
          email: userFixture.email,
          password: plainPassword,
        })
      ).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Email already in use',
        code: 'EMAIL_TAKEN',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userFixture.email },
      });
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should propagate unexpected errors from Prisma', async () => {
      const plainPassword = 'PlainPass123!';
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('some-hash');
      const prismaError = new Error('DB failure');
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(
        authService.register({
          email: userFixture.email,
          password: plainPassword,
        })
      ).rejects.toBe(prismaError);
    });
  });

  describe('login', () => {
    it('should validate password and issue JWT on successful login', async () => {
      const plainPassword = 'PlainPass123!';
      const token = 'signed-jwt-token';

      prisma.user.findUnique.mockResolvedValue({
        ...userFixture,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue(token);

      const result = await authService.login({
        email: userFixture.email,
        password: plainPassword,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userFixture.email },
      });

      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        plainPassword,
        userFixture.passwordHash
      );

      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userFixture.id, email: userFixture.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      expect(result).toEqual({
        token,
        user: {
          id: userFixture.id,
          email: userFixture.email,
          createdAt: userFixture.createdAt,
          updatedAt: userFixture.updatedAt,
        },
      });
    });

    it('should throw error when user is not found', async () => {
      const plainPassword = 'PlainPass123!';
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: userFixture.email,
          password: plainPassword,
        })
      ).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should throw error when password does not match', async () => {
      const plainPassword = 'WrongPassword!';
      prisma.user.findUnique.mockResolvedValue({
        ...userFixture,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({
          email: userFixture.email,
          password: plainPassword,
        })
      ).rejects.toMatchObject({
        name: 'AuthError',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });

      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should propagate unexpected errors from Prisma', async () => {
      const plainPassword = 'PlainPass123!';
      const prismaError = new Error('DB failure');
      prisma.user.findUnique.mockRejectedValue(prismaError);

      await expect(
        authService.login({
          email: userFixture.email,
          password: plainPassword,
        })
      ).rejects.toBe(prismaError);
    });
  });

  describe('configuration and environment', () => {
    it('should throw if JWT_SECRET is not provided at construction', () => {
      expect(
        () =>
          new AuthService(prisma as unknown as PrismaClient, {
            jwtSecret: '',
            jwtExpiresIn: '1h',
            bcryptSaltRounds: SALT_ROUNDS,
          })
      ).toThrow(/JWT secret/i);
    });

    it('should default to 1h expiration if not configured explicitly', async () => {
      const service = new AuthService(prisma as unknown as PrismaClient, {
        jwtSecret: JWT_SECRET,
        bcryptSaltRounds: SALT_ROUNDS,
      });

      prisma.user.findUnique.mockResolvedValue({
        ...userFixture,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('token');

      await service.login({
        email: userFixture.email,
        password: 'PlainPass123!',
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userFixture.id, email: userFixture.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
    });
  });
});