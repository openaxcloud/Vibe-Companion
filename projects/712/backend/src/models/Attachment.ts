import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Task } from "./Task";
import { User } from "./User";

export type AttachmentStorageType = "storageKey" | "url";

@Entity({ name: "attachments" })
@Index(["taskId"])
@Index(["uploaderId"])
@Index(["storageKey"])
@Index(["url"])
export class Attachment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  taskId!: string;

  @ManyToOne(() => Task, (task) => task.attachments, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "taskId" })
  task!: Task;

  @Column({ type: "uuid" })
  uploaderId!: string;

  @ManyToOne(() => User, (user) => user.attachments, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "uploaderId" })
  uploader?: User | null;

  @Column({ type: "varchar", length: 512 })
  fileName!: string;

  @Column({ type: "bigint" })
  fileSize!: string;

  @Column({ type: "varchar", length: 255 })
  mimeType!: string;

  @Column({ type: "varchar", length: 1024, nullable: true })
  storageKey?: string | null;

  @Column({ type: "varchar", length: 2048, nullable: true })
  url?: string | null;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  get storageType(): AttachmentStorageType | null {
    if (this.storageKey) return "storageKey";
    if (this.url) return "url";
    return null;
  }

  toJSON(): AttachmentDTO {
    return {
      id: this.id,
      taskId: this.taskId,
      uploaderId: this.uploaderId,
      fileName: this.fileName,
      fileSize: typeof this.fileSize === "string" ? parseInt(this.fileSize, 10) : Number(this.fileSize),
      mimeType: this.mimeType,
      storageKey: this.storageKey ?? undefined,
      url: this.url ?? undefined,
      description: this.description ?? undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

export interface AttachmentDTO {
  id: string;
  taskId: string;
  uploaderId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey?: string;
  url?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttachmentInput {
  taskId: string;
  uploaderId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey?: string;
  url?: string;
  description?: string | null;
}

export interface UpdateAttachmentInput {
  fileName?: string;
  description?: string | null;
}