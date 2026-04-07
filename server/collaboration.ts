import * as Y from "yjs";
import type { WebSocket } from "ws";

export { Y };

export interface CollabMessage {
  type: string;
  fileId?: string;
  content?: any;
  userId?: string;
}

const fileDocs = new Map<string, Y.Doc>();
const connections = new Map<string, Set<WebSocket>>();

interface Collaborator {
  odId: string;
  odUserId: string;
  odAvatarUrl: string | null;
  odDisplayName: string;
  ws: WebSocket;
  activeFile: string | null;
  cursor: { line: number; col: number } | null;
}

const collaborators = new Map<string, Map<string, Collaborator>>();

export function addCollaborator(projectId: string, userId: string, displayName: string, avatarUrl: string | null, ws: WebSocket) {
  if (!collaborators.has(projectId)) collaborators.set(projectId, new Map());
  if (!connections.has(projectId)) connections.set(projectId, new Set());
  const collab: Collaborator = { odId: userId, odUserId: userId, odAvatarUrl: avatarUrl, odDisplayName: displayName, ws, activeFile: null, cursor: null };
  collaborators.get(projectId)!.set(userId, collab);
  connections.get(projectId)!.add(ws);
  return collab;
}

export function removeCollaborator(projectId: string, userId: string) {
  const projCollabs = collaborators.get(projectId);
  if (projCollabs) {
    const c = projCollabs.get(userId);
    if (c) connections.get(projectId)?.delete(c.ws);
    projCollabs.delete(userId);
    if (projCollabs.size === 0) collaborators.delete(projectId);
  }
}

export function getCollaborators(projectId: string) {
  const projCollabs = collaborators.get(projectId);
  if (!projCollabs) return [];
  return Array.from(projCollabs.values()).map(c => ({
    odId: c.odId, odUserId: c.odUserId, odAvatarUrl: c.odAvatarUrl, odDisplayName: c.odDisplayName,
    activeFile: c.activeFile, cursor: c.cursor,
  }));
}

export function updateActiveFile(projectId: string, userId: string, fileId: string): void {
  const c = collaborators.get(projectId)?.get(userId);
  if (c) c.activeFile = fileId;
}

export function broadcastToCollaborators(projectId: string, message: any, excludeWs?: WebSocket): void {
  const conns = connections.get(projectId);
  if (!conns) return;
  const data = JSON.stringify(message);
  for (const ws of conns) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

export function broadcastPresence(projectId: string, userId: string, data: any): void {
  broadcastToCollaborators(projectId, { type: "presence", userId, ...data });
}

export function getOrCreateFileDoc(projectId: string, fileId: string): Y.Doc {
  const key = `${projectId}:${fileId}`;
  let doc = fileDocs.get(key);
  if (!doc) {
    doc = new Y.Doc();
    fileDocs.set(key, doc);
  }
  return doc;
}

export function initializeFileDoc(projectId: string, fileId: string, content: string): Y.Doc {
  const doc = getOrCreateFileDoc(projectId, fileId);
  const text = doc.getText("content");
  if (text.length === 0) {
    text.insert(0, content);
  }
  return doc;
}

export function getFileDocContent(projectId: string, fileId: string): string {
  const doc = getOrCreateFileDoc(projectId, fileId);
  return doc.getText("content").toString();
}

export function broadcastBinaryToCollaborators(projectId: string, data: Uint8Array, excludeWs?: WebSocket): void {
  const conns = connections.get(projectId);
  if (!conns) return;
  for (const ws of conns) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

export function setFilePersister(fn: (projectId: string, fileId: string, content: string) => Promise<void>): void {}
