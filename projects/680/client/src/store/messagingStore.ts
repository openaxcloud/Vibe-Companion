import create from "zustand";
import { devtools } from "zustand/middleware";

export type PresenceStatus = "online" | "offline" | "away" | "busy";

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActiveAt: number | null;
  device?: string | null;
  customStatusMessage?: string | null;
}

export interface PresenceEvent {
  userId: string;
  status?: PresenceStatus;
  lastActiveAt?: number | null;
  device?: string | null;
  customStatusMessage?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

export interface Conversation {
  id: string;
  title?: string | null;
  participantIds: string[];
  lastMessageId?: string | null;
  updatedAt: string;
}

export interface MessagingState {
  conversations: Record<string, Conversation>;
  messagesByConversation: Record<string, string[]>;
  messages: Record<string, Message>;
  userPresence: Record<string, UserPresence>;
}

export interface MessagingActions {
  upsertConversation: (conversation: Conversation) => void;
  upsertConversations: (conversations: Conversation[]) => void;
  removeConversation: (conversationId: string) => void;
  addMessage: (message: Message) => void;
  addMessages: (messages: Message[]) => void;
  updateMessageStatus: (
    messageId: string,
    status: Message["status"],
    updatedAt?: string
  ) => void;
  setPresence: (presence: UserPresence) => void;
  setPresenceBulk: (presenceList: UserPresence[]) => void;
  applyPresenceEvent: (event: PresenceEvent) => void;
  applyPresenceEventsBulk: (events: PresenceEvent[]) => void;
  removePresence: (userId: string) => void;
  clearPresence: () => void;
  reset: () => void;
}

export interface MessagingStore extends MessagingState, MessagingActions {
  // Selectors
  getConversationMessages: (conversationId: string) => Message[];
  getUserPresence: (userId: string) => UserPresence | undefined;
  getUsersPresence: (userIds: string[]) => UserPresence[];
  isUserOnline: (userId: string) => boolean;
  getOnlineUserIds: () => string[];
  getPresenceMap: () => Record<string, UserPresence>;
}

const initialState: MessagingState = {
  conversations: {},
  messagesByConversation: {},
  messages: {},
  userPresence: {},
};

export const useMessagingStore = create<MessagingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      upsertConversation: (conversation: Conversation) => {
        set(
          (state) => {
            const existing = state.conversations[conversation.id];
            const merged: Conversation = existing
              ? { ...existing, ...conversation }
              : conversation;
            return {
              conversations: {
                ...state.conversations,
                [conversation.id]: merged,
              },
            };
          },
          false,
          "messaging/upsertConversation"
        );
      },

      upsertConversations: (conversations: Conversation[]) => {
        if (!conversations.length) return;
        set(
          (state) => {
            const updated: Record<string, Conversation> = {
              ...state.conversations,
            };
            for (const conv of conversations) {
              const existing = updated[conv.id];
              updated[conv.id] = existing ? { ...existing, ...conv } : conv;
            }
            return { conversations: updated };
          },
          false,
          "messaging/upsertConversations"
        );
      },

      removeConversation: (conversationId: string) => {
        set(
          (state) => {
            if (!state.conversations[conversationId]) return {};
            const { [conversationId]: _, ...restConversations } =
              state.conversations;

            const { [conversationId]: msgIds, ...restMessagesByConversation } =
              state.messagesByConversation;

            const restMessages = { ...state.messages };
            if (msgIds && msgIds.length) {
              for (const id of msgIds) {
                delete restMessages[id];
              }
            }

            return {
              conversations: restConversations,
              messagesByConversation: restMessagesByConversation,
              messages: restMessages,
            };
          },
          false,
          "messaging/removeConversation"
        );
      },

