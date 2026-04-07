import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  Association,
  NonAttribute,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional
} from 'sequelize';
import { User } from './User';
import { Project } from './Project';

export type ProjectMemberRole = 'admin' | 'member' | 'viewer';

export interface ProjectMemberAttributes {
  id: number;
  projectId: number;
  userId: number;
  role: ProjectMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectMemberCreationAttributes = Optional<
  ProjectMemberAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export class ProjectMember
  extends Model<InferAttributes<ProjectMember>, InferCreationAttributes<ProjectMember>>
  implements ProjectMemberAttributes
{
  declare id: CreationOptional<number>;
  declare projectId: ForeignKey<Project['id']>;
  declare userId: ForeignKey<User['id']>;
  declare role: ProjectMemberRole;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare project?: NonAttribute<Project>;

  declare static associations: {
    user: Association<ProjectMember, User>;
    project: Association<ProjectMember, Project>;
  };

  static initModel(sequelize: Sequelize): typeof ProjectMember {
    ProjectMember.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true
        },
        projectId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'projects',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        role: {
          type: DataTypes.ENUM('admin', 'member', 'viewer'),
          allowNull: false,
          defaultValue: 'member'
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        tableName: 'project_members',
        modelName: 'ProjectMember',
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ['projectId', 'userId']
          },
          {
            fields: ['userId']
          },
          {
            fields: ['projectId']
          },
          {
            fields: ['role']
          }
        ]
      }
    );

    return ProjectMember;
  }

  static associate(): void {
    ProjectMember.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user'
    });

    ProjectMember.belongsTo(Project, {
      foreignKey: 'projectId',
      as: 'project'
    });

    Project.hasMany(ProjectMember, {
      foreignKey: 'projectId',
      as: 'members'
    });

    User.hasMany(ProjectMember, {
      foreignKey: 'userId',
      as: 'projectMemberships'
    });
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  isViewer(): boolean {
    return this.role === 'viewer';
  }

  canManageProject(): boolean {
    return this.role === 'admin';
  }

  canEditContent(): boolean {
    return this.role === 'admin' || this.role === 'member';
  }

  canViewProject(): boolean {
    return true;
  }
}

export const initProjectMemberModel = (sequelize: Sequelize): typeof ProjectMember => {
  return ProjectMember.initModel(sequelize);
};