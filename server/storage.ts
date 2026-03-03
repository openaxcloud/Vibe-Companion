import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, files, runs,
  type User, type InsertUser,
  type Project, type InsertProject,
  type File, type InsertFile,
  type Run, type InsertRun,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(userId: string, data: InsertProject): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  duplicateProject(id: string, userId: string): Promise<Project | undefined>;

  getFiles(projectId: string): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(projectId: string, data: InsertFile): Promise<File>;
  updateFileContent(id: string, content: string): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;

  createRun(userId: string, data: InsertRun): Promise<Run>;
  updateRun(id: string, data: Partial<Run>): Promise<Run | undefined>;
  getRun(id: string): Promise<Run | undefined>;
  getRunsByProject(projectId: string): Promise<Run[]>;

  getDemoProject(): Promise<Project | undefined>;
  seedDemoProject(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getProjects(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return project;
  }

  async createProject(userId: string, data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values({
      ...data,
      userId,
    }).returning();

    const defaultFilename = data.language === "python" ? "main.py" : "index.ts";
    const defaultContent = data.language === "python"
      ? `print("Hello from Vibe Platform!")\n`
      : `console.log("Hello from Vibe Platform!");\n`;

    await db.insert(files).values({
      projectId: project.id,
      filename: defaultFilename,
      content: defaultContent,
    });

    return project;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);
    if (!project) return false;

    await db.delete(files).where(eq(files.projectId, id));
    await db.delete(runs).where(eq(runs.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
    return true;
  }

  async duplicateProject(id: string, userId: string): Promise<Project | undefined> {
    const original = await this.getProject(id);
    if (!original) return undefined;

    const [newProject] = await db.insert(projects).values({
      userId,
      name: `${original.name} (copy)`,
      language: original.language,
    }).returning();

    const originalFiles = await this.getFiles(id);
    for (const file of originalFiles) {
      await db.insert(files).values({
        projectId: newProject.id,
        filename: file.filename,
        content: file.content,
      });
    }

    return newProject;
  }

  async getFiles(projectId: string): Promise<File[]> {
    return db.select().from(files).where(eq(files.projectId, projectId));
  }

  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    return file;
  }

  async createFile(projectId: string, data: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values({
      ...data,
      projectId,
    }).returning();
    return file;
  }

  async updateFileContent(id: string, content: string): Promise<File | undefined> {
    const [file] = await db.update(files)
      .set({ content, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    if (file) {
      await db.update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, file.projectId));
    }
    return file;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id)).returning();
    return result.length > 0;
  }

  async createRun(userId: string, data: InsertRun): Promise<Run> {
    const [run] = await db.insert(runs).values({
      ...data,
      userId,
      status: "running",
    }).returning();
    return run;
  }

  async updateRun(id: string, data: Partial<Run>): Promise<Run | undefined> {
    const [run] = await db.update(runs)
      .set(data)
      .where(eq(runs.id, id))
      .returning();
    return run;
  }

  async getRun(id: string): Promise<Run | undefined> {
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    return run;
  }

  async getRunsByProject(projectId: string): Promise<Run[]> {
    return db.select().from(runs)
      .where(eq(runs.projectId, projectId))
      .orderBy(desc(runs.startedAt))
      .limit(20);
  }

  async getDemoProject(): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.isDemo, true)).limit(1);
    return project;
  }

  async seedDemoProject(): Promise<void> {
    const existing = await this.getDemoProject();
    if (existing) return;

    const [demoProject] = await db.insert(projects).values({
      userId: "demo",
      name: "hello-world-demo",
      language: "javascript",
      isDemo: true,
    }).returning();

    await db.insert(files).values([
      {
        projectId: demoProject.id,
        filename: "index.js",
        content: `// Welcome to Vibe Platform!\n// This is a read-only demo project.\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);\n}\n\nconsole.log("\\nHello from Vibe Platform! 🚀");\n`,
      },
      {
        projectId: demoProject.id,
        filename: "utils.js",
        content: `// Utility functions\n\nfunction formatDate(date) {\n  return new Intl.DateTimeFormat('en-US', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  }).format(date);\n}\n\nconsole.log("Today is:", formatDate(new Date()));\n`,
      },
    ]);
  }
}

export const storage = new DatabaseStorage();
