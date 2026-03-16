import * as Y from "yjs";
import type { WebSocket } from "ws";
import { log } from "./index";

export { Y };

const COLLABORATOR_COLORS = [
  "#0079F2",
  "#0CCE6B",
  "#FF6166",
  "#FFCB6B",
  "#7C65CB",
  "#F26522",
  "#56B6C2",
  "#FF9940",
  "#E91E8C",
  "#00BFA5",
];

export interface CollabUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  activeFileId: string | null;
  lastActivity: number;
}

interface CollabConnection {
  ws: WebSocket;
  user: CollabUser;
}

interface FileDoc {
  ydoc: Y.Doc;
  initialized: boolean;
  initPromise: Promise<void> | null;
}

const projectConnections = new Map<string, Map<string, CollabConnection>>();
const wsToProject = new WeakMap<WebSocket, { projectId: string; userId: string }>();
const colorCounters = new Map<string, number>();
const fileDocs = new Map<string, FileDoc>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
let filePersistCallback: ((fileId: string, content: string) => Promise<void>) | null = null;

const PERSIST_DEBOUNCE_MS = 3000;
const IDLE_DOC_CLEANUP_MS = 5 * 60 * 1000;
const docLastAccess = new Map<string, number>();

function touchDoc(key: string): void {
  docLastAccess.set(key, Date.now());
}

setInterval(() => {
  const now = Date.now();
  for (const [key, lastAccess] of Array.from(docLastAccess.entries())) {
    if (now - lastAccess > IDLE_DOC_CLEANUP_MS) {
      const fd = fileDocs.get(key);
      if (fd) {
        const [projectId] = key.split(":");
        const conns = projectConnections.get(projectId);
        if (!conns || conns.size === 0) {
          if (fd.initialized && filePersistCallback) {
            const fileId = key.substring(projectId.length + 1);
            const content = fd.ydoc.getText("content").toString();
            filePersistCallback(fileId, content).catch((err) => {
              log(`Idle cleanup persist error for ${key}: ${err}`, "collab");
            });
          }
          fd.ydoc.destroy();
          fileDocs.delete(key);
          docLastAccess.delete(key);
          const timer = persistTimers.get(key);
          if (timer) {
            clearTimeout(timer);
            persistTimers.delete(key);
          }
          log(`Cleaned up idle Y.Doc: ${key}`, "collab");
        }
      } else {
        docLastAccess.delete(key);
      }
    }
  }
}, 60_000);

export function setFilePersister(cb: (fileId: string, content: string) => Promise<void>): void {
  filePersistCallback = cb;
}

function schedulePersist(projectId: string, fileId: string): void {
  if (!filePersistCallback) return;
  const key = getDocKey(projectId, fileId);
  const existing = persistTimers.get(key);
  if (existing) clearTimeout(existing);
  persistTimers.set(key, setTimeout(() => {
    persistTimers.delete(key);
    const fd = fileDocs.get(key);
    if (!fd || !fd.initialized) return;
    const content = fd.ydoc.getText("content").toString();
    filePersistCallback!(fileId, content).catch((err) => {
      log(`Collab persist error for ${fileId}: ${err}`, "collab");
    });
  }, PERSIST_DEBOUNCE_MS));
}

function getDocKey(projectId: string, fileId: string): string {
  return `${projectId}:${fileId}`;
}

function getNextColor(projectId: string): string {
  const count = colorCounters.get(projectId) || 0;
  colorCounters.set(projectId, count + 1);
  return COLLABORATOR_COLORS[count % COLLABORATOR_COLORS.length];
}

export function getOrCreateFileDoc(projectId: string, fileId: string): FileDoc {
  const key = getDocKey(projectId, fileId);
  let fd = fileDocs.get(key);
  if (!fd) {
    fd = { ydoc: new Y.Doc(), initialized: false, initPromise: null };
    fileDocs.set(key, fd);
  }
  touchDoc(key);
  return fd;
}

export function initializeFileDoc(projectId: string, fileId: string, content: string): Y.Doc {
  const fd = getOrCreateFileDoc(projectId, fileId);
  if (!fd.initialized) {
    const ytext = fd.ydoc.getText("content");
    if (ytext.length === 0 && content.length > 0) {
      fd.ydoc.transact(() => {
        ytext.insert(0, content);
      });
    }
    fd.ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
      if (origin !== "init") {
        schedulePersist(projectId, fileId);
      }
    });
    fd.initialized = true;
  }
  return fd.ydoc;
}

export function cleanupFileDoc(projectId: string, fileId: string): void {
  const key = getDocKey(projectId, fileId);
  const fd = fileDocs.get(key);
  if (fd) {
    fd.ydoc.destroy();
    fileDocs.delete(key);
  }
}

