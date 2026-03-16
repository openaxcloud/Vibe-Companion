import { useEffect, useRef, useCallback, useState } from "react";
import * as Y from "yjs";

export interface RemoteUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  activeFileId: string | null;
}

export interface RemoteCursorState {
  anchor: number;
  head: number;
  displayName: string;
  color: string;
}

export interface AwarenessState {
  userId: string;
  displayName: string;
  color: string;
  cursor: { anchor: number; head: number } | null;
}

interface FileDocEntry {
  ydoc: Y.Doc;
  ytext: Y.Text;
  synced: boolean;
}

const MSG_SYNC_REQUEST = 0;
const MSG_SYNC_RESPONSE = 1;
const MSG_UPDATE = 2;
const MSG_AWARENESS = 3;

function buildBinaryMessage(msgType: number, fileId: string, payload: Uint8Array): ArrayBuffer {
  const fileIdBytes = new TextEncoder().encode(fileId);
  const buf = new Uint8Array(2 + fileIdBytes.length + payload.length);
  buf[0] = msgType;
  buf[1] = fileIdBytes.length;
  buf.set(fileIdBytes, 2);
  buf.set(payload, 2 + fileIdBytes.length);
  return buf.buffer;
}

function parseBinaryMessage(data: ArrayBuffer): { msgType: number; fileId: string; payload: Uint8Array } | null {
  const buf = new Uint8Array(data);
  if (buf.length < 2) return null;
  const msgType = buf[0];
  const fileIdLen = buf[1];
  if (buf.length < 2 + fileIdLen) return null;
  const fileId = new TextDecoder().decode(buf.slice(2, 2 + fileIdLen));
  const payload = buf.slice(2 + fileIdLen);
  return { msgType, fileId, payload };
}

