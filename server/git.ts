import git from "isomorphic-git";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

type GitHttpClient = Parameters<typeof git.clone>[0]["http"];
let httpTransport: GitHttpClient | null = null;
async function getHttp(): Promise<GitHttpClient> {
  if (!httpTransport) {
    const mod = await import("isomorphic-git/http/node");
    httpTransport = ((mod as Record<string, unknown>).default || mod) as GitHttpClient;
  }
  return httpTransport!;
}

const projectDirs = new Map<string, string>();

export function getProjectDir(projectId: string): string {
  const safeId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, "_");
  let dir = projectDirs.get(safeId);
  if (!dir) {
    dir = path.join(os.tmpdir(), "git-repos", safeId);
    projectDirs.set(safeId, dir);
  }
  return dir;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  const normalized = path.posix.normalize(filename);
  if (normalized === "." || normalized === "..") return null;
  if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes("/../")) return null;
  if (normalized.includes("\\")) return null;
  if (normalized === ".git" || normalized.startsWith(".git/")) return null;
  return normalized;
}

function isPathSafe(dir: string, filePath: string): boolean {
  const resolved = path.resolve(dir, filePath);
  return resolved.startsWith(path.resolve(dir) + path.sep);
}

function serializeGitDir(dir: string): string {
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) return "";
  const entries: Array<{ p: string; d: string }> = [];
  function walk(current: string, rel: string) {
    const items = fs.readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(current, item.name);
      const relPath = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) {
        walk(fullPath, relPath);
      } else if (item.isFile()) {
        const data = fs.readFileSync(fullPath);
        entries.push({ p: relPath, d: data.toString("base64") });
      }
    }
  }
  walk(gitDir, "");
  return JSON.stringify(entries);
}

function deserializeGitDir(dir: string, packed: string): void {
  const gitDir = path.join(dir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }
  fs.mkdirSync(gitDir, { recursive: true });
  const entries: Array<{ p: string; d: string }> = JSON.parse(packed);
  for (const entry of entries) {
    const fullPath = path.join(gitDir, entry.p);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, Buffer.from(entry.d, "base64"));
  }
}

export async function initRepo(projectId: string, files: Array<{ filename: string; content: string }>, authorName: string = "User", authorEmail: string = "user@ide.local"): Promise<void> {
  const dir = getProjectDir(projectId);
  ensureDir(dir);

  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    await git.init({ fs, dir, defaultBranch: "main" });
  }

  for (const file of files) {
    const safeName = sanitizeFilename(file.filename);
    if (!safeName || !isPathSafe(dir, safeName)) continue;
    const filePath = path.join(dir, safeName);
    const fileDir = path.dirname(filePath);
    ensureDir(fileDir);
    fs.writeFileSync(filePath, file.content, "utf-8");
  }
}

export async function syncFilesToWorkingTree(projectId: string, files: Array<{ filename: string; content: string }>): Promise<void> {
  const dir = getProjectDir(projectId);
  ensureDir(dir);

  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    await git.init({ fs, dir, defaultBranch: "main" });
  }

  const safeFiles = files
    .map(f => ({ filename: sanitizeFilename(f.filename), content: f.content }))
    .filter((f): f is { filename: string; content: string } => f.filename !== null && isPathSafe(dir, f.filename));

  const existingFiles = getAllFiles(dir, dir).filter(f => !f.startsWith(".git"));
  const newFilenames = new Set(safeFiles.map(f => f.filename));

  for (const existing of existingFiles) {
    if (!newFilenames.has(existing)) {
      const fullPath = path.join(dir, existing);
      if (fs.existsSync(fullPath) && isPathSafe(dir, existing)) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  for (const file of safeFiles) {
    const filePath = path.join(dir, file.filename);
    const fileDir = path.dirname(filePath);
    ensureDir(fileDir);
    fs.writeFileSync(filePath, file.content, "utf-8");
  }
}

function getAllFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

export async function addAndCommit(
  projectId: string,
  message: string,
  authorName: string = "User",
  authorEmail: string = "user@ide.local",
  selectedFiles?: string[]
): Promise<{ sha: string; message: string; author: string; date: string }> {
  const dir = getProjectDir(projectId);

  if (selectedFiles && selectedFiles.length === 0) {
    throw new Error("No files selected for commit");
  }

  if (selectedFiles && selectedFiles.length > 0) {
    const safeSelected = new Set(
      selectedFiles
        .map(f => sanitizeFilename(f))
        .filter((f): f is string => f !== null && isPathSafe(dir, f))
    );

    const statusMatrix = await git.statusMatrix({ fs, dir });
    for (const [filepath, head, workdir, stage] of statusMatrix) {
      if (!safeSelected.has(filepath)) continue;
      if (head === 1 && workdir === 0) {
        await git.remove({ fs, dir, filepath });
      } else if (workdir === 2) {
        await git.add({ fs, dir, filepath });
      }
    }
  } else {
    const allFiles = getAllFiles(dir, dir);
    for (const filepath of allFiles) {
      await git.add({ fs, dir, filepath });
    }

    const statusMatrix = await git.statusMatrix({ fs, dir });
    for (const [filepath, head, workdir, stage] of statusMatrix) {
      if (head === 1 && workdir === 0) {
        await git.remove({ fs, dir, filepath });
      }
    }
  }

  const sha = await git.commit({
    fs,
    dir,
    message,
    author: { name: authorName, email: authorEmail },
  });

  return {
    sha,
    message,
    author: authorName,
    date: new Date().toISOString(),
  };
}

export async function getLog(projectId: string, branch?: string, depth: number = 50): Promise<Array<{
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  parentSha: string | null;
}>> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) return [];

  try {
    const ref = branch || await getCurrentBranch(projectId) || "HEAD";
    let logs;
    try {
      logs = await git.log({ fs, dir, ref, depth });
    } catch {
      try {
        logs = await git.log({ fs, dir, depth });
      } catch {
        return [];
      }
    }
    return logs.map(entry => ({
      sha: entry.oid,
      message: entry.commit.message.trim(),
      author: entry.commit.author.name,
      authorEmail: entry.commit.author.email,
      date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
      parentSha: entry.commit.parent.length > 0 ? entry.commit.parent[0] : null,
    }));
  } catch {
    return [];
  }
}

