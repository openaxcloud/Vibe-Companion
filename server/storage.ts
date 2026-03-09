import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, projects, files, runs, workspaces, workspaceSessions,
  commits, branches,
  type User, type InsertUser,
  type Project, type InsertProject,
  type File, type InsertFile,
  type Run, type InsertRun,
  type Workspace, type InsertWorkspace,
  type WorkspaceSession, type InsertWorkspaceSession,
  type Commit, type InsertCommit,
  type Branch, type InsertBranch,
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

  renameFile(id: string, filename: string): Promise<File | undefined>;
  updateProject(id: string, data: Partial<{ name: string; language: string }>): Promise<Project | undefined>;

  createRun(userId: string, data: InsertRun): Promise<Run>;
  updateRun(id: string, data: Partial<Run>): Promise<Run | undefined>;
  getRun(id: string): Promise<Run | undefined>;
  getRunsByProject(projectId: string): Promise<Run[]>;

  publishProject(id: string, userId: string): Promise<Project | undefined>;
  getPublishedProject(id: string): Promise<{project: Project, files: File[]} | undefined>;

  getWorkspaceByProject(projectId: string): Promise<Workspace | undefined>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(data: InsertWorkspace): Promise<Workspace>;
  updateWorkspaceStatus(id: string, statusCache: string): Promise<Workspace | undefined>;
  touchWorkspace(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<boolean>;

  createWorkspaceSession(data: InsertWorkspaceSession): Promise<WorkspaceSession>;
  getWorkspaceSession(id: string): Promise<WorkspaceSession | undefined>;

  getDemoProject(): Promise<Project | undefined>;
  seedDemoProject(): Promise<void>;

  getCommits(projectId: string, branchName?: string): Promise<Commit[]>;
  getCommit(id: string): Promise<Commit | undefined>;
  createCommit(data: InsertCommit): Promise<Commit>;
  getBranches(projectId: string): Promise<Branch[]>;
  getBranch(projectId: string, name: string): Promise<Branch | undefined>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranchHead(id: string, headCommitId: string): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
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
      ? `print("Hello from Replit!")\n`
      : `console.log("Hello from Replit!");\n`;

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

    const ws = await this.getWorkspaceByProject(id);
    if (ws) {
      await db.delete(workspaceSessions).where(eq(workspaceSessions.workspaceId, ws.id));
      await db.delete(workspaces).where(eq(workspaces.id, ws.id));
    }
    await db.delete(commits).where(eq(commits.projectId, id));
    await db.delete(branches).where(eq(branches.projectId, id));
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

  async renameFile(id: string, filename: string): Promise<File | undefined> {
    const [file] = await db.update(files)
      .set({ filename, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file;
  }

  async updateProject(id: string, data: Partial<{ name: string; language: string }>): Promise<Project | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.language) updates.language = data.language;
    const [project] = await db.update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return project;
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

  async publishProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);
    if (!project) return undefined;

    const [updated] = await db.update(projects)
      .set({ isPublished: !project.isPublished, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async getPublishedProject(id: string): Promise<{project: Project, files: File[]} | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.isPublished, true)))
      .limit(1);
    if (!project) return undefined;

    const fileList = await db.select().from(files).where(eq(files.projectId, id));
    return { project, files: fileList };
  }

  async getWorkspaceByProject(projectId: string): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId)).limit(1);
    return ws;
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    return ws;
  }

  async createWorkspace(data: InsertWorkspace): Promise<Workspace> {
    const [ws] = await db.insert(workspaces).values(data).returning();
    return ws;
  }

  async updateWorkspaceStatus(id: string, statusCache: string): Promise<Workspace | undefined> {
    const [ws] = await db.update(workspaces)
      .set({ statusCache, lastSeenAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return ws;
  }

  async touchWorkspace(id: string): Promise<void> {
    await db.update(workspaces)
      .set({ lastSeenAt: new Date() })
      .where(eq(workspaces.id, id));
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    await db.delete(workspaceSessions).where(eq(workspaceSessions.workspaceId, id));
    const result = await db.delete(workspaces).where(eq(workspaces.id, id)).returning();
    return result.length > 0;
  }

  async createWorkspaceSession(data: InsertWorkspaceSession): Promise<WorkspaceSession> {
    const [session] = await db.insert(workspaceSessions).values(data).returning();
    return session;
  }

  async getWorkspaceSession(id: string): Promise<WorkspaceSession | undefined> {
    const [session] = await db.select().from(workspaceSessions).where(eq(workspaceSessions.id, id)).limit(1);
    return session;
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
        content: `// Welcome to Replit!\n// This is a read-only demo project.\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);\n}\n\nconsole.log("\\nHello from Replit!");\n`,
      },
      {
        projectId: demoProject.id,
        filename: "utils.js",
        content: `// Utility functions\n\nfunction formatDate(date) {\n  return new Intl.DateTimeFormat('en-US', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  }).format(date);\n}\n\nconsole.log("Today is:", formatDate(new Date()));\n`,
      },
    ]);
  }
  async getCommits(projectId: string, branchName?: string): Promise<Commit[]> {
    if (branchName) {
      return db.select().from(commits)
        .where(and(eq(commits.projectId, projectId), eq(commits.branchName, branchName)))
        .orderBy(desc(commits.createdAt))
        .limit(50);
    }
    return db.select().from(commits)
      .where(eq(commits.projectId, projectId))
      .orderBy(desc(commits.createdAt))
      .limit(50);
  }

  async getCommit(id: string): Promise<Commit | undefined> {
    const [commit] = await db.select().from(commits).where(eq(commits.id, id)).limit(1);
    return commit;
  }

  async createCommit(data: InsertCommit): Promise<Commit> {
    const [commit] = await db.insert(commits).values(data).returning();
    return commit;
  }

  async getBranches(projectId: string): Promise<Branch[]> {
    return db.select().from(branches)
      .where(eq(branches.projectId, projectId))
      .orderBy(branches.createdAt);
  }

  async getBranch(projectId: string, name: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches)
      .where(and(eq(branches.projectId, projectId), eq(branches.name, name)))
      .limit(1);
    return branch;
  }

  async createBranch(data: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  }

  async updateBranchHead(id: string, headCommitId: string): Promise<Branch | undefined> {
    const [branch] = await db.update(branches)
      .set({ headCommitId })
      .where(eq(branches.id, id))
      .returning();
    return branch;
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