      addMessage: (message: Message) => {
        set(
          (state) => {
            const existing = state.messages[message.id];
            const merged = existing ? { ...existing, ...message } : message;
            const convId = message.conversationId;
            const existingIds = state.messagesByConversation[convId] || [];
            const hasId = existingIds.includes(message.id);
            const updatedIds = hasId
              ? existingIds
              : [...existingIds, message.id];

            let conversations = state.conversations;
            const conversation = conversations[convId];
            if (conversation) {
              conversations = {
                ...conversations,
                [convId]: {
                  ...conversation,
                  lastMessageId: message.id,
                  updatedAt: message.createdAt,
                },
              };
            }

            return {
              messages: {
                ...state.messages,
                [message.id]: merged,
              },
              messagesByConversation: {
                ...state.messagesByConversation,
                [convId]: updatedIds,
              },
              conversations,
            };
          },
          false,
          "messaging/addMessage"
        );
      },

      addMessages: (messages: Message[]) => {
        if (!messages.length) return;
        set(
          (state) => {
            const newMessages = { ...state.messages };
            const newMessagesByConv: Record<string, string[]> = {
              ...state.messagesByConversation,
            };
            let conversations = { ...state.conversations };

            for (const msg of messages) {
              const existing = newMessages[msg.id];
              newMessages[msg.id] = existing ? { ...existing, ...msg } : msg;

              const convId = msg.conversationId;
              const existingIds = newMessagesByConv[convId] || [];
              if (!existingIds.includes(msg.id)) {
                newMessagesByConv[convId] = [...existingIds, msg.id];
              }

              const conversation = conversations[convId];
              if (conversation) {
                if (
                  !conversation.lastMessageId ||
                  new Date(msg.createdAt).getTime() >
                    new Date(conversation.updatedAt).getTime()
                ) {
                  conversations[convId] = {
                    ...conversation,
                    lastMessageId: msg.id,
                    updatedAt: msg.createdAt,
                  };
                }
              }
            }

            return {
              messages: newMessages,
              messagesByConversation: newMessagesByConv,
              conversations,
            };
          },
          false,
          "messaging/addMessages"
        );
      },

      updateMessageStatus: (
        messageId: string,
        status: Message["status"],
        updatedAt?: string
      ) => {
        set(
          (state) => {
            const existing = state.messages[messageId];
            if (!existing) return {};
            return {
              messages: {
                ...state.messages,
                [messageId]: {
                  ...existing,
                  status,
                  updatedAt: updatedAt ?? existing.updatedAt,
                },
              },
            };
          },
          false,
          "messaging/updateMessageStatus"
        );
      },

      setPresence: (presence: UserPresence) => {
        set(
          (state) => ({
            userPresence: {
              ...state.userPresence,
              [presence.userId]: {
                ...(state.userPresence[presence.userId] ?? {}),
                ...presence,
              },
            },
          }),
          false,
          "messaging/setPresence"
        );
      },

      setPresenceBulk: (presenceList: UserPresence[]) => {
        if (!presenceList.length) return;
        set(
          (state) => {
            const updated: Record<string, UserPresence> = {
              ...state.userPresence,
            };
            for (const p of presenceList) {
              updated[p.userId] = {
                ...(updated[p.userId] ?? {}),
                ...p,
              };
            }
            return { userPresence: updated };
          },
          false,
          "messaging/setPresenceBulk"
        );
      },

      applyPresenceEvent: (event: PresenceEvent) => {
        set(
          (state) => {
            const existing = state.userPresence[event.userId] ?? {
              userId: event.userId,
              status: "offline" as PresenceStatus,
              lastActiveAt: null,
            };

            const merged: UserPresence = {
              ...existing,
              ...event,
              status: event.status ?? existing.status,
              lastActiveAt:
                event.lastActiveAt !== undefined
                  ? event.lastActiveAt
                  : existing.lastActiveAt,
              device:
                event.device !== undefined ? event.device : existing.device,
              customStatusMessage:
                event.customStatusMessage !== undefined
                  ? event.customStatusMessage
                  : existing.customStatusMessage,
            };

            return {
              userPresence: {
                ...state.userPresence,
                [event.userId]: merged,
              },
            };
          },
          false