export async function listBranches(projectId: string): Promise<Array<{ name: string; current: boolean }>> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) return [];

  try {
    const branches = await git.listBranches({ fs, dir });
    if (branches.length === 0) return [];

    let currentBranch: string | undefined;
    try {
      currentBranch = await git.currentBranch({ fs, dir }) || undefined;
    } catch {}

    return branches.map(name => ({
      name,
      current: name === currentBranch,
    }));
  } catch {
    return [];
  }
}

export async function getCurrentBranch(projectId: string): Promise<string | null> {
  const dir = getProjectDir(projectId);
  try {
    return await git.currentBranch({ fs, dir }) || null;
  } catch {
    return null;
  }
}

export async function createBranch(projectId: string, branchName: string, fromBranch?: string): Promise<void> {
  const dir = getProjectDir(projectId);
  if (fromBranch) {
    try {
      const oid = await git.resolveRef({ fs, dir, ref: fromBranch });
      await git.branch({ fs, dir, ref: branchName, object: oid });
    } catch {
      await git.branch({ fs, dir, ref: branchName });
    }
  } else {
    await git.branch({ fs, dir, ref: branchName });
  }
}

export async function deleteBranch(projectId: string, branchName: string): Promise<void> {
  const dir = getProjectDir(projectId);
  await git.deleteBranch({ fs, dir, ref: branchName });
}

export async function checkoutBranch(projectId: string, branchName: string): Promise<void> {
  const dir = getProjectDir(projectId);
  await git.checkout({ fs, dir, ref: branchName, force: true });
}

export async function checkoutCommit(projectId: string, sha: string): Promise<void> {
  const dir = getProjectDir(projectId);
  await git.checkout({ fs, dir, ref: sha, force: true });
}

export async function getStatus(projectId: string): Promise<Array<{
  filename: string;
  status: "added" | "modified" | "deleted" | "unmodified";
}>> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) return [];

  try {
    const matrix = await git.statusMatrix({ fs, dir });
    const results: Array<{ filename: string; status: "added" | "modified" | "deleted" | "unmodified" }> = [];

    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === 0 && workdir === 2) {
        results.push({ filename: filepath, status: "added" });
      } else if (head === 1 && workdir === 2) {
        results.push({ filename: filepath, status: "modified" });
      } else if (head === 1 && workdir === 0) {
        results.push({ filename: filepath, status: "deleted" });
      }
    }

    return results;
  } catch {
    return [];
  }
}

export async function getDiff(projectId: string, branch?: string): Promise<{
  branch: string;
  changes: Array<{ filename: string; status: "added" | "modified" | "deleted"; oldContent?: string; newContent?: string }>;
  hasCommits: boolean;
}> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    return { branch: branch || "", changes: [], hasCommits: false };
  }
  const branchName = branch || await getCurrentBranch(projectId) || "";

  let hasCommits = false;
  try {
    const logs = await git.log({ fs, dir, depth: 1 });
    hasCommits = logs.length > 0;
  } catch {}

  if (!hasCommits) {
    return { branch: branchName, changes: [], hasCommits: false };
  }

  try {
    const matrix = await git.statusMatrix({ fs, dir });
    const changes: Array<{ filename: string; status: "added" | "modified" | "deleted"; oldContent?: string; newContent?: string }> = [];

    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === 0 && workdir === 2) {
        const newContent = fs.readFileSync(path.join(dir, filepath), "utf-8");
        changes.push({ filename: filepath, status: "added", newContent });
      } else if (head === 1 && workdir === 2) {
        const newContent = fs.readFileSync(path.join(dir, filepath), "utf-8");
        let oldContent = "";
        try {
          const headCommit = await git.resolveRef({ fs, dir, ref: "HEAD" });
          const { blob } = await git.readBlob({ fs, dir, oid: headCommit, filepath });
          oldContent = new TextDecoder().decode(blob);
        } catch {}
        changes.push({ filename: filepath, status: "modified", oldContent, newContent });
      } else if (head === 1 && workdir === 0) {
        let oldContent = "";
        try {
          const headCommit = await git.resolveRef({ fs, dir, ref: "HEAD" });
          const { blob } = await git.readBlob({ fs, dir, oid: headCommit, filepath });
          oldContent = new TextDecoder().decode(blob);
        } catch {}
        changes.push({ filename: filepath, status: "deleted", oldContent });
      }
    }

    return { branch: branchName, changes, hasCommits };
  } catch {
    return { branch: branchName, changes: [], hasCommits };
  }
}

