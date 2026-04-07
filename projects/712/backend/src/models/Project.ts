import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  Association,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyHasAssociationMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToCreateAssociationMixin,
  NonAttribute,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { Board } from './Board';
import { Sprint } from './Sprint';
import { User } from './User';
import { ProjectMember } from './ProjectMember';

export interface ProjectAttributes {
  id: number;
  name: string;
  key: string;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectCreationAttributes = Optional<
  ProjectAttributes,
  'id' | 'description' | 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'
>;

export class Project
  extends Model<InferAttributes<Project>, InferCreationAttributes<Project>>
  implements ProjectAttributes
{
  declare id: CreationOptional<number>;
  declare name: string;
  declare key: string;
  declare description: string | null;
  declare startDate: Date | null;
  declare endDate: Date | null;
  declare ownerId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare owner?: NonAttribute<User>;
  declare boards?: NonAttribute<Board[]>;
  declare sprints?: NonAttribute<Sprint[]>;
  declare members?: NonAttribute<ProjectMember[]>;

  declare getOwner: BelongsToGetAssociationMixin<User>;
  declare createOwner: BelongsToCreateAssociationMixin<User>;

  declare getBoards: HasManyGetAssociationsMixin<Board>;
  declare addBoard: HasManyAddAssociationMixin<Board, number>;
  declare hasBoard: HasManyHasAssociationMixin<Board, number>;
  declare countBoards: HasManyCountAssociationsMixin;
  declare createBoard: HasManyCreateAssociationMixin<Board, 'projectId'>;

  declare getSprints: HasManyGetAssociationsMixin<Sprint>;
  declare addSprint: HasManyAddAssociationMixin<Sprint, number>;
  declare hasSprint: HasManyHasAssociationMixin<Sprint, number>;
  declare countSprints: HasManyCountAssociationsMixin;
  declare createSprint: HasManyCreateAssociationMixin<Sprint, 'projectId'>;

  declare getMembers: HasManyGetAssociationsMixin<ProjectMember>;
  declare addMember: HasManyAddAssociationMixin<ProjectMember, number>;
  declare hasMember: HasManyHasAssociationMixin<ProjectMember, number>;
  declare countMembers: HasManyCountAssociationsMixin;
  declare createMember: HasManyCreateAssociationMixin<ProjectMember, 'projectId'>;

  declare static associations: {
    owner: Association<Project, User>;
    boards: Association<Project, Board>;
    sprints: Association<Project, Sprint>;
    members: Association<Project, ProjectMember>;
  };

  static initModel(sequelize: Sequelize): typeof Project {
    Project.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        key: {
          type: DataTypes.STRING(32),
          allowNull: false,
          unique: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        startDate: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        endDate: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        ownerId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
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
        tableName: 'projects',
        modelName: 'Project',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['key'],
          },
          {
            fields: ['owner_id'],
          },
          {
            fields: ['start_date'],
          },
          {
            fields: ['end_date'],
          },
        ],
      }
    );

    return Project;
  }

  static associate(): void {
    Project.belongsTo(User, {
      as: 'owner',
      foreignKey: 'ownerId',
      targetKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Project.hasMany(Board, {
      as: 'boards',
      foreignKey: 'projectId',
      sourceKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Project.hasMany(Sprint, {
      as: 'sprints',
      foreignKey: 'projectId',
      sourceKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Project.hasMany(ProjectMember, {
      as: 'members',
      foreignKey: 'projectId',
      sourceKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }
}