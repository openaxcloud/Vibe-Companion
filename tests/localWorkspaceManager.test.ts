import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

// Mock child_process to prevent real process spawning
vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  })),
  execSync: vi.fn(),
}));

// Mock the index log function
vi.mock("../server/index", () => ({
  log: vi.fn(),
}));

describe("localWorkspaceManager", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getLocalWorkspace", () => {
    it("returns undefined for unknown project", async () => {
      const { getLocalWorkspace } = await import("../server/localWorkspaceManager");
      expect(getLocalWorkspace("non-existent-project-id")).toBeUndefined();
    });
  });

  describe("getLocalWorkspaceStatus", () => {
    it("returns 'none' for unknown project", async () => {
      const { getLocalWorkspaceStatus } = await import("../server/localWorkspaceManager");
      expect(getLocalWorkspaceStatus("unknown-id")).toBe("none");
    });
  });

  describe("getLocalWorkspacePort", () => {
    it("returns null for unknown project", async () => {
      const { getLocalWorkspacePort } = await import("../server/localWorkspaceManager");
      expect(getLocalWorkspacePort("unknown-id")).toBeNull();
    });
  });

  describe("getLocalWorkspaceLogs", () => {
    it("returns empty array for unknown project", async () => {
      const { getLocalWorkspaceLogs } = await import("../server/localWorkspaceManager");
      expect(getLocalWorkspaceLogs("unknown-id")).toEqual([]);
    });
  });

  describe("getAllLocalWorkspaces", () => {
    it("returns a Map", async () => {
      const { getAllLocalWorkspaces } = await import("../server/localWorkspaceManager");
      const workspaces = getAllLocalWorkspaces();
      expect(workspaces).toBeInstanceOf(Map);
    });
  });

  describe("hasRunnableFiles", () => {
    it("returns false for empty directory", async () => {
      const { hasRunnableFiles } = await import("../server/localWorkspaceManager");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-test-"));
      try {
        expect(hasRunnableFiles(tmpDir)).toBe(false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("returns true for directory with package.json", async () => {
      const { hasRunnableFiles } = await import("../server/localWorkspaceManager");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-test-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
        expect(hasRunnableFiles(tmpDir)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("returns true for directory with index.py", async () => {
      const { hasRunnableFiles } = await import("../server/localWorkspaceManager");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-test-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "index.py"), "print('hello')");
        expect(hasRunnableFiles(tmpDir)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  describe("getWorkspaceDir", () => {
    it("returns a path string containing the project id", async () => {
      const { getWorkspaceDir } = await import("../server/localWorkspaceManager");
      const projectId = "test-project-123";
      const dir = getWorkspaceDir(projectId);
      expect(typeof dir).toBe("string");
      expect(dir).toContain(projectId);
    });
  });
});
