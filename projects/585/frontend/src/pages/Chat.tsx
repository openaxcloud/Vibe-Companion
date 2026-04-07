import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  ChangeEvent,
  MouseEvent,
} from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  Avatar,
  Paper,
  Tooltip,
  Chip,
  Badge,
} from "@mui/material";
import {
  Send as SendIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  Reply as ReplyIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";

type MessageAuthor = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  content: string;
  createdAt: string; // ISO string
  threadId?: string | null;
  parentId?: string | null;
}

export interface ThreadSummary {
  id: string;
  title: string;
  lastMessagePreview: string;
  updatedAt: string; // ISO
  unreadCount: number;
}

interface ChatState {
  threads: ThreadSummary[];
  messages: ChatMessage[];
  activeThreadId: string | null;
  loadingThreads: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
}

const mockInitialThreads: ThreadSummary[] = [
  {
    id: "thread-1",
    title: "General discussion",
    lastMessagePreview: "Let’s continue our general conversation here.",
    updatedAt: new Date().toISOString(),
    unreadCount: 0,
  },
  {
    id: "thread-2",
    title: "Feature requests",
    lastMessagePreview: "I’d like to suggest a new feature for the app.",
    updatedAt: new Date().toISOString(),
    unreadCount: 2,
  },
];

const mockInitialMessages: ChatMessage[] = [
  {
    id: "m-1",
    author: "assistant",
    content: "Welcome to the chat! This is the general discussion thread.",
    createdAt: new Date().toISOString(),
    threadId: "thread-1",
    parentId: null,
  },
  {
    id: "m-2",
    author: "user",
    content: "Thanks! How do I create a new thread?",
    createdAt: new Date().toISOString(),
    threadId: "thread-1",
    parentId: null,
  },
  {
    id: "m-3",
    author: "assistant",
    content:
      "You can create a new thread from the sidebar using the + New Thread button.",
    createdAt: new Date().toISOString(),
    threadId: "thread-1",
    parentId: null,
  },
  {
    id: "m-4",
    author: "user",
    content: "I’d like to request dark mode support.",
    createdAt: new Date().toISOString(),
    threadId: "thread-2",
    parentId: null,
  },
  {
    id: "m-5",
    author: "assistant",
    content:
      "Dark mode is on our roadmap already. Do you have any specific preferences?",
    createdAt: new Date().toISOString(),
    threadId: "thread-2",
    parentId: null,
  },
];

const generateId = (): string =>
  `undefined-undefined`;

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const isSameDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const Chat: FC = () => {
  const [state, setState] = useState<ChatState>({
    threads: [],
    messages: [],
    activeThreadId: null,
    loadingThreads: true,
    loadingMessages: false,
    sendingMessage: false,
    error: null,
  });

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [showThreadPanel, setShowThreadPanel] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const resizing = useRef<boolean>(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(sidebarWidth);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        threads: mockInitialThreads,
        messages: mockInitialMessages,
        activeThreadId: mockInitialThreads[0]?.id ?? null,
        loadingThreads: false,
      }));
    }, 400);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.activeThreadId, state.messages.length, showThreadPanel, activeParentId]);

  const activeThreadMessages = useMemo(() => {
    if (!state.activeThreadId) return [];
    return state.messages
      .filter((m) => m.threadId === state.activeThreadId && !m.parentId)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [state.activeThreadId, state.messages]);

  const activeThreadReplies = useMemo(() => {
    if (!activeParentId) return [];
    return state.messages
      .filter((m) => m.parentId === activeParentId)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [activeParentId, state.messages]);

  const activeParentMessage = useMemo(
    () => state.messages.find((m) => m.id === activeParentId) ?? null,
    [activeParentId, state.messages]
  );

  const filteredThreads = useMemo(() => {
    if (!searchTerm.trim()) return state.threads;
    const term = searchTerm.toLowerCase();
    return state.threads.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        t.lastMessagePreview.toLowerCase().includes(term)
    );
  }, [searchTerm, state.threads]);

  const handleSelectThread = useCallback((threadId: string) => {
    setState((prev) => ({
      ...prev,
      activeThreadId: threadId,
    }));
    setActiveParentId(null);
    setShowThreadPanel(false);
  }, []);

  const handleCreateThread = useCallback(() => {
    const now = new Date().toISOString();
    const newThreadId = generateId();
    const title = `New thread undefined`;

    const newThread: ThreadSummary = {
      id: newThreadId,
      title,
      lastMessagePreview: "New conversation started.",
      updatedAt: now,
      unreadCount: 0,
    };

    const welcomeMessage: ChatMessage = {
      id: generateId(),
      author: "assistant",
      content: "New thread created. How can I help you?",
      createdAt: now,
      threadId: newThreadId,
      parentId: null,
    };

    setState((prev) => ({
      ...prev,
      threads: [newThread, ...prev.threads],
      messages: [...prev.messages, welcomeMessage],
      activeThreadId: newThreadId,
    }));
    setActiveParentId(null);
    setShowThreadPanel(false);
  }, [state.threads.length]);

  const handleChangeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInputValue(event.target.value);
    },
    []
  );

  const updateThreadSummaryFromMessage = useCallback(
    (message: ChatMessage) => {
      if (!message.threadId) return