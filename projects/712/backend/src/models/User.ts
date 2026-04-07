import bcrypt from "bcryptjs";
import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export interface UserAttributes {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "passwordHash" | "role" | "avatarUrl" | "createdAt" | "updatedAt"
>;

export class User
  extends Model<InferAttributes<User>, InferCreationAttributes<User>>
  implements UserAttributes
{
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: UserRole;
  declare avatarUrl: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!this.passwordHash) return false;
    return bcrypt.compare(plainPassword, this.passwordHash);
  }

  static initialize(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: "Name is required",
            },
            len: {
              args: [2, 255],
              msg: "Name must be between 2 and 255 characters",
            },
          },
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: {
            name: "unique_user_email",
            msg: "Email is already in use",
          },
          validate: {
            notEmpty: {
              msg: "Email is required",
            },
            isEmail: {
              msg: "Email must be a valid email address",
            },
            len: {
              args: [5, 255],
              msg: "Email must be between 5 and 255 characters",
            },
          },
        },
        passwordHash: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: "Password hash is required",
            },
          },
        },
        role: {
          type: DataTypes.ENUM(...Object.values(UserRole)),
          allowNull: false,
          defaultValue: UserRole.USER,
        },
        avatarUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          validate: {
            isUrlOrNull(value: string | null) {
              if (value && typeof value === "string") {
                // Very light validation, Sequelize's isUrl is often too strict for data URLs, CDNs, etc.
                const urlPattern =
                  /^(https?:\/\/|data:image\/[a-zA-Z]+;base64,).+/;
                if (!urlPattern.test(value)) {
                  throw new Error("avatarUrl must be a valid URL");
                }
              }
            },
          },
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "users",
        modelName: "User",
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ["email"],
          },
          {
            fields: ["role"],
          },
        ],
        hooks: {
          beforeCreate: async (user: User) => {
            await hashPasswordIfNeeded(user);
          },
          beforeUpdate: async (user: User) => {
            await hashPasswordIfNeeded(user);
          },
        },
        defaultScope: {
          attributes: { exclude: ["passwordHash"] },
        },
        scopes: {
          withPasswordHash: {
            attributes: { include: ["passwordHash"] },
          },
        },
      }
    );

    return User;
  }

  toSafeJSON(): Omit<UserAttributes, "passwordHash"> {
    const { passwordHash, ...safe } = this.get({ plain: true }) as UserAttributes;
    return safe;
  }
}

async function hashPasswordIfNeeded(user: User): Promise<void> {
  if ((user as any).password && (user as any).password !== "") {
    const plainPassword = (user as any).password as string;
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(plainPassword, salt);
    delete (user as any).password;
    return;
  }

  if (user.changed("passwordHash")) {
    const newHash = user.get("passwordHash") as string;
    const isBcryptHash = /^\$2[aby]\$/.test(newHash);
    if (!isBcryptHash && newHash) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newHash, salt);
    }
  }
}

export const initUserModel = (sequelize: Sequelize): typeof User => {
  return User.initialize(sequelize);
};