import git from "isomorphic-git";
import fs from "fs";
import path from "path";
import os from "os";

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

function getProjectDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
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
  authorEmail: string = "user@ide.local"
): Promise<{ sha: string; message: string; author: string; date: string }> {
  const dir = getProjectDir(projectId);

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
    const ref = branch || "main";
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
  if (!fs.existsSync(gitDir)) return [{ name: "main", current: true }];

  try {
    const branches = await git.listBranches({ fs, dir });
    let currentBranch = "main";
    try {
      currentBranch = await git.currentBranch({ fs, dir }) || "main";
    } catch {}

    if (branches.length === 0) return [{ name: "main", current: true }];

    return branches.map(name => ({
      name,
      current: name === currentBranch,
    }));
  } catch {
    return [{ name: "main", current: true }];
  }
}

export async function getCurrentBranch(projectId: string): Promise<string> {
  const dir = getProjectDir(projectId);
  try {
    return await git.currentBranch({ fs, dir }) || "main";
  } catch {
    return "main";
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
  const branchName = branch || "main";
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    return { branch: branchName, changes: [], hasCommits: false };
  }

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
