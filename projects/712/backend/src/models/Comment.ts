import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  Association,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import { User } from './User';
import { Task } from './Task';

export interface CommentAttributes {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentCreationAttributes = Optional<CommentAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class Comment
  extends Model<CommentAttributes, CommentCreationAttributes>
  implements CommentAttributes
{
  public id!: string;
  public taskId!: string;
  public userId!: string;
  public body!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  public readonly user?: User;
  public readonly task?: Task;

  public getUser!: BelongsToGetAssociationMixin<User>;
  public setUser!: BelongsToSetAssociationMixin<User, string>;
  public createUser!: BelongsToCreateAssociationMixin<User>;

  public getTask!: BelongsToGetAssociationMixin<Task>;
  public setTask!: BelongsToSetAssociationMixin<Task, string>;
  public createTask!: BelongsToCreateAssociationMixin<Task>;

  public static associations: {
    user: Association<Comment, User>;
    task: Association<Comment, Task>;
  };

  public static initialize(sequelize: Sequelize): void {
    Comment.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        taskId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Comment body must not be empty',
            },
            len: {
              args: [1, 5000],
              msg: 'Comment body must be between 1 and 5000 characters',
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
        tableName: 'comments',
        modelName: 'Comment',
        timestamps: true,
        indexes: [
          {
            fields: ['taskId'],
          },
          {
            fields: ['userId'],
          },
          {
            fields: ['taskId', 'createdAt'],
          },
        ],
      }
    );
  }

  public static associate(): void {
    Comment.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Comment.belongsTo(Task, {
      foreignKey: 'taskId',
      as: 'task',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }
}

export default Comment;