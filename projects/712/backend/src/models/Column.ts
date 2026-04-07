import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  Association,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyHasAssociationMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import { Task } from './Task';
import { Board } from './Board';
import { WorkflowStatus } from './WorkflowStatus';

export interface ColumnAttributes {
  id: string;
  title: string;
  boardId: string;
  workflowStatusId: string | null;
  wipLimit: number | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnCreationAttributes
  extends Optional<
    ColumnAttributes,
    'id' | 'workflowStatusId' | 'wipLimit' | 'order' | 'createdAt' | 'updatedAt'
  > {
  title: string;
  boardId: string;
}

export class Column
  extends Model<ColumnAttributes, ColumnCreationAttributes>
  implements ColumnAttributes
{
  public id!: string;
  public title!: string;
  public boardId!: string;
  public workflowStatusId!: string | null;
  public wipLimit!: number | null;
  public order!: number;
  public createdAt!: Date;
  public updatedAt!: Date;

  public readonly tasks?: Task[];

  public getTasks!: HasManyGetAssociationsMixin<Task>;
  public addTask!: HasManyAddAssociationMixin<Task, string>;
  public hasTask!: HasManyHasAssociationMixin<Task, string>;
  public countTasks!: HasManyCountAssociationsMixin;
  public createTask!: HasManyCreateAssociationMixin<Task>;

  public getBoard!: BelongsToGetAssociationMixin<Board>;
  public setBoard!: BelongsToSetAssociationMixin<Board, string>;
  public createBoard!: BelongsToCreateAssociationMixin<Board>;

  public getWorkflowStatus!: BelongsToGetAssociationMixin<WorkflowStatus>;
  public setWorkflowStatus!: BelongsToSetAssociationMixin<WorkflowStatus, string>;
  public createWorkflowStatus!: BelongsToCreateAssociationMixin<WorkflowStatus>;

  public static associations: {
    tasks: Association<Column, Task>;
    board: Association<Column, Board>;
    workflowStatus: Association<Column, WorkflowStatus>;
  };

  public static initialize(sequelize: Sequelize): typeof Column {
    Column.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: true,
            len: [1, 255],
          },
        },
        boardId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        workflowStatusId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        wipLimit: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
          },
        },
        order: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
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
        tableName: 'columns',
        modelName: 'Column',
        timestamps: true,
        indexes: [
          {
            name: 'columns_board_order_idx',
            fields: ['boardId', 'order'],
          },
          {
            name: 'columns_workflow_status_idx',
            fields: ['workflowStatusId'],
          },
        ],
        defaultScope: {
          order: [['order', 'ASC']],
        },
      }
    );

    return Column;
  }

  public static associate(): void {
    Column.belongsTo(Board, {
      foreignKey: 'boardId',
      as: 'board',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Column.belongsTo(WorkflowStatus, {
      foreignKey: 'workflowStatusId',
      as: 'workflowStatus',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    Column.hasMany(Task, {
      foreignKey: 'columnId',
      as: 'tasks',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }

  public static async getColumnsWithTasksByBoardId(
    boardId: string
  ): Promise<Column[]> {
    return Column.findAll({
      where: { boardId },
      include: [
        {
          model: Task,
          as: 'tasks',
          separate: true,
          order: [['position', 'ASC']],
        },
      ],
      order: [['order', 'ASC']],
    });
  }

  public static async getMaxOrderForBoard(boardId: string): Promise<number> {
    const maxOrderResult = await Column.findOne({
      where: { boardId },
      order: [['order', 'DESC']],
    });

    return maxOrderResult ? maxOrderResult.order : 0;
  }

  public static async reorderColumns(
    boardId: string,
    orderedColumnIds: string[]
  ): Promise<void> {
    const transaction = await Column.sequelize!.transaction();
    try {
      for (let index = 0; index < orderedColumnIds.length; index += 1) {
        const columnId = orderedColumnIds[index];
        await Column.update(
          { order: index },
          {
            where: { id: columnId, boardId },
            transaction,
          }
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public static async enforceWipLimit(columnId: string): Promise<boolean> {
    const column = await Column.findByPk(columnId, {
      include: [{ model: Task, as: 'tasks' }],
    });

    if (!column) {
      return false;
    }

    if (column.wipLimit == null) {
      return true;
    }

    const activeTasksCount = (column.tasks ?? []).length;
    return activeTasksCount <= column.wipLimit;
  }
}

export default Column;