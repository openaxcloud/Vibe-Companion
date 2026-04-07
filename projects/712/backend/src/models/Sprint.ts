import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Project } from "./Project";
import { Task } from "./Task";

export type SprintStatus = "planned" | "active" | "closed";

@Entity({ name: "sprints" })
@Index(["projectId", "startDate", "endDate"])
export class Sprint {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  @Index()
  name!: string;

  @Column({ type: "uuid" })
  @Index()
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.sprints, {
    onDelete: "CASCADE",
    nullable: false,
  })
  project!: Project;

  @Column({ type: "timestamptz" })
  startDate!: Date;

  @Column({ type: "timestamptz" })
  endDate!: Date;

  @Column({ type: "text", nullable: true })
  goal: string | null = null;

  @Column({
    type: "varchar",
    length: 20,
    default: "planned",
  })
  @Index()
  status!: SprintStatus;

  @OneToMany(() => Task, (task) => task.sprint, {
    cascade: false,
  })
  tasks!: Task[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}