function findLineInTracked(trackedLines: string[], targetLine: string, preferIdx: number, usedMap: Map<number, number>): number {
  if (preferIdx < trackedLines.length && trackedLines[preferIdx] === targetLine && !usedMap.has(preferIdx)) {
    return preferIdx;
  }
  for (let i = 0; i < trackedLines.length; i++) {
    if (trackedLines[i] === targetLine && !usedMap.has(i)) {
      return i;
    }
  }
  return -1;
}

export async function getBlame(projectId: string, filename: string, branch?: string): Promise<Array<{
  line: number;
  commitId: string | null;
  message: string;
  author: string;
  date: string;
}>> {
  const dir = getProjectDir(projectId);
  const filePath = path.join(dir, filename);

  if (!fs.existsSync(filePath)) return [];

  const currentContent = fs.readFileSync(filePath, "utf-8");
  const currentLines = currentContent.split("\n");
  const numLines = currentLines.length;

  try {
    const logs = await getLog(projectId, branch, 200);
    if (logs.length === 0) {
      return currentLines.map((_, i) => ({
        line: i + 1,
        commitId: null,
        message: "Uncommitted",
        author: "You",
        date: new Date().toISOString(),
      }));
    }

    type BlameEntry = { commitId: string | null; message: string; author: string; date: string };
    const lineBlame: (BlameEntry | null)[] = new Array(numLines).fill(null);
    let unblamed = numLines;

    let headLines: string[] = [];
    try {
      const { blob } = await git.readBlob({ fs, dir, oid: logs[0].sha, filepath: filename });
      headLines = new TextDecoder().decode(blob).split("\n");
    } catch {
      return currentLines.map((_, i) => ({
        line: i + 1,
        commitId: null,
        message: "Uncommitted",
        author: "You",
        date: new Date().toISOString(),
      }));
    }

    for (let i = 0; i < numLines; i++) {
      if (i >= headLines.length || headLines[i] !== currentLines[i]) {
        lineBlame[i] = { commitId: null, message: "Uncommitted", author: "You", date: new Date().toISOString() };
        unblamed--;
      }
    }

    let trackedLines = headLines;

    for (let ci = 0; ci < logs.length && unblamed > 0; ci++) {
      const commit = logs[ci];

      let parentLines: string[] = [];
      if (commit.parentSha) {
        try {
          const { blob } = await git.readBlob({ fs, dir, oid: commit.parentSha, filepath: filename });
          parentLines = new TextDecoder().decode(blob).split("\n");
        } catch {
          for (let i = 0; i < numLines; i++) {
            if (lineBlame[i] === null) {
              lineBlame[i] = { commitId: commit.sha, message: commit.message, author: commit.author, date: commit.date };
              unblamed--;
            }
          }
          break;
        }
      } else {
        for (let i = 0; i < numLines; i++) {
          if (lineBlame[i] === null) {
            lineBlame[i] = { commitId: commit.sha, message: commit.message, author: commit.author, date: commit.date };
            unblamed--;
          }
        }
        break;
      }

      const parentSet = new Set<string>();
      for (const line of parentLines) {
        parentSet.add(line);
      }

      const trackedToOriginal = new Map<number, number>();
      for (let i = 0; i < numLines; i++) {
        if (lineBlame[i] === null) {
          const trackedIdx = findLineInTracked(trackedLines, currentLines[i], i, trackedToOriginal);
          if (trackedIdx !== -1) {
            trackedToOriginal.set(trackedIdx, i);
          }
        }
      }

      for (let i = 0; i < numLines; i++) {
        if (lineBlame[i] !== null) continue;
        if (!parentSet.has(currentLines[i])) {
          lineBlame[i] = { commitId: commit.sha, message: commit.message, author: commit.author, date: commit.date };
          unblamed--;
        }
      }

      trackedLines = parentLines;
    }

    if (unblamed > 0) {
      const lastCommit = logs[logs.length - 1];
      for (let i = 0; i < numLines; i++) {
        if (lineBlame[i] === null) {
          lineBlame[i] = { commitId: lastCommit.sha, message: lastCommit.message, author: lastCommit.author, date: lastCommit.date };
        }
      }
    }

    return lineBlame.map((entry, i) => ({
      line: i + 1,
      commitId: entry?.commitId || null,
      message: entry?.message || "Unknown",
      author: entry?.author || "Unknown",
      date: entry?.date || new Date().toISOString(),
    }));
  } catch {
    return currentLines.map((_, i) => ({
      line: i + 1,
      commitId: null,
      message: "Uncommitted",
      author: "You",
      date: new Date().toISOString(),
    }));
  }
}

