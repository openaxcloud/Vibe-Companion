import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from "typeorm";
import { Project } from "./Project";
import { Column as BoardColumn } from "./Column";
import { Task } from "./Task";

export type BoardType = "kanban" | "scrum";

@Entity({ name: "boards" })
@Index(["projectId", "orderIndex"])
@Index(["projectId", "name"], { unique: true })
export class Board extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "uuid" })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.boards, {
    onDelete: "CASCADE",
    nullable: false,
  })
  project!: Project;

  @Column({
    type: "enum",
    enum: ["kanban", "scrum"],
    default: "kanban",
  })
  type!: BoardType;

  @Column({ type: "int", name: "order_index" })
  orderIndex!: number;

  @OneToMany(() => BoardColumn, (column) => column.board, {
    cascade: ["insert", "update"],
  })
  columns!: BoardColumn[];

  @OneToMany(() => Task, (task) => task.board)
  tasks!: Task[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  static createForProject(params: {
    name: string;
    project: Project;
    type?: BoardType;
    orderIndex: number;
  }): Board {
    const board = new Board();
    board.name = params.name.trim();
    board.project = params.project;
    board.projectId = params.project.id;
    board.type = params.type ?? "kanban";
    board.orderIndex = params.orderIndex;
    return board;
  }

  static async getNextOrderIndex(projectId: string): Promise<number> {
    const result = await this.createQueryBuilder("board")
      .select("COALESCE(MAX(board.orderIndex) + 1, 0)", "next")
      .where("board.projectId = :projectId", { projectId })
      .getRawOne<{ next: string | number }>();

    const next = typeof result?.next === "string" ? parseInt(result.next, 10) : result?.next;
    return Number.isFinite(next) ? (next as number) : 0;
  }

  static async findById(id: string): Promise<Board | null> {
    return this.createQueryBuilder("board")
      .leftJoinAndSelect("board.columns", "columns")
      .leftJoinAndSelect("board.tasks", "tasks")
      .where("board.id = :id", { id })
      .orderBy("columns.orderIndex", "ASC")
      .getOne();
  }

  static async findByProject(projectId: string): Promise<Board[]> {
    return this.createQueryBuilder("board")
      .leftJoinAndSelect("board.columns", "columns")
      .where("board.projectId = :projectId", { projectId })
      .orderBy("board.orderIndex", "ASC")
      .addOrderBy("columns.orderIndex", "ASC")
      .getMany();
  }

  static async reorderBoards(projectId: string, orderedBoardIds: string[]): Promise<void> {
    if (!orderedBoardIds.length) return;

    await this.getRepository().manager.transaction(async (manager) => {
      const repo = manager.getRepository(Board);
      const boards = await repo.find({
        where: { projectId },
      });

      const boardById = new Map(boards.map((b) => [b.id, b]));
      let index = 0;

      for (const id of orderedBoardIds) {
        const board = boardById.get(id);
        if (!board) continue;
        if (board.orderIndex !== index) {
          board.orderIndex = index;
          await repo.save(board);
        }
        index += 1;
      }
    });
  }
}