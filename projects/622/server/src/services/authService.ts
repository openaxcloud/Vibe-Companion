import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDTO {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken extends JwtPayload {
  userId: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: Omit<User, "id" | "createdAt" | "updatedAt"> & Partial<Pick<User, "id" | "createdAt" | "updatedAt">>): Promise<User>;
  update(user: User): Promise<User>;
}

export class AuthError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid email or password") {
    super(message, "INVALID_CREDENTIALS", 401);
    this.name = "InvalidCredentialsError";
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(message = "User with this email already exists") {
    super(message, "USER_ALREADY_EXISTS", 409);
    this.name = "UserAlreadyExistsError";
  }
}

export class TokenError extends AuthError {
  constructor(message = "Invalid or expired token") {
    super(message, "TOKEN_ERROR", 401);
    this.name = "TokenError";
  }
}

export interface AuthServiceConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiresIn?: string | number;
  refreshTokenExpiresIn?: string | number;
  bcryptSaltRounds?: number;
}

export interface AuthServiceDependencies {
  userRepository: UserRepository;
  config: AuthServiceConfig;
}

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiresIn: string | number;
  private readonly refreshTokenExpiresIn: string | number;
  private readonly bcryptSaltRounds: number;

  constructor(deps: AuthServiceDependencies) {
    if (!deps?.userRepository) {
      throw new Error("AuthService requires a userRepository");
    }
    if (!deps?.config?.jwtAccessSecret || !deps?.config?.jwtRefreshSecret) {
      throw new Error("AuthService requires jwtAccessSecret and jwtRefreshSecret");
    }

    this.userRepository = deps.userRepository;
    this.jwtAccessSecret = deps.config.jwtAccessSecret;
    this.jwtRefreshSecret = deps.config.jwtRefreshSecret;
    this.accessTokenExpiresIn = deps.config.accessTokenExpiresIn ?? "15m";
    this.refreshTokenExpiresIn = deps.config.refreshTokenExpiresIn ?? "7d";
    this.bcryptSaltRounds = deps.config.bcryptSaltRounds ?? 12;
  }

  public async registerUser(email: string, password: string): Promise<{ user: UserDTO; tokens: AuthTokens }> {
    const normalizedEmail = this.normalizeEmail(email);
    await this.ensureUserDoesNotExist(normalizedEmail);

    const passwordHash = await this.hashPassword(password);
    const now = new Date();

    const user: User = await this.userRepository.create({
      id: uuidv4(),
      email: normalizedEmail,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const tokens = this.generateAuthTokens(user.id);
    return { user: this.mapUserToDTO(user), tokens };
  }

  public async authenticateUser(email: string, password: string): Promise<{ user: UserDTO; tokens: AuthTokens }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new InvalidCredentialsError();
    }

    const tokens = this.generateAuthTokens(user.id);
    return { user: this.mapUserToDTO(user), tokens };
  }

  public async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const decoded = this.verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(decoded.userId);
    if (!user) {
      throw new TokenError("User associated with token no longer exists");
    }
    return this.generateAuthTokens(user.id);
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new InvalidCredentialsError("User not found");
    }

    const isValidPassword = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new InvalidCredentialsError("Current password is incorrect");
    }

    const newHash = await this.hashPassword(newPassword);
    user.passwordHash = newHash;
    user.updatedAt = new Date();
    await this.userRepository.update(user);
  }

  public mapUserToDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  public generateAccessToken(userId: string): string {
    const payload: DecodedToken = { userId };
    return jwt.sign(payload, this.jwtAccessSecret, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }

  public generateRefreshToken(userId: string): string {
    const payload: DecodedToken = { userId };
    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    });
  }

  public generateAuthTokens(userId: string): AuthTokens {
    return {
      accessToken: this.generateAccessToken(userId),
      refreshToken: this.generateRefreshToken(userId),
    };
  }

  public verifyAccessToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.jwtAccessSecret) as DecodedToken;
      if (!decoded.userId) {
        throw new TokenError("Token payload missing userId");
      }
      return decoded;
    } catch (err) {
      throw new TokenError("Invalid or expired access token");
    }
  }

  public verifyRefreshToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret) as DecodedToken;
      if (!decoded.userId) {
        throw new TokenError("Token payload missing userId");
      }
      return decoded;
    } catch (err) {
      throw new TokenError("Invalid or expired refresh token");
    }
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptSaltRounds);
  }

  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async ensureUserDoesNotExist(email: string): Promise<void> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new UserAlreadyExistsError();
    }
  }
}

export default AuthService;