export function getWorkingTreeFiles(projectId: string): Array<{ filename: string; content: string }> {
  const dir = getProjectDir(projectId);
  if (!fs.existsSync(dir)) return [];

  const allFiles = getAllFiles(dir, dir);
  return allFiles.map(filename => ({
    filename,
    content: fs.readFileSync(path.join(dir, filename), "utf-8"),
  }));
}

export async function cloneRepo(
  projectId: string,
  url: string,
  options?: { token?: string; httpTransport?: GitHttpClient }
): Promise<Array<{ filename: string; content: string }>> {
  const dir = getProjectDir(projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  ensureDir(dir);

  const http = options?.httpTransport || await getHttp();

  const cloneConfig: Parameters<typeof git.clone>[0] = {
    fs,
    http,
    dir,
    url,
    singleBranch: true,
    depth: 50,
  };

  if (options?.token) {
    cloneConfig.onAuth = () => ({ username: options.token! });
  }

  await git.clone(cloneConfig);

  return getWorkingTreeFiles(projectId);
}

export async function pushToRemote(
  projectId: string,
  url: string,
  options: { token?: string; branch?: string; httpTransport?: GitHttpClient }
): Promise<{ ok: boolean; error?: string }> {
  const dir = getProjectDir(projectId);
  const http = options.httpTransport || await getHttp();
  const branch = options.branch || "main";
  try {
    const remotes = await git.listRemotes({ fs, dir });
    const hasOrigin = remotes.some(r => r.remote === "origin");
    if (!hasOrigin) {
      await git.addRemote({ fs, dir, remote: "origin", url });
    } else {
      await git.deleteRemote({ fs, dir, remote: "origin" });
      await git.addRemote({ fs, dir, remote: "origin", url });
    }

    const pushConfig: Parameters<typeof git.push>[0] = {
      fs,
      http,
      dir,
      remote: "origin",
      ref: branch,
    };

    if (options.token) {
      pushConfig.onAuth = () => ({ username: options.token! });
    }

    await git.push(pushConfig);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Push failed";
    return { ok: false, error: message };
  }
}

export async function pullFromRemote(
  projectId: string,
  url: string,
  options: {
    token?: string;
    branch?: string;
    authorName?: string;
    authorEmail?: string;
    httpTransport?: GitHttpClient;
  }
): Promise<{ ok: boolean; files: Array<{ filename: string; content: string }>; error?: string }> {
  const dir = getProjectDir(projectId);
  const http = options.httpTransport || await getHttp();
  const branch = options.branch || "main";
  const authorName = options.authorName || "User";
  const authorEmail = options.authorEmail || "user@ide.local";
  try {
    const remotes = await git.listRemotes({ fs, dir });
    const hasOrigin = remotes.some(r => r.remote === "origin");
    if (!hasOrigin) {
      await git.addRemote({ fs, dir, remote: "origin", url });
    } else {
      await git.deleteRemote({ fs, dir, remote: "origin" });
      await git.addRemote({ fs, dir, remote: "origin", url });
    }

    const fetchConfig: Parameters<typeof git.fetch>[0] = {
      fs,
      http,
      dir,
      remote: "origin",
      ref: branch,
      singleBranch: true,
    };

    if (options.token) {
      fetchConfig.onAuth = () => ({ username: options.token! });
    }

    await git.fetch(fetchConfig);

    await git.checkout({ fs, dir, ref: branch, force: true });

    let localOid: string | null = null;
    try {
      localOid = await git.resolveRef({ fs, dir, ref: branch });
    } catch {
    }

    const remoteOid = await git.resolveRef({ fs, dir, ref: `remotes/origin/${branch}` });

    if (localOid && localOid === remoteOid) {
      const files = getWorkingTreeFiles(projectId);
      return { ok: true, files };
    }

    if (!localOid) {
      await git.branch({ fs, dir, ref: branch, object: remoteOid });
      await git.checkout({ fs, dir, ref: branch, force: true });
      const files = getWorkingTreeFiles(projectId);
      return { ok: true, files };
    }

    try {
      await git.merge({
        fs,
        dir,
        ours: branch,
        theirs: `remotes/origin/${branch}`,
        author: { name: authorName, email: authorEmail },
        fastForward: true,
      });
    } catch (mergeErr: unknown) {
      const mergeMsg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
      return {
        ok: false,
        files: [],
        error: `Pull cannot be completed: merge conflict or non-fast-forward. ${mergeMsg}. Please commit or stash local changes first.`,
      };
    }

    await git.checkout({ fs, dir, ref: branch, force: false });
    const files = getWorkingTreeFiles(projectId);
    return { ok: true, files };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Pull failed";
    return { ok: false, files: [], error: message };
  }
}

export async function getRemoteStatus(
  projectId: string,
  url: string,
  options: { token?: string; branch?: string; httpTransport?: GitHttpClient }
): Promise<{ ahead: number; behind: number; connected: boolean }> {
  const dir = getProjectDir(projectId);
  const http = options.httpTransport || await getHttp();
  const branch = options.branch || "main";
  try {
    const remotes = await git.listRemotes({ fs, dir });
    const hasOrigin = remotes.some(r => r.remote === "origin");
    if (!hasOrigin) {
      await git.addRemote({ fs, dir, remote: "origin", url });
    } else {
      const currentOrigin = remotes.find(r => r.remote === "origin");
      if (currentOrigin && currentOrigin.url !== url) {
        await git.deleteRemote({ fs, dir, remote: "origin" });
        await git.addRemote({ fs, dir, remote: "origin", url });
      }
    }

    const fetchConfig: Parameters<typeof git.fetch>[0] = {
      fs,
      http,
      dir,
      remote: "origin",
      ref: branch,
      singleBranch: true,
    };

    if (options.token) {
      fetchConfig.onAuth = () => ({ username: options.token! });
    }

    await git.fetch(fetchConfig);

    let localOid: string;
    try {
      localOid = await git.resolveRef({ fs, dir, ref: branch });
    } catch {
      return { ahead: 0, behind: 0, connected: true };
    }

    let remoteOid: string;
    try {
      remoteOid = await git.resolveRef({ fs, dir, ref: `remotes/origin/${branch}` });
    } catch {
      return { ahead: 0, behind: 0, connected: true };
    }

    if (localOid === remoteOid) {
      return { ahead: 0, behind: 0, connected: true };
    }

    let ahead = 0;
    let behind = 0;

    try {
      const localLogs = await git.log({ fs, dir, ref: branch, depth: 100 });
      const remoteLogs = await git.log({ fs, dir, ref: `remotes/origin/${branch}`, depth: 100 });

      const remoteOids = new Set(remoteLogs.map(l => l.oid));
      const localOids = new Set(localLogs.map(l => l.oid));

      ahead = localLogs.filter(l => !remoteOids.has(l.oid)).length;
      behind = remoteLogs.filter(l => !localOids.has(l.oid)).length;
    } catch {}

    return { ahead, behind, connected: true };
  } catch {
    return { ahead: 0, behind: 0, connected: false };
  }
}

export function isRepoInitialized(projectId: string): boolean {
  const dir = getProjectDir(projectId);
  return fs.existsSync(path.join(dir, ".git"));
}

export function getSerializedGitState(projectId: string): string {
  const dir = getProjectDir(projectId);
  return serializeGitDir(dir);
}

export function restoreGitStateFromPack(projectId: string, packed: string): void {
  const dir = getProjectDir(projectId);
  ensureDir(dir);
  deserializeGitDir(dir, packed);
}

export async function ensureRepo(
  projectId: string,
  files: Array<{ filename: string; content: string }>,
  options?: {
    commitHistory?: Array<{
      message: string;
      authorName: string;
      authorEmail: string;
      snapshot: Record<string, string>;
      branchName: string;
      createdAt: string;
    }>;
    dbPackedState?: string | null;
  }
): Promise<void> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    ensureDir(dir);

    if (options?.dbPackedState) {
      deserializeGitDir(dir, options.dbPackedState);
    } else {
      await git.init({ fs, dir, defaultBranch: "main" });

      const commitHistory = options?.commitHistory;
      if (commitHistory && commitHistory.length > 0) {
        const sorted = [...commitHistory].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const commit of sorted) {
          const commitFiles = Object.entries(commit.snapshot).map(([filename, content]) => ({
            filename,
            content,
          }));
          await syncFilesToWorkingTree(projectId, commitFiles);

          const allFiles = getAllFiles(dir, dir);
          for (const filepath of allFiles) {
            await git.add({ fs, dir, filepath });
          }
          const statusMatrix = await git.statusMatrix({ fs, dir });
          for (const [filepath, head, workdir] of statusMatrix) {
            if (head === 1 && workdir === 0) {
              await git.remove({ fs, dir, filepath });
            }
          }

          const timestamp = Math.floor(new Date(commit.createdAt).getTime() / 1000);
          await git.commit({
            fs,
            dir,
            message: commit.message,
            author: {
              name: commit.authorName,
              email: commit.authorEmail,
              timestamp,
              timezoneOffset: 0,
            },
          });
        }
      }
    }
  }
  await syncFilesToWorkingTree(projectId, files);
}

