import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "./Project";
import { Task } from "./Task";

export type WorkflowStatusCategory = "todo" | "in-progress" | "done";

@Entity({ name: "workflow_statuses" })
@Index(["projectId", "order"], { unique: true })
@Index(["projectId", "name"], { unique: true })
export class WorkflowStatus {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  @Index()
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.workflowStatuses, {
    onDelete: "CASCADE",
  })
  project!: Project;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({
    type: "varchar",
    length: 20,
  })
  category!: WorkflowStatusCategory;

  @Column({ type: "int" })
  order!: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  color!: string | null;

  @OneToMany(() => Task, (task) => task.workflowStatus)
  tasks!: Task[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

export interface WorkflowStatusCreateInput {
  projectId: string;
  name: string;
  category: WorkflowStatusCategory;
  order: number;
  color?: string | null;
}

export interface WorkflowStatusUpdateInput {
  name?: string;
  category?: WorkflowStatusCategory;
  order?: number;
  color?: string | null;
}