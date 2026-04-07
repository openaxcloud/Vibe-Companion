import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type EntityId = string;

export type ActiveViewType = 'channel' | 'direct' | 'thread';

export interface ActiveChannelView {
  type: 'channel';
  channelId: EntityId | null;
}

export interface ActiveDirectView {
  type: 'direct';
  userId: EntityId | null;
}

export interface ActiveThreadView {
  type: 'thread';
  threadId: EntityId | null;
}

export type ActiveView = ActiveChannelView | ActiveDirectView | ActiveThreadView | null;

export interface TypingEntry {
  userId: EntityId;
  expiresAt: number;
}

export interface PresenceInfo {
  userId: EntityId;
  status: 'online' | 'offline' | 'away' | 'dnd';
  lastActiveAt: number | null;
}

export interface UiState {
  activeView: ActiveView;
  threadPanelOpen: boolean;
  threadPanelThreadId: EntityId | null;
  typingIndicators: Record<EntityId, TypingEntry[]>;
  presence: Record<EntityId, PresenceInfo>;
  setActiveChannel: (channelId: EntityId | null) => void;
  setActiveDirect: (userId: EntityId | null) => void;
  setActiveThread: (threadId: EntityId | null) => void;
  clearActiveView: () => void;
  openThreadPanel: (threadId: EntityId) => void;
  closeThreadPanel: () => void;
  toggleThreadPanel: (threadId?: EntityId) => void;
  setTyping: (contextId: EntityId, userId: EntityId, timeoutMs?: number) => void;
  clearTyping: (contextId: EntityId, userId: EntityId) => void;
  clearExpiredTyping: () => void;
  setPresence: (userId: EntityId, status: PresenceInfo['status']) => void;
  bulkSetPresence: (entries: PresenceInfo[]) => void;
  removePresence: (userId: EntityId) => void;
  resetPresence: () => void;
}

const DEFAULT_TYPING_TIMEOUT_MS = 8000;

const createTypingEntry = (userId: EntityId, timeoutMs: number): TypingEntry => ({
  userId,
  expiresAt: Date.now() + timeoutMs,
});

const filterExpiredTyping = (entries: TypingEntry[]): TypingEntry[] =>
  entries.filter((entry) => entry.expiresAt > Date.now());

