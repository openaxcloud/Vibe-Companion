import { Sequelize, Dialect } from 'sequelize';
import path from 'path';
import fs from 'fs';
import process from 'process';
import { createUserModel, UserModelStatic } from './User';
import { createRoleModel, RoleModelStatic } from './Role';
import { createUserRoleModel, UserRoleModelStatic } from './UserRole';
import { createRefreshTokenModel, RefreshTokenModelStatic } from './RefreshToken';
import { createPasswordResetTokenModel, PasswordResetTokenModelStatic } from './PasswordResetToken';
import { createOrganizationModel, OrganizationModelStatic } from './Organization';
import { createProjectModel, ProjectModelStatic } from './Project';
import { createProjectMemberModel, ProjectMemberModelStatic } from './ProjectMember';
import { createAuditLogModel, AuditLogModelStatic } from './AuditLog';
import { createFileModel, FileModelStatic } from './File';

export interface DatabaseConfig {
  username: string;
  password: string;
  database: string;
  host: string;
  port?: number;
  dialect: Dialect;
  logging?: boolean | ((sql: string, timing?: number) => void);
  timezone?: string;
  pool?: {
    max?: number;
    min?: number;
    acquire?: number;
    idle?: number;
  };
  ssl?: boolean;
}

export interface DbModels {
  User: UserModelStatic;
  Role: RoleModelStatic;
  UserRole: UserRoleModelStatic;
  RefreshToken: RefreshTokenModelStatic;
  PasswordResetToken: PasswordResetTokenModelStatic;
  Organization: OrganizationModelStatic;
  Project: ProjectModelStatic;
  ProjectMember: ProjectMemberModelStatic;
  AuditLog: AuditLogModelStatic;
  File: FileModelStatic;
}

export interface DbInstance extends DbModels {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
}

const env = process.env.NODE_ENV || 'development';
const baseDir = path.resolve(__dirname, '../../..');

const defaultConfig: DatabaseConfig = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || `app_undefined`,
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  dialect: (process.env.DB_DIALECT as Dialect) || 'postgres',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  timezone: '+00:00',
  pool: {
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
    min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : 0,
    acquire: process.env.DB_POOL_ACQUIRE
      ? parseInt(process.env.DB_POOL_ACQUIRE, 10)
      : 30000,
    idle: process.env.DB_POOL_IDLE
      ? parseInt(process.env.DB_POOL_IDLE, 10)
      : 10000,
  },
};

const configPath = path.join(baseDir, 'config', 'database.json');
let fileConfig: Partial<DatabaseConfig> = {};

if (fs.existsSync(configPath)) {
  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    if (parsed && typeof parsed === 'object') {
      const envConfig = parsed[env] || parsed;
      if (envConfig && typeof envConfig === 'object') {
        fileConfig = envConfig;
      }
    }
  } catch {
    // Ignore config file errors, fall back to env/defaults
  }
}

const mergedConfig: DatabaseConfig = {
  ...defaultConfig,
  ...fileConfig,
  pool: {
    ...defaultConfig.pool,
    ...(fileConfig.pool || {}),
  },
};

const sequelize = new Sequelize(
  mergedConfig.database,
  mergedConfig.username,
  mergedConfig.password,
  {
    host: mergedConfig.host,
    port: mergedConfig.port,
    dialect: mergedConfig.dialect,
    logging: mergedConfig.logging,
    timezone: mergedConfig.timezone,
    pool: mergedConfig.pool,
    dialectOptions: mergedConfig.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  }
);

const User = createUserModel(sequelize);
const Role = createRoleModel(sequelize);
const UserRole = createUserRoleModel(sequelize);
const RefreshToken = createRefreshTokenModel(sequelize);
const PasswordResetToken = createPasswordResetTokenModel(sequelize);
const Organization = createOrganizationModel(sequelize);
const Project = createProjectModel(sequelize);
const ProjectMember = createProjectMemberModel(sequelize);
const AuditLog = createAuditLogModel(sequelize);
const File = createFileModel(sequelize);

// Associations

// User - Role (Many-to-Many via UserRole)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'userId',
  otherKey: 'roleId',
  as: 'roles',
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'roleId',
  otherKey: 'userId',
  as: 'users',
});
UserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
User.hasMany(UserRole, { foreignKey: 'userId', as: 'userRoles' });
Role.hasMany(UserRole, { foreignKey: 'roleId', as: 'userRoles' });

// User - RefreshToken (One-to-Many)
User.hasMany(RefreshToken, {
  foreignKey: 'userId',
  as: 'refreshTokens',
  onDelete: 'CASCADE',
});
RefreshToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// User - PasswordResetToken (One-to-Many)
User.hasMany(PasswordResetToken, {
  foreignKey: 'userId',
  as: 'passwordResetTokens',
  onDelete: 'CASCADE',
});
PasswordResetToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Organization - User (Many-to-Many via ProjectMember or direct membership depending on design)
// Here we assume User belongs to one Organization (change as needed)
Organization.hasMany(User, {
  foreignKey: 'organizationId',
  as: 'users',
});
User.belongsTo(Organization, {
  foreignKey: 'organizationId',
  as: 'organization',
});

// Organization - Project (One-to-Many)
Organization.hasMany(Project, {
  foreignKey: 'organizationId',
  as: 'projects',
});
Project.belongsTo(Organization, {
  foreignKey: 'organizationId',
  as: 'organization',
});

// Project - ProjectMember (One-to-Many) & User - Project (Many-to-Many via ProjectMember)
Project.hasMany(ProjectMember, {
  foreignKey: 'projectId',
  as: 'memberships',
  onDelete: 'CASCADE',
});
ProjectMember.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
});

User.hasMany(ProjectMember, {
  foreignKey: 'userId',
  as: 'projectMemberships',
  onDelete: 'CASCADE',
});
ProjectMember.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.belongsToMany(Project, {
  through: ProjectMember,
  foreignKey: 'userId',
  otherKey: 'projectId',
  as: 'projects',
});
Project.belongsToMany(User, {
  through: ProjectMember,
  foreignKey: 'projectId',
  otherKey: 'userId',
  as: 'users',
});

// User - AuditLog (One-to-Many)
User.hasMany(AuditLog, {
  foreignKey: 'userId',
  as: 'auditLogs',
});
AuditLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Project - File (One-to-Many)
Project.hasMany(File, {
  foreignKey: 'projectId',
  as: 'files',
  onDelete: 'CASCADE',
});
File.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
});

// User - File (One-to-Many for uploader/owner)
User.hasMany(File, {
  foreignKey: 'uploadedById',
  as: 'uploadedFiles',
});
File.belongsTo(User, {
  foreignKey: 'uploadedById',
  as: 'uploadedBy',
});

export const db: DbInstance = {
  sequelize,
  Sequelize,
  User,
  Role,
  UserRole,
  RefreshToken,
  PasswordResetToken,
  Organization,
  Project,
  ProjectMember,
  AuditLog,
  File,
};

export {
  sequelize,
  Sequelize,
  User,
  Role,
  UserRole,
  RefreshToken,
  PasswordResetToken,
  Organization,
  Project,
  ProjectMember,
  AuditLog,
  File,
};

export default db;