import { Pool, PoolClient, QueryResult } from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export type UserRole = 'user' | 'admin' | 'superadmin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateUserInput {
  firstName?: string | null;
  lastName?: string | null;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface BasicUserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface UserRepository {
  findById(id: string, client?: PoolClient): Promise<User | null>;
  findByEmail(email: string, client?: PoolClient): Promise<User | null>;
  createUser(input: CreateUserInput, client?: PoolClient): Promise<User>;
  updateUser(id: string, updates: UpdateUserInput, client?: PoolClient): Promise<User | null>;
  deleteUser(id: string, client?: PoolClient): Promise<boolean>;
  listUsers(limit?: number, offset?: number, client?: PoolClient): Promise<BasicUserProfile[]>;
  getBasicProfile(id: string, client?: PoolClient): Promise<BasicUserProfile | null>;
  setUserActiveStatus(id: string, isActive: boolean, client?: PoolClient): Promise<User | null>;
}

export interface UserRepositoryDependencies {
  dbPool: Pool;
  bcryptSaltRounds?: number;
}

export const createUserRepository = (deps: UserRepositoryDependencies): UserRepository => {
  const { dbPool, bcryptSaltRounds = 12 } = deps;

  const mapRowToUser = (row: any): User => ({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const mapRowToBasicProfile = (row: any): BasicUserProfile => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  });

  const getClient = async (client?: PoolClient): Promise<{ client: PoolClient; release: () => void }> => {
    if (client) {
      return { client, release: () => undefined };
    }
    const pooledClient = await dbPool.connect();
    return {
      client: pooledClient,
      release: () => pooledClient.release(),
    };
  };

  const findById = async (id: string, client?: PoolClient): Promise<User | null> => {
    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `;
      const result: QueryResult = await dbClient.query(query, [id]);
      if (result.rowCount === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } finally {
      release();
    }
  };

  const findByEmail = async (email: string, client?: PoolClient): Promise<User | null> => {
    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        SELECT id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `;
      const result: QueryResult = await dbClient.query(query, [email]);
      if (result.rowCount === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } finally {
      release();
    }
  };

  const createUser = async (input: CreateUserInput, client?: PoolClient): Promise<User> => {
    const { email, password, firstName = null, lastName = null } = input;
    const role: UserRole = input.role ?? 'user';
    const isActive: boolean = input.isActive ?? true;

    const existing = await findByEmail(email, client);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const id = randomUUID();

    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
      `;
      const values = [id, email.toLowerCase(), passwordHash, firstName, lastName, role, isActive];
      const result: QueryResult = await dbClient.query(query, values);
      return mapRowToUser(result.rows[0]);
    } finally {
      release();
    }
  };

  const updateUser = async (id: string, updates: UpdateUserInput, client?: PoolClient): Promise<User | null> => {
    const current = await findById(id, client);
    if (!current) {
      return null;
    }

    const updatedFirstName = updates.firstName !== undefined ? updates.firstName : current.firstName;
    const updatedLastName = updates.lastName !== undefined ? updates.lastName : current.lastName;
    const updatedRole = updates.role !== undefined ? updates.role : current.role;
    const updatedIsActive = updates.isActive !== undefined ? updates.isActive : current.isActive;

    let passwordHash = current.passwordHash;
    if (updates.password) {
      passwordHash = await bcrypt.hash(updates.password, bcryptSaltRounds);
    }

    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        UPDATE users
        SET
          first_name = $1,
          last_name = $2,
          role = $3,
          is_active = $4,
          password_hash = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
      `;
      const values = [
        updatedFirstName,
        updatedLastName,
        updatedRole,
        updatedIsActive,
        passwordHash,
        id,
      ];
      const result: QueryResult = await dbClient.query(query, values);
      if (result.rowCount === 0) {
        return null;
      }
      return mapRowToUser(result.rows[0]);
    } finally {
      release();
    }
  };

  const deleteUser = async (id: string, client?: PoolClient): Promise<boolean> => {
    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        DELETE FROM users
        WHERE id = $1
      `;
      const result: QueryResult = await dbClient.query(query, [id]);
      return result.rowCount > 0;
    } finally {
      release();
    }
  };

  const listUsers = async (
    limit = 50,
    offset = 0,
    client?: PoolClient
  ): Promise<BasicUserProfile[]> => {
    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, is_active, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const result: QueryResult = await dbClient.query(query, [limit, offset]);
      return result.rows.map(mapRowToBasicProfile);
    } finally {
      release();
    }
  };

  const getBasicProfile = async (id: string, client?: PoolClient): Promise<BasicUserProfile | null> => {
    const { client: dbClient, release } = await getClient(client);
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, is_active, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `;
      const result: QueryResult = await dbClient.query(query, [id]);
      if (result.rowCount === 0) {
        return null;
      }
      return mapRowTo