import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

export type ChannelId = string;
export type MessageId = string;

export interface Channel {
  id: ChannelId;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  lastMessagePreview?: string;
  isArchived?: boolean;
}

export interface Message {
  id: MessageId;
  channelId: ChannelId;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  isOptimistic?: boolean;
  failed?: boolean;
}

export interface ChannelState {
  channels: Channel[];
  activeChannelId: ChannelId | null;
  messagesByChannel: Record<ChannelId, Message[]>;
  isLoadingChannels: boolean;
  isLoadingMessages: boolean;
  hasMoreMessagesByChannel: Record<ChannelId, boolean>;
}

export interface SendMessagePayload {
  channelId: ChannelId;
  content: string;
}

export interface UpdateMessagePayload {
  channelId: ChannelId;
  messageId: MessageId;
  content: string;
}

export interface ChannelContextValue extends ChannelState {
  activeChannel: Channel | null;
  setActiveChannelId: (channelId: ChannelId | null) => void;
  sendMessage: (payload: SendMessagePayload) => Promise<void>;
  updateMessage: (payload: UpdateMessagePayload) => Promise<void>;
  deleteMessage: (channelId: ChannelId, messageId: MessageId) => Promise<void>;
  loadMoreMessages: (channelId: ChannelId) => Promise<void>;
  markChannelAsRead: (channelId: ChannelId) => void;
  refreshChannels: () => Promise<void>;
}

const ChannelContext = createContext<ChannelContextValue | undefined>(
  undefined
);

interface ChannelProviderProps {
  children: ReactNode;
  apiBaseUrl: string;
  websocketUrl: string;
  authToken?: string | null;
}

type WebSocketMessage =
  | {
      type: "message.created";
      payload: Message;
    }
  | {
      type: "message.updated";
      payload: Message;
    }
  | {
      type: "message.deleted";
      payload: { id: MessageId; channelId: ChannelId };
    }
  | {
      type: "channel.updated";
      payload: Channel;
    }
  | {
      type: "channel.unread_updated";
      payload: { channelId: ChannelId; unreadCount: number };
    };

export const ChannelProvider: React.FC<ChannelProviderProps> = ({
  children,
  apiBaseUrl,
  websocketUrl,
  authToken,
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelIdState] = useState<ChannelId | null>(
    null
  );
  const [messagesByChannel, setMessagesByChannel] = useState<
    Record<ChannelId, Message[]>
  >({});
  const [hasMoreMessagesByChannel, setHasMoreMessagesByChannel] = useState<
    Record<ChannelId, boolean>
  >({});
  const [isLoadingChannels, setIsLoadingChannels] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      };

      if (authToken) {
        headers["Authorization"] = `Bearer undefined`;
      }

      const response = await fetch(input, {
        ...init,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Request failed with status undefinedundefined` : ""
          }`
        );
      }

      return response;
    },
    [authToken]
  );

  const fetchChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    try {
      const res = await fetchWithAuth(`undefined/channels`);
      const data = (await res.json()) as Channel[];
      setChannels(data);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [apiBaseUrl, fetchWithAuth]);

  const fetchMessages = useCallback(
    async (channelId: ChannelId, before?: string) => {
      setIsLoadingMessages(true);
      try {
        const searchParams = new URLSearchParams();
        if (before) searchParams.set("before", before);
        const res = await fetchWithAuth(
          `undefined/channels/undefined/messages?undefined`
        );
        const data = (await res.json()) as {
          messages: Message[];
          hasMore: boolean;
        };

        setMessagesByChannel((prev) => {
          const existing = prev[channelId] || [];
          // Prepend older messages when loading more
          const merged = before ? [...data.messages, ...existing] : data.messages;
          return {
            ...prev,
            [channelId]: merged,
          };
        });

        setHasMoreMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: data.hasMore,
        }));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [apiBaseUrl, fetchWithAuth]
  );

  const setActiveChannelId = useCallback(
    (channelId: ChannelId | null) => {
      setActiveChannelIdState(channelId);
      if (channelId && !messagesByChannel[channelId]) {
        void fetchMessages(channelId);
      }
    },
    [fetchMessages, messagesByChannel]
  );

  const appendOrUpdateMessage = useCallback(
    (message: Message) => {
      setMessagesByChannel((prev) => {
        const channelMessages = prev[message.channelId] || [];
        const existingIndex = channelMessages.findIndex(
          (m) => m.id === message.id
        );

        let newMessages: Message[];
        if (existingIndex >= 0) {
          newMessages = [...channelMessages];
          newMessages[existingIndex] = {
            ...channelMessages[existingIndex],
            ...message,
            isOptimistic: false,
            failed: false,
          };
        } else {
          newMessages = [...channelMessages, { ...message, isOptimistic: false, failed: false }];
        }

        return {
          ...prev,
          [message.channelId]: newMessages,
        };
      });

      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === message.channelId
            ? {
                ...ch,
                lastMessagePreview: message.content,
                updatedAt: message.createdAt,
              }
            : ch
        )
      );
    },
    []
  );

  const handleMessageDeleted = useCallback(
    (channelId: ChannelId, messageId: MessageId) => {
      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: channelMessages.filter((m) => m.id !== messageId),
        };
      });
    },
    []
  );

  const handleChannelUpdated = useCallback((channel: Channel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === channel.id);
      if (idx === -1) return [...prev, channel];
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...channel };
      return updated;
    });
  }, []);

  const handleUnreadUpdated = useCallback(
    (channelId: ChannelId, unreadCount: number) => {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId ? { ...c, unreadCount } : c
        )
      );
    },
    []
  );

  const setupWebSocket = useCallback(() => {
    if (isConnectingRef.current || wsRef.current) return;
    isConnectingRef.current = true;

    const url = new URL(websocketUrl);
    if (authToken) {
      url.searchParams.set("token", authToken);
    }

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as WebSocketMessage;
        switch (parsed.type) {
          case "message.created":
            appendOrUpdateMessage(parsed.payload);
            break;
          case "message.updated":
            appendOrUpdateMessage({