const normalizeUserIdList = (entries: TypingEntry[]): TypingEntry[] => {
  const seen = new Set<EntityId>();
  const result: TypingEntry[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.userId)) {
      seen.add(entry.userId);
      result.push(entry);
    }
  }
  return result;
};

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set, get) => ({
        activeView: null,
        threadPanelOpen: false,
        threadPanelThreadId: null,
        typingIndicators: {},
        presence: {},

        setActiveChannel: (channelId) => {
          set(
            {
              activeView: channelId
                ? { type: 'channel', channelId }
                : null,
            },
            false,
            'ui/setActiveChannel',
          );
        },

        setActiveDirect: (userId) => {
          set(
            {
              activeView: userId
                ? { type: 'direct', userId }
                : null,
            },
            false,
            'ui/setActiveDirect',
          );
        },

        setActiveThread: (threadId) => {
          set(
            {
              activeView: threadId
                ? { type: 'thread', threadId }
                : null,
            },
            false,
            'ui/setActiveThread',
          );
        },

        clearActiveView: () => {
          set(
            {
              activeView: null,
            },
            false,
            'ui/clearActiveView',
          );
        },

        openThreadPanel: (threadId) => {
          set(
            {
              threadPanelOpen: true,
              threadPanelThreadId: threadId,
              activeView: { type: 'thread', threadId },
            },
            false,
            'ui/openThreadPanel',
          );
        },

        closeThreadPanel: () => {
          const current = get().activeView;
          const isThreadView = current?.type === 'thread';
          set(
            {
              threadPanelOpen: false,
              threadPanelThreadId: null,
              activeView: isThreadView ? null : current,
            },
            false,
            'ui/closeThreadPanel',
          );
        },

        toggleThreadPanel: (threadId) => {
          const { threadPanelOpen, threadPanelThreadId } = get();
          if (!threadPanelOpen) {
            if (threadId) {
              get().openThreadPanel(threadId);
            }
            return;
          }
          if (threadId && threadPanelThreadId !== threadId) {
            get().openThreadPanel(threadId);
            return;
          }
          get().closeThreadPanel();
        },

        setTyping: (contextId, userId, timeoutMs = DEFAULT_TYPING_TIMEOUT_MS) => {
          set(
            (state) => {
              const currentList = state.typingIndicators[contextId] || [];
              const withoutExpired = filterExpiredTyping(currentList);
              const withoutUser = withoutExpired.filter((e) => e.userId !== userId);
              const updatedList = normalizeUserIdList([
                ...withoutUser,
                createTypingEntry(userId, timeoutMs),
              ]);
              return {
                typingIndicators: {
                  ...state.typingIndicators,
                  [contextId]: updatedList,
                },
              };
            },
            false,
            'ui/setTyping',
          );
        },

        clearTyping: (contextId, userId) => {
          set(
            (state) => {
              const currentList = state.typingIndicators[contextId];
              if (!currentList || currentList.length === 0) {
                return {};
              }
              const updatedList = currentList.filter((e) => e.userId !== userId);
              const nextTypingIndicators = { ...state.typingIndicators };
              if (updatedList.length === 0) {
                delete nextTypingIndicators[contextId];
              } else {
                nextTypingIndicators[contextId] = updatedList;
              }
              return { typingIndicators: nextTypingIndicators };
            },
            false,
            'ui/clearTyping',
          );
        },

        clearExpiredTyping: () => {
          set(
            (state) => {
              const next: Record<EntityId, TypingEntry[]> = {};
              let changed = false;
              for (const [contextId, entries] of Object.entries(state.typingIndicators)) {
                const filtered = filterExpiredTyping(entries);
                if (filtered.length > 0) {
                  next[contextId] = filtered;
                }
                if (filtered.length !== entries.length) {
                  changed = true;
                }
              }
              if (!changed) return {};
              return { typingIndicators: next };
            },
            false,
            'ui/clearExpiredTyping',
          );
        },

        setPresence: (userId, status) => {
          set(
            (state) => {
              const now = Date.now();
              const prev = state.presence[userId];
              const lastActiveAt =
                status === 'online' ? now : prev?.lastActiveAt ?? (status === 'offline' ? now : null);
              return {
                presence: {
                  ...state.presence,
                  [userId]: {
                    userId,
                    status,
                    lastActiveAt,
                  },
                },
              };
            },
            false,
            'ui/setPresence',
          );
        },

        bulkSetPresence: (entries) => {
          set(
            (state) => {
              const merged: Record<EntityId, PresenceInfo> = { ...state.presence };
              const now = Date.now();
              for (const entry of entries) {
                const prev = merged[entry.userId];
                const lastActiveAt =
                  entry.status === 'online'
                    ? now
                    : entry.lastActiveAt ??
                      prev?.lastActiveAt ??
                      (entry.status === 'offline' ? now : null);
                merged[entry.userId] = {
                  ...entry,
                  lastActiveAt,
                };
              }
              return { presence: merged };
            },
            false,
            'ui/bulkSetPresence',
          );
        },

        removePresence: (userId) => {
          set(
            (state) => {
              if (!state.presence[userId]) return {};
              const next = { ...state.presence };
              delete next[userId];
              return { presence: next };
            },
            false,
            'ui/removePresence',
          );
        },

        resetPresence: () => {
          set(
            {
              presence: {},
            },
            false,
            'ui/resetPresence',
          );
        },
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          activeView: state.activeView,
          threadPanelOpen: state.threadPanelOpen,
          threadPanelThreadId: state.threadPanelThreadId,
        }),
      },
    ),
  ),
);