export function useCollaboration(
  projectId: string | undefined,
  userId: string | undefined,
  activeFileId: string | null,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [syncedFiles, setSyncedFiles] = useState<Set<string>>(new Set());
  const unmounted = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const joinedRef = useRef(false);
  const fileDocsRef = useRef<Map<string, FileDocEntry>>(new Map());
  const localUserRef = useRef<{ userId: string; displayName: string; color: string } | null>(null);
  const awarenessStatesRef = useRef<Map<string, Map<string, AwarenessState>>>(new Map());
  const [remoteAwareness, setRemoteAwareness] = useState<Map<string, AwarenessState>>(new Map());
  const joinNotificationRef = useRef<((userName: string, action: "joined" | "left") => void) | null>(null);

  const getOrCreateFileDoc = useCallback((fileId: string): FileDocEntry => {
    let entry = fileDocsRef.current.get(fileId);
    if (!entry) {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("content");
      entry = { ydoc, ytext, synced: false };
      fileDocsRef.current.set(fileId, entry);

      ydoc.on("update", (update: Uint8Array, origin: string | null) => {
        if (origin === "remote") return;
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(buildBinaryMessage(MSG_UPDATE, fileId, update));
        }
      });
    }
    return entry;
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const requestSync = useCallback((fileId: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const entry = getOrCreateFileDoc(fileId);
      entry.synced = false;
      const sv = Y.encodeStateVector(entry.ydoc);
      ws.send(buildBinaryMessage(MSG_SYNC_REQUEST, fileId, sv));
    }
  }, [getOrCreateFileDoc]);

  const connect = useCallback(() => {
    if (!projectId || !userId || unmounted.current) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/collab?projectId=${projectId}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
      joinedRef.current = false;
      ws.send(JSON.stringify({ type: "collab:join" }));
    };

    ws.onclose = () => {
      setConnected(false);
      setSyncedFiles(new Set());
      joinedRef.current = false;
      for (const entry of fileDocsRef.current.values()) {
        entry.synced = false;
      }
      if (!unmounted.current) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 15000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(() => {
          if (!unmounted.current) connect();
        }, delay);
      }
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const parsed = parseBinaryMessage(event.data);
          if (!parsed) return;

          const { msgType, fileId, payload } = parsed;
          const entry = getOrCreateFileDoc(fileId);

          if (msgType === MSG_SYNC_RESPONSE || msgType === MSG_UPDATE) {
            Y.applyUpdate(entry.ydoc, payload, "remote");
            if (msgType === MSG_SYNC_RESPONSE && !entry.synced) {
              entry.synced = true;
              setSyncedFiles(prev => {
                const next = new Set(prev);
                next.add(fileId);
                return next;
              });
              const fullUpdate = Y.encodeStateAsUpdate(entry.ydoc);
              if (fullUpdate.length > 0) {
                ws.send(buildBinaryMessage(MSG_UPDATE, fileId, fullUpdate));
              }
            }
          }
          return;
        }

        const data = JSON.parse(event.data as string);
        switch (data.type) {
          case "collab:joined": {
            joinedRef.current = true;
            localUserRef.current = data.user;
            if (activeFileIdRef.current) {
              requestSync(activeFileIdRef.current);
              sendMessage({ type: "collab:active_file", fileId: activeFileIdRef.current });
            }
            break;
          }

          case "collab:presence":
            setRemoteUsers(
              (data.users || []).filter((u: RemoteUser) => u.userId !== userId)
            );
            break;

          case "collab:awareness": {
            const state = data.state as AwarenessState;
            if (data.userId === userId) break;
            const fileId = data.fileId as string;
            if (!awarenessStatesRef.current.has(fileId)) {
              awarenessStatesRef.current.set(fileId, new Map());
            }
            awarenessStatesRef.current.get(fileId)!.set(data.userId as string, state);
            if (fileId === activeFileIdRef.current) {
              setRemoteAwareness(new Map(awarenessStatesRef.current.get(fileId)!));
            }
            break;
          }

          case "collab:user_joined": {
            if (joinNotificationRef.current && data.userId !== userId) {
              joinNotificationRef.current(data.displayName as string, "joined");
            }
            break;
          }

          case "collab:user_left": {
            if (joinNotificationRef.current && data.userId !== userId) {
              joinNotificationRef.current(data.displayName as string, "left");
            }
            for (const stateMap of awarenessStatesRef.current.values()) {
              stateMap.delete(data.userId as string);
            }
            if (activeFileIdRef.current && awarenessStatesRef.current.has(activeFileIdRef.current)) {
              setRemoteAwareness(new Map(awarenessStatesRef.current.get(activeFileIdRef.current)!));
            }
            break;
          }

          case "pong":
            break;
        }
      } catch {}
    };
  }, [projectId, userId, sendMessage, getOrCreateFileDoc, requestSync]);

  useEffect(() => {
    unmounted.current = false;
    if (projectId && userId) {
      connect();
    }
    return () => {
      unmounted.current = true;
      joinedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      for (const entry of fileDocsRef.current.values()) {
        entry.ydoc.destroy();
      }
      fileDocsRef.current.clear();
    };
  }, [projectId, userId]);

  const sendAwareness = useCallback((fileId: string, cursor: { anchor: number; head: number } | null) => {
    if (!localUserRef.current) return;
    const state: AwarenessState = {
      userId: localUserRef.current.userId,
      displayName: localUserRef.current.displayName,
      color: localUserRef.current.color,
      cursor,
    };
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = new TextEncoder().encode(JSON.stringify(state));
      ws.send(buildBinaryMessage(MSG_AWARENESS, fileId, payload));
    }
  }, []);

  const prevActiveFileRef = useRef<string | null>(null);

  useEffect(() => {
    const prevFile = prevActiveFileRef.current;
    if (prevFile && prevFile !== activeFileId && connected) {
      sendAwareness(prevFile, null);
    }
    prevActiveFileRef.current = activeFileId;

    if (activeFileId && connected && joinedRef.current) {
      requestSync(activeFileId);
      sendMessage({ type: "collab:active_file", fileId: activeFileId });
    }
    if (activeFileId && awarenessStatesRef.current.has(activeFileId)) {
      setRemoteAwareness(new Map(awarenessStatesRef.current.get(activeFileId)!));
    } else {
      setRemoteAwareness(new Map());
    }
  }, [activeFileId, connected, sendMessage, requestSync, sendAwareness]);

  const getFileDoc = useCallback((fileId: string): { ydoc: Y.Doc; ytext: Y.Text } => {
    const entry = getOrCreateFileDoc(fileId);
    return { ydoc: entry.ydoc, ytext: entry.ytext };
  }, [getOrCreateFileDoc]);

  const isFileSynced = useCallback((fileId: string): boolean => {
    return syncedFiles.has(fileId);
  }, [syncedFiles]);

  const onJoinNotification = useCallback((handler: (userName: string, action: "joined" | "left") => void) => {
    joinNotificationRef.current = handler;
  }, []);

  return {
    remoteUsers,
    remoteAwareness,
    connected,
    sendAwareness,
    getFileDoc,
    isFileSynced,
    requestSync,
    onJoinNotification,
    localUser: localUserRef.current,
  };
}