function longestCommonSubsequence(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

type DiffOp = { type: "equal" | "insert" | "delete"; baseLine?: string; targetLine?: string; baseIdx: number; targetIdx: number };

function diffLines(base: string[], target: string[]): DiffOp[] {
  const dp = longestCommonSubsequence(base, target);
  let i = base.length, j = target.length;
  const ops: DiffOp[] = [];
  while (i > 0 && j > 0) {
    if (base[i - 1] === target[j - 1]) {
      ops.push({ type: "equal", baseLine: base[i - 1], targetLine: target[j - 1], baseIdx: i - 1, targetIdx: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: "delete", baseLine: base[i - 1], baseIdx: i - 1, targetIdx: j });
      i--;
    } else {
      ops.push({ type: "insert", targetLine: target[j - 1], baseIdx: i, targetIdx: j - 1 });
      j--;
    }
  }
  while (i > 0) { ops.push({ type: "delete", baseLine: base[i - 1], baseIdx: i - 1, targetIdx: j }); i--; }
  while (j > 0) { ops.push({ type: "insert", targetLine: target[j - 1], baseIdx: i, targetIdx: j - 1 }); j--; }
  return ops.reverse();
}

function mergeLines(base: string[], ours: string[], theirs: string[]): string {
  if (base.length === 0 && ours.length === 0) {
    return `<<<<<<< HEAD (yours)\n=======\n${theirs.join("\n")}\n>>>>>>> remote (theirs)`;
  }
  if (base.length === 0 && theirs.length === 0) {
    return `<<<<<<< HEAD (yours)\n${ours.join("\n")}\n=======\n>>>>>>> remote (theirs)`;
  }

  const MAX_LINES_FOR_LCS = 5000;
  if (base.length > MAX_LINES_FOR_LCS || ours.length > MAX_LINES_FOR_LCS || theirs.length > MAX_LINES_FOR_LCS) {
    return `<<<<<<< HEAD (yours)\n${ours.join("\n")}\n=======\n${theirs.join("\n")}\n>>>>>>> remote (theirs)`;
  }

  const ourDiff = diffLines(base, ours);
  const theirDiff = diffLines(base, theirs);

  const ourChanges = new Map<number, { deletes: string[]; inserts: string[] }>();
  for (const op of ourDiff) {
    if (op.type === "delete") {
      const entry = ourChanges.get(op.baseIdx) || { deletes: [], inserts: [] };
      entry.deletes.push(op.baseLine!);
      ourChanges.set(op.baseIdx, entry);
    } else if (op.type === "insert") {
      const entry = ourChanges.get(op.baseIdx) || { deletes: [], inserts: [] };
      entry.inserts.push(op.targetLine!);
      ourChanges.set(op.baseIdx, entry);
    }
  }

  const theirChanges = new Map<number, { deletes: string[]; inserts: string[] }>();
  for (const op of theirDiff) {
    if (op.type === "delete") {
      const entry = theirChanges.get(op.baseIdx) || { deletes: [], inserts: [] };
      entry.deletes.push(op.baseLine!);
      theirChanges.set(op.baseIdx, entry);
    } else if (op.type === "insert") {
      const entry = theirChanges.get(op.baseIdx) || { deletes: [], inserts: [] };
      entry.inserts.push(op.targetLine!);
      theirChanges.set(op.baseIdx, entry);
    }
  }

  const output: string[] = [];
  const allPositions = new Set<number>();
  ourChanges.forEach((_, k) => allPositions.add(k));
  theirChanges.forEach((_, k) => allPositions.add(k));

  for (let i = 0; i <= base.length; i++) {
    const ourChange = ourChanges.get(i);
    const theirChange = theirChanges.get(i);

    if (ourChange && theirChange) {
      const ourText = ourChange.inserts.length > 0 ? ourChange.inserts : (ourChange.deletes.length > 0 ? [] : undefined);
      const theirText = theirChange.inserts.length > 0 ? theirChange.inserts : (theirChange.deletes.length > 0 ? [] : undefined);

      if (ourText !== undefined && theirText !== undefined) {
        if (ourText.join("\n") === theirText.join("\n")) {
          output.push(...ourText);
        } else {
          output.push("<<<<<<< HEAD (yours)");
          output.push(...ourText);
          output.push("=======");
          output.push(...theirText);
          output.push(">>>>>>> remote (theirs)");
        }
      } else if (ourText !== undefined) {
        output.push(...ourText);
      } else if (theirText !== undefined) {
        output.push(...theirText);
      }
    } else if (ourChange) {
      if (ourChange.inserts.length > 0) output.push(...ourChange.inserts);
    } else if (theirChange) {
      if (theirChange.inserts.length > 0) output.push(...theirChange.inserts);
    }

    if (i < base.length) {
      const ourDel = ourChange?.deletes.includes(base[i]);
      const theirDel = theirChange?.deletes.includes(base[i]);

      if (ourDel && theirDel) {
        continue;
      } else if (ourDel) {
        continue;
      } else if (theirDel) {
        continue;
      } else {
        output.push(base[i]);
      }
    }
  }

  return output.join("\n");
}

export async function pullFromRemoteWithConflicts(
  projectId: string,
  url: string,
  options: {
    token?: string;
    branch?: string;
    authorName?: string;
    authorEmail?: string;
    httpTransport?: GitHttpClient;
  }
): Promise<{
  ok: boolean;
  files: Array<{ filename: string; content: string }>;
  conflicts?: Array<{ filename: string; oursContent: string; theirsContent: string; mergedContent: string }>;
  localOid?: string;
  remoteOid?: string;
  error?: string;
}> {
  const dir = getProjectDir(projectId);
  const http = options.httpTransport || await getHttp();
  const branch = options.branch || "main";
  const authorName = options.authorName || "User";
  const authorEmail = options.authorEmail || "user@ide.local";

  try {
    const remotes = await git.listRemotes({ fs, dir });
    const hasOrigin = remotes.some(r => r.remote === "origin");
    if (!hasOrigin) {
      await git.addRemote({ fs, dir, remote: "origin", url });
    } else {
      await git.deleteRemote({ fs, dir, remote: "origin" });
      await git.addRemote({ fs, dir, remote: "origin", url });
    }

    const fetchConfig: Parameters<typeof git.fetch>[0] = {
      fs, http, dir, remote: "origin", ref: branch, singleBranch: true,
    };
    if (options.token) {
      fetchConfig.onAuth = () => ({ username: options.token! });
    }
    await git.fetch(fetchConfig);
    await git.checkout({ fs, dir, ref: branch, force: true });

    let localOid: string | null = null;
    try { localOid = await git.resolveRef({ fs, dir, ref: branch }); } catch {}

    const remoteOid = await git.resolveRef({ fs, dir, ref: `remotes/origin/${branch}` });

    if (localOid && localOid === remoteOid) {
      return { ok: true, files: getWorkingTreeFiles(projectId) };
    }

    if (!localOid) {
      await git.branch({ fs, dir, ref: branch, object: remoteOid });
      await git.checkout({ fs, dir, ref: branch, force: true });
      return { ok: true, files: getWorkingTreeFiles(projectId) };
    }

    try {
      await git.merge({
        fs, dir, ours: branch, theirs: `remotes/origin/${branch}`,
        author: { name: authorName, email: authorEmail },
        fastForward: true,
      });
      await git.checkout({ fs, dir, ref: branch, force: false });
      return { ok: true, files: getWorkingTreeFiles(projectId) };
    } catch (mergeErr: unknown) {
      const conflicts: Array<{ filename: string; oursContent: string; theirsContent: string; mergedContent: string }> = [];

      try {
        const localCommit = localOid;
        const remoteCommit = remoteOid;

        let baseOid: string | null = null;
        try {
          const localLogs = await git.log({ fs, dir, ref: localCommit, depth: 200 });
          const remoteLogs = await git.log({ fs, dir, ref: remoteCommit, depth: 200 });
          const remoteOidSet = new Set(remoteLogs.map(l => l.oid));
          for (const l of localLogs) {
            if (remoteOidSet.has(l.oid)) { baseOid = l.oid; break; }
          }
        } catch {}

        const collectTreeFiles = async (
          oid: string,
          textMap: Map<string, string>,
          binarySet: Set<string>,
          prefix: string = ""
        ) => {
          try {
            let treeOid = oid;
            try {
              const { commit } = await git.readCommit({ fs, dir, oid });
              treeOid = commit.tree;
            } catch {}
            const tree = await git.readTree({ fs, dir, oid: treeOid });
            for (const entry of tree.tree) {
              const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
              if (entry.type === "blob") {
                try {
                  const { blob } = await git.readBlob({ fs, dir, oid: entry.oid });
                  const bytes = new Uint8Array(blob);
                  const isBinary = bytes.some(b => b === 0);
                  if (isBinary) {
                    binarySet.add(fullPath);
                  } else {
                    textMap.set(fullPath, new TextDecoder().decode(blob));
                  }
                } catch {}
              } else if (entry.type === "tree") {
                await collectTreeFiles(entry.oid, textMap, binarySet, fullPath);
              }
            }
          } catch {}
        };

        const localFiles = new Map<string, string>();
        const remoteFiles = new Map<string, string>();
        const baseFiles = new Map<string, string>();
        const binaryFiles = new Set<string>();

        await collectTreeFiles(localCommit, localFiles, binaryFiles);
        await collectTreeFiles(remoteCommit, remoteFiles, binaryFiles);
        if (baseOid) await collectTreeFiles(baseOid, baseFiles, binaryFiles);

        const allFilenames = new Set<string>();
        localFiles.forEach((_, k) => allFilenames.add(k));
        remoteFiles.forEach((_, k) => allFilenames.add(k));

        for (const filename of allFilenames) {
          if (binaryFiles.has(filename)) {
            const localContent = localFiles.get(filename);
            const remoteContent = remoteFiles.get(filename);
            if (localContent !== remoteContent) {
              conflicts.push({
                filename,
                oursContent: localContent || "",
                theirsContent: remoteContent || "",
                mergedContent: `[Binary file conflict - choose Accept Ours or Accept Theirs]`,
              });
            }
            continue;
          }

          const local = localFiles.get(filename);
          const remote = remoteFiles.get(filename);
          const base = baseFiles.get(filename);

          if (local === remote) continue;

          const localChanged = local !== base;
          const remoteChanged = remote !== base;

          if (localChanged && remoteChanged) {
            const localLines = (local || "").split("\n");
            const remoteLines = (remote || "").split("\n");
            const baseLines = (base || "").split("\n");

            const merged = mergeLines(baseLines, localLines, remoteLines);
            conflicts.push({ filename, oursContent: local || "", theirsContent: remote || "", mergedContent: merged });
          }
        }
      } catch {}

      if (conflicts.length > 0) {
        const mergeHeadPath = path.join(dir, ".git", "MERGE_HEAD");
        fs.writeFileSync(mergeHeadPath, remoteOid + "\n", "utf-8");
        const mergeMsgPath = path.join(dir, ".git", "MERGE_MSG");
        fs.writeFileSync(mergeMsgPath, `Merge remote-tracking branch 'origin/${branch}'\n`, "utf-8");

        return { ok: false, files: [], conflicts, localOid: localOid!, remoteOid };
      }

      const mergeMsg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
      return { ok: false, files: [], error: `Merge conflict: ${mergeMsg}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Pull failed";
    return { ok: false, files: [], error: message };
  }
}

export async function resolveConflicts(
  projectId: string,
  resolvedFiles: Array<{ filename: string; content: string }>,
  authorName: string = "User",
  authorEmail: string = "user@ide.local"
): Promise<{ sha: string }> {
  const dir = getProjectDir(projectId);

  for (const file of resolvedFiles) {
    const safeName = sanitizeFilename(file.filename);
    if (!safeName || !isPathSafe(dir, safeName)) continue;
    const filePath = path.join(dir, safeName);
    const fileDir = path.dirname(filePath);
    ensureDir(fileDir);
    fs.writeFileSync(filePath, file.content, "utf-8");
    await git.add({ fs, dir, filepath: safeName });
  }

  let mergeParent: string | null = null;
  const mergeHeadPath = path.join(dir, ".git", "MERGE_HEAD");
  if (fs.existsSync(mergeHeadPath)) {
    mergeParent = fs.readFileSync(mergeHeadPath, "utf-8").trim();
  }

  let mergeMessage = "Merge: resolved conflicts";
  const mergeMsgPath = path.join(dir, ".git", "MERGE_MSG");
  if (fs.existsSync(mergeMsgPath)) {
    mergeMessage = fs.readFileSync(mergeMsgPath, "utf-8").trim();
  }

  const headOid = await git.resolveRef({ fs, dir, ref: "HEAD" });

  const tempSha = await git.commit({
    fs, dir,
    message: mergeMessage,
    author: { name: authorName, email: authorEmail },
  });

  if (mergeParent) {
    const { commit: tempCommit } = await git.readCommit({ fs, dir, oid: tempSha });
    const commitOid = await git.writeCommit({
      fs, dir,
      commit: {
        tree: tempCommit.tree,
        parent: [headOid, mergeParent],
        message: tempCommit.message,
        author: tempCommit.author,
        committer: tempCommit.committer,
      },
    });

    const currentBranch = await git.currentBranch({ fs, dir });
    if (currentBranch) {
      await git.writeRef({ fs, dir, ref: `refs/heads/${currentBranch}`, value: commitOid, force: true });
    }

    if (fs.existsSync(mergeHeadPath)) fs.unlinkSync(mergeHeadPath);
    if (fs.existsSync(mergeMsgPath)) fs.unlinkSync(mergeMsgPath);

    return { sha: commitOid };
  }

  if (fs.existsSync(mergeHeadPath)) fs.unlinkSync(mergeHeadPath);
  if (fs.existsSync(mergeMsgPath)) fs.unlinkSync(mergeMsgPath);

  return { sha: tempSha };
}

export async function getGitStateHash(projectId: string): Promise<string> {
  const dir = getProjectDir(projectId);
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) return "no-repo";

  const parts: string[] = [];

  try {
    const head = await git.resolveRef({ fs, dir, ref: "HEAD" });
    parts.push(`head:${head}`);
  } catch {
    parts.push("head:none");
  }

  try {
    const branch = await git.currentBranch({ fs, dir });
    parts.push(`branch:${branch || "detached"}`);
  } catch {
    parts.push("branch:unknown");
  }

  try {
    const matrix = await git.statusMatrix({ fs, dir });
    const statusParts: string[] = [];
    for (const [filepath, head, workdir, stage] of matrix) {
      if (head !== workdir || head !== stage || workdir !== stage) {
        statusParts.push(`${filepath}:${head}${workdir}${stage}`);
      }
    }
    statusParts.sort();
    parts.push(`status:${statusParts.join(",") || "clean"}`);
  } catch {
    parts.push("status:unknown");
  }

  const raw = parts.join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
