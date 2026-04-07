import { Sequelize } from 'sequelize';
import type {
  Model,
  ModelStatic,
  Optional,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { initUserModel, User } from './User';
import { initPostModel, Post } from './Post';
import { initCommentModel, Comment } from './Comment';
import { initProfileModel, Profile } from './Profile';
import { initTagModel, Tag } from './Tag';
import { initPostTagModel, PostTag } from './PostTag';
import { initSessionModel, Session } from './Session';
import { initRefreshTokenModel, RefreshToken } from './RefreshToken';

// Extend or adjust this configuration typing as needed for your project
export interface DatabaseConfig {
  uri?: string;
  database?: string;
  username?: string;
  password?: string;
  options?: ConstructorParameters<typeof Sequelize>[2];
}

export interface DbModels {
  User: ModelStatic<User>;
  Post: ModelStatic<Post>;
  Comment: ModelStatic<Comment>;
  Profile: ModelStatic<Profile>;
  Tag: ModelStatic<Tag>;
  PostTag: ModelStatic<PostTag>;
  Session: ModelStatic<Session>;
  RefreshToken: ModelStatic<RefreshToken>;
}

export interface DbContext {
  sequelize: Sequelize;
  models: DbModels;
}

let sequelizeInstance: Sequelize | null = null;
let modelsInstance: DbModels | null = null;

/**
 * Initialize Sequelize and all models.
 * Call this once at application startup.
 */
export const initDatabase = (config: DatabaseConfig): DbContext => {
  if (sequelizeInstance && modelsInstance) {
    return { sequelize: sequelizeInstance, models: modelsInstance };
  }

  if (config.uri) {
    sequelizeInstance = new Sequelize(config.uri, {
      logging: false,
      ...(config.options ?? {}),
    });
  } else if (config.database && config.username !== undefined) {
    sequelizeInstance = new Sequelize(
      config.database,
      config.username,
      config.password ?? '',
      {
        logging: false,
        ...(config.options ?? {}),
      }
    );
  } else {
    throw new Error(
      'Invalid database configuration: provide either uri or (database, username[, password])'
    );
  }

  const sequelize = sequelizeInstance;

  const UserModel = initUserModel(sequelize);
  const PostModel = initPostModel(sequelize);
  const CommentModel = initCommentModel(sequelize);
  const ProfileModel = initProfileModel(sequelize);
  const TagModel = initTagModel(sequelize);
  const PostTagModel = initPostTagModel(sequelize);
  const SessionModel = initSessionModel(sequelize);
  const RefreshTokenModel = initRefreshTokenModel(sequelize);

  // Associations

  // User 1:N Post
  UserModel.hasMany(PostModel, {
    foreignKey: 'userId',
    as: 'posts',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PostModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'author',
  });

  // User 1:N Comment
  UserModel.hasMany(CommentModel, {
    foreignKey: 'userId',
    as: 'comments',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  CommentModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user',
  });

  // Post 1:N Comment
  PostModel.hasMany(CommentModel, {
    foreignKey: 'postId',
    as: 'comments',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  CommentModel.belongsTo(PostModel, {
    foreignKey: 'postId',
    as: 'post',
  });

  // User 1:1 Profile
  UserModel.hasOne(ProfileModel, {
    foreignKey: 'userId',
    as: 'profile',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  ProfileModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user',
  });

  // Post N:M Tag through PostTag
  PostModel.belongsToMany(TagModel, {
    through: PostTagModel,
    foreignKey: 'postId',
    otherKey: 'tagId',
    as: 'tags',
  });
  TagModel.belongsToMany(PostModel, {
    through: PostTagModel,
    foreignKey: 'tagId',
    otherKey: 'postId',
    as: 'posts',
  });

  // User 1:N Session
  UserModel.hasMany(SessionModel, {
    foreignKey: 'userId',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  SessionModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user',
  });

  // User 1:N RefreshToken
  UserModel.hasMany(RefreshTokenModel, {
    foreignKey: 'userId',
    as: 'refreshTokens',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  RefreshTokenModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user',
  });

  modelsInstance = {
    User: UserModel,
    Post: PostModel,
    Comment: CommentModel,
    Profile: ProfileModel,
    Tag: TagModel,
    PostTag: PostTagModel,
    Session: SessionModel,
    RefreshToken: RefreshTokenModel,
  };

  return { sequelize, models: modelsInstance };
};

/**
 * Get initialized Sequelize instance and models.
 * Ensure initDatabase has been called before using this.
 */
export const getDb = (): DbContext => {
  if (!sequelizeInstance || !modelsInstance) {
    throw new Error(
      'Database has not been initialized. Call initDatabase(config) first.'
    );
  }

  return {
    sequelize: sequelizeInstance,
    models: modelsInstance,
  };
};

/**
 * Sync database schema.
 * Use in development or controlled migration workflows.
 */
export const syncDatabase = async (options?: {
  force?: boolean;
  alter?: boolean;
}): Promise<void> => {
  const { sequelize } = getDb();
  await sequelize.sync({
    force: options?.force ?? false,
    alter: options?.alter ?? false,
  });
};

export type {
  User,
  Post,
  Comment,
  Profile,
  Tag,
  PostTag,
  Session,
  RefreshToken,
};