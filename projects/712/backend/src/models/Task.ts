import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional
} from "sequelize";

export enum TaskType {
  STORY = "STORY",
  BUG = "BUG",
  TASK = "TASK",
  SUBTASK = "SUBTASK"
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

export interface TaskAttributes {
  id: number;
  key: string;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: TaskPriority;
  statusId: number;
  storyPoints?: number | null;
  estimatedHours?: number | null;
  remainingHours?: number | null;
  dueDate?: Date | null;
  assigneeId?: number | null;
  reporterId?: number | null;
  boardId: number;
  columnId: number;
  sprintId?: number | null;
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskCreationAttributes = Optional<
  TaskAttributes,
  | "id"
  | "description"
  | "storyPoints"
  | "estimatedHours"
  | "remainingHours"
  | "dueDate"
  | "assigneeId"
  | "reporterId"
  | "sprintId"
  | "createdAt"
  | "updatedAt"
>;

export class Task
  extends Model<InferAttributes<Task>, InferCreationAttributes<Task>>
  implements TaskAttributes
{
  declare id: CreationOptional<number>;
  declare key: string;
  declare title: string;
  declare description: string | null;
  declare type: TaskType;
  declare priority: TaskPriority;
  declare statusId: number;
  declare storyPoints: number | null;
  declare estimatedHours: number | null;
  declare remainingHours: number | null;
  declare dueDate: Date | null;
  declare assigneeId: number | null;
  declare reporterId: number | null;
  declare boardId: number;
  declare columnId: number;
  declare sprintId: number | null;
  declare position: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Task {
    Task.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true
        },
        key: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        type: {
          type: DataTypes.ENUM(...Object.values(TaskType)),
          allowNull: false,
          defaultValue: TaskType.TASK
        },
        priority: {
          type: DataTypes.ENUM(...Object.values(TaskPriority)),
          allowNull: false,
          defaultValue: TaskPriority.MEDIUM
        },
        statusId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false
        },
        storyPoints: {
          type: DataTypes.FLOAT,
          allowNull: true,
          validate: {
            min: 0
          }
        },
        estimatedHours: {
          type: DataTypes.FLOAT,
          allowNull: true,
          validate: {
            min: 0
          }
        },
        remainingHours: {
          type: DataTypes.FLOAT,
          allowNull: true,
          validate: {
            min: 0
          }
        },
        dueDate: {
          type: DataTypes.DATE,
          allowNull: true
        },
        assigneeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true
        },
        reporterId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true
        },
        boardId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false
        },
        columnId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false
        },
        sprintId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true
        },
        position: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0
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
        tableName: "Tasks",
        modelName: "Task",
        indexes: [
          { fields: ["key"], unique: true },
          { fields: ["boardId"] },
          { fields: ["columnId"] },
          { fields: ["sprintId"] },
          { fields: ["assigneeId"] },
          { fields: ["reporterId"] },
          { fields: ["statusId"] },
          { fields: ["boardId", "columnId", "position"] }
        ]
      }
    );

    return Task;
  }
}