export function getFileDocContent(projectId: string, fileId: string): string | null {
  const key = getDocKey(projectId, fileId);
  const fd = fileDocs.get(key);
  if (!fd) return null;
  return fd.ydoc.getText("content").toString();
}

export function addCollaborator(
  projectId: string,
  ws: WebSocket,
  userId: string,
  displayName: string,
  avatarUrl: string | null,
): CollabUser {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Map());
  }
  const conns = projectConnections.get(projectId)!;

  const existing = conns.get(userId);
  if (existing) {
    existing.ws = ws;
    existing.user.lastActivity = Date.now();
    wsToProject.set(ws, { projectId, userId });
    return existing.user;
  }

  const user: CollabUser = {
    userId,
    displayName,
    avatarUrl,
    color: getNextColor(projectId),
    activeFileId: null,
    lastActivity: Date.now(),
  };

  conns.set(userId, { ws, user });
  wsToProject.set(ws, { projectId, userId });

  log(`Collaborator joined: ${displayName} (${userId}) in project ${projectId}`, "collab");

  return user;
}

export function removeCollaborator(ws: WebSocket): { projectId: string; userId: string; user: CollabUser } | null {
  const info = wsToProject.get(ws);
  if (!info) return null;

  const conns = projectConnections.get(info.projectId);
  if (!conns) return null;

  const conn = conns.get(info.userId);
  if (!conn || conn.ws !== ws) return null;

  conns.delete(info.userId);
  if (conns.size === 0) {
    projectConnections.delete(info.projectId);
    colorCounters.delete(info.projectId);
    for (const [key, fd] of Array.from(fileDocs.entries())) {
      if (key.startsWith(info.projectId + ":")) {
        if (filePersistCallback && fd.initialized) {
          const fileId = key.split(":").slice(1).join(":");
          const timer = persistTimers.get(key);
          if (timer) {
            clearTimeout(timer);
            persistTimers.delete(key);
          }
          const content = fd.ydoc.getText("content").toString();
          filePersistCallback(fileId, content).catch((err) => {
            log(`Collab persist-on-disconnect error for ${fileId}: ${err}`, "collab");
          });
        }
        fd.ydoc.destroy();
        fileDocs.delete(key);
      }
    }
  }

  log(`Collaborator left: ${conn.user.displayName} (${info.userId}) from project ${info.projectId}`, "collab");

  return { projectId: info.projectId, userId: info.userId, user: conn.user };
}

export function getCollaborators(projectId: string): CollabUser[] {
  const conns = projectConnections.get(projectId);
  if (!conns) return [];
  return Array.from(conns.values()).map(c => c.user);
}

export function updateActiveFile(projectId: string, userId: string, fileId: string | null): void {
  const conn = projectConnections.get(projectId)?.get(userId);
  if (!conn) return;
  conn.user.activeFileId = fileId;
  conn.user.lastActivity = Date.now();
}

export interface CollabMessage {
  type: string;
  [key: string]: unknown;
}

export function broadcastToCollaborators(
  projectId: string,
  excludeUserId: string | null,
  message: CollabMessage,
  filterFileId?: string,
): void {
  const conns = projectConnections.get(projectId);
  if (!conns) return;

  const data = JSON.stringify(message);
  for (const [uid, conn] of Array.from(conns.entries())) {
    if (uid === excludeUserId) continue;
    if (filterFileId && conn.user.activeFileId !== filterFileId) continue;
    try {
      if (conn.ws.readyState === 1) {
        conn.ws.send(data);
      }
    } catch (err) {
      log(`Collab broadcast send error to ${uid}: ${err}`, "collab");
    }
  }
}

export function broadcastBinaryToCollaborators(
  projectId: string,
  excludeUserId: string | null,
  data: Uint8Array,
  filterFileId?: string,
): void {
  const conns = projectConnections.get(projectId);
  if (!conns) return;

  for (const [uid, conn] of Array.from(conns.entries())) {
    if (uid === excludeUserId) continue;
    if (filterFileId && conn.user.activeFileId !== filterFileId) continue;
    try {
      if (conn.ws.readyState === 1) {
        conn.ws.send(data);
      }
    } catch (err) {
      log(`Collab binary broadcast send error to ${uid}: ${err}`, "collab");
    }
  }
}

export function broadcastPresence(projectId: string): void {
  const collaborators = getCollaborators(projectId);
  const message: CollabMessage = {
    type: "collab:presence",
    users: collaborators.map(u => ({
      userId: u.userId,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      color: u.color,
      activeFileId: u.activeFileId,
    })),
  };
  broadcastToCollaborators(projectId, null, message);
}

export function getProjectConnectionCount(projectId: string): number {
  return projectConnections.get(projectId)?.size || 0;
}
