import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap, Sparkles, Send,
  Globe, Database, Gamepad2, LayoutDashboard, Clock, FileCode, ChevronRight, ChevronLeft, Star, ExternalLink,
  Home, BookOpen, Users, Compass, HelpCircle, MessageSquare, GitBranch, ArrowUpDown, HardDrive,
  Bell, CreditCard, Menu, X, Terminal, FileText, User, Lock,
  Smartphone, Palette, Presentation, Play, BarChart3, RefreshCw, LayoutGrid, List as ListIcon,
  Box, Cog, PenTool, Table2, Link2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import ArtifactTypeCarousel, { ARTIFACT_TYPE_OPTIONS } from "@/components/ArtifactTypeCarousel";
import LZString from "lz-string";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { Project, Notification } from "@shared/schema";
import { Check, CheckCheck, Trash2 } from "lucide-react";

interface UsageData {
  plan: string;
  daily: { executions: { used: number; limit: number }; aiCalls: { used: number; limit: number }; credits?: { used: number; limit: number } };
  storage: { usedMb: number; limitMb: number };
  projects: { count: number; limit: number };
  totals: { executions: number; aiCalls: number };
  resetsAt: string;
  agentMode?: string;
  codeOptimizationsEnabled?: boolean;
  creditAlertThreshold?: number;
  creditAlertTriggered?: boolean;
}

const LANG_ICONS: Record<string, { color: string; bg: string; label: string; borderAccent: string }> = {
  javascript: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "JS", borderAccent: "border-l-yellow-400" },
  typescript: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "TS", borderAccent: "border-l-blue-400" },
  python: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "PY", borderAccent: "border-l-green-400" },
  go: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "GO", borderAccent: "border-l-cyan-400" },
  ruby: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "RB", borderAccent: "border-l-red-400" },
  cpp: { color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", label: "C++", borderAccent: "border-l-indigo-400" },
  java: { color: "text-red-500", bg: "bg-red-600/10 border-red-600/20", label: "JV", borderAccent: "border-l-red-500" },
  rust: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "RS", borderAccent: "border-l-orange-400" },
  bash: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "SH", borderAccent: "border-l-slate-400" },
  html: { color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", label: "HT", borderAccent: "border-l-orange-500" },
};

const APP_CATEGORIES = [
  {
    id: "web", label: "Web", icon: Globe,
    prompts: [
      "Portfolio website with 3D scroll animations and project showcase gallery",
      "SaaS landing page with animated pricing tiers, testimonials carousel, and waitlist signup",
      "Restaurant website with online menu, reservation system, and chef's blog",
      "E-commerce storefront with product filtering, cart, and checkout flow",
      "Personal blog with markdown support, syntax highlighting, and RSS feed",
      "Community forum with threaded discussions, upvoting, and user profiles",
    ],
  },
  {
    id: "mobile", label: "Mobile", icon: Smartphone,
    prompts: [
      "Fitness tracker PWA with workout logging, progress charts, and streak system",
      "Habit tracking app with daily streaks, notifications, and analytics dashboard",
      "Social recipe sharing app with ingredient scanner and meal planning calendar",
      "Language flashcard app with spaced repetition algorithm and pronunciation guide",
      "Expense splitting app for groups with receipt scanning and payment tracking",
      "Meditation app with guided sessions, ambient sounds, and mood journaling",
    ],
  },
  {
    id: "slides", label: "Slides", icon: Presentation,
    prompts: [
      "Startup pitch deck with animated transitions and speaker notes",
      "Interactive presentation with live audience polling and Q&A",
      "Product launch slide deck with embedded demo videos and timeline",
      "Educational slideshow with quiz slides and progress tracking",
      "Conference talk with code syntax highlighting and live demos",
      "Sales deck with dynamic charts and data integration",
    ],
  },
  {
    id: "animation", label: "Animation", icon: Play,
    prompts: [
      "Interactive particle system playground with physics controls and presets",
      "CSS animation showcase with timeline editor and code export",
      "Animated infographic builder with data-driven motion graphics",
      "Lottie animation preview tool with speed controls and layer inspection",
      "Scroll-triggered animation demo with parallax effects and reveal transitions",
      "Procedural generative art canvas with tweakable parameters and export",
    ],
  },
  {
    id: "design", label: "Design", icon: Palette,
    prompts: [
      "Collaborative whiteboard tool with real-time drawing and sticky notes",
      "Color palette generator with accessibility contrast checker and export options",
      "Mood board creator with drag-and-drop image arrangement and font pairing",
      "Design system documentation site with live component previews",
      "SVG icon editor with path manipulation and batch export tools",
      "Brand identity kit generator with logo variations and style guide output",
    ],
  },
  {
    id: "data-visualization", label: "Data Viz", icon: BarChart3,
    prompts: [
      "Real-time stock market dashboard with WebSocket feeds and candlestick charts",
      "COVID-style epidemic tracker with interactive maps and trend analysis",
      "Personal finance dashboard with spending categories and budget forecasting",
      "GitHub contribution analytics tool with repository comparison charts",
      "Weather data visualization with historical trends and interactive globe",
      "Social media analytics dashboard with engagement metrics and growth charts",
    ],
  },
  {
    id: "automation", label: "Automation", icon: Cog,
    prompts: [
      "File watcher that auto-organizes downloads by type and date",
      "Email digest automation that summarizes daily notifications",
      "Data pipeline that fetches, transforms, and stores API data on a schedule",
      "Automated backup script with rotation, compression, and cloud sync",
      "Web scraper with scheduling, deduplication, and CSV export",
      "Log monitoring bot that alerts on error patterns and anomalies",
    ],
  },
  {
    id: "3d-game", label: "3D Game", icon: Gamepad2,
    prompts: [
      "3D racing game with physics engine, nitro boost, and procedural tracks",
      "Multiplayer trivia game with real-time scoring and category selection",
      "Roguelike dungeon crawler with procedural generation and inventory system",
      "Tower defense game with upgrade paths, wave system, and leaderboard",
      "2D platformer with level editor, collectibles, and speedrun timer",
      "Card battle game with deck building, turn-based combat, and AI opponent",
    ],
  },
  {
    id: "document", label: "Document", icon: PenTool,
    prompts: [
      "Markdown editor with live preview, syntax highlighting, and export to PDF",
      "Rich text editor with formatting toolbar, image embedding, and templates",
      "Collaborative note-taking app with tagging, search, and version history",
      "Resume builder with multiple templates and PDF export",
      "Meeting notes app with agenda templates, action items, and sharing",
      "Technical documentation site with sidebar navigation and code examples",
    ],
  },
  {
    id: "spreadsheet", label: "Spreadsheet", icon: Table2,
    prompts: [
      "Budget tracker spreadsheet with categories, charts, and monthly comparison",
      "Project timeline spreadsheet with Gantt chart and resource allocation",
      "Inventory management grid with formulas, sorting, and CSV import/export",
      "Grade book spreadsheet with weighted averages and student analytics",
      "Sales pipeline tracker with deal stages, probability, and forecasting",
      "Data cleaning tool with column mapping, deduplication, and validation",
    ],
  },
  {
    id: "document", label: "Document", icon: FileText,
    prompts: [
      "Generate a professional project proposal PDF with executive summary, timeline, and budget",
      "Create a business report DOCX with charts data, findings, and recommendations",
      "Build a resume/CV generator that exports to PDF with customizable sections",
      "Generate an invoice PDF with line items, tax calculations, and company branding",
      "Create a meeting minutes DOCX template with action items and attendee list",
      "Generate a technical specification document with diagrams and code snippets",
    ],
  },
  {
    id: "cli", label: "CLI Tool", icon: Terminal,
    prompts: [
      "Git workflow CLI with interactive branch management and commit templates",
      "Database migration tool with rollback support and schema diff viewer",
      "Log analyzer CLI with pattern matching, filtering, and export to CSV",
      "Project scaffolding CLI with template system and plugin architecture",
      "Server health monitoring CLI with dashboard view and alert notifications",
      "File batch processor with glob patterns, transformations, and dry-run mode",
    ],
  },
];

function ECodeLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
      <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
      <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
    </svg>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLang, setNewProjectLang] = useState("javascript");
  const [newProjectPrivate, setNewProjectPrivate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<"claude" | "gpt" | "gemini">("gpt");
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteTargetProject, setDeleteTargetProject] = useState<{ id: string; name: string } | null>(null);
  const [sidebarNav, setSidebarNav] = useState<"home" | "projects">("home");
  const [sortBy, setSortBy] = useState<"modified" | "name">("modified");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"home" | "projects" | "notifications" | "profile">("home");
  const [generationStep, setGenerationStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const projectListRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState(APP_CATEGORIES[0].id);
  const [promptSeed, setPromptSeed] = useState(0);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateLangFilter, setTemplateLangFilter] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const TEMPLATE_CATEGORIES = [
    { id: "all", label: "All Templates" },
    { id: "frontend", label: "Frontend" },
    { id: "mobile", label: "Mobile" },
    { id: "backend", label: "Backend" },
    { id: "slides-video", label: "Slides & Video" },
    { id: "cli", label: "CLI & Scripts" },
    { id: "languages", label: "Languages" },
  ];

  const TEMPLATE_CATEGORY_MAP: Record<string, string> = {
    "react-app": "frontend",
    "html-css-js": "frontend",
    "express-api": "backend",
    "python-flask": "backend",
    "go-server": "backend",
    "node-cli": "cli",
    "bash-script": "cli",
    "ruby-script": "cli",
    "cpp-app": "languages",
    "java-app": "languages",
    "rust-app": "languages",
    "mobile-blank": "mobile",
    "mobile-tabs": "mobile",
    "mobile-social-feed": "mobile",
    "pitch-deck": "slides-video",
    "tech-talk": "slides-video",
    "portfolio-slides": "slides-video",
    "product-demo-video": "slides-video",
    "explainer-video": "slides-video",
    "social-intro-video": "slides-video",
    "canvas-animation": "frontend",
    "design-canvas": "frontend",
    "data-dashboard": "frontend",
    "automation-script": "cli",
    "threejs-game": "frontend",
    "markdown-editor": "frontend",
    "spreadsheet-app": "frontend",
  };

  const getExamplePrompts = useCallback((categoryId: string, seed: number) => {
    const cat = APP_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return [];
    const shuffled = [...cat.prompts];
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
  }, []);

  const examplePrompts = getExamplePrompts(selectedCategory, promptSeed);

  const scrollCategories = (direction: "left" | "right") => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  const handlePullStart = useCallback((e: React.TouchEvent) => {
    const el = projectListRef.current;
    if (el && el.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === 0) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 80));
    }
  }, []);

  const handlePullEnd = useCallback(() => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] }).then(() => {
        setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 500);
      });
    } else {
      setPullDistance(0);
    }
    pullStartY.current = 0;
  }, [pullDistance, queryClient]);

  const projectsQuery = useQuery<Project[]>({ queryKey: ["/api/projects"], staleTime: 30000 });
  const usageQuery = useQuery<UsageData>({ queryKey: ["/api/user/usage"], staleTime: 60000 });

  interface PendingInvite {
    id: string;
    projectId: string;
    email: string;
    role: string;
    invitedBy: string;
    status: string;
    createdAt: string;
    projectName: string;
    inviterEmail: string;
  }

  const pendingInvitesQuery = useQuery<PendingInvite[]>({
    queryKey: ["/api/invites/pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invites/pending");
      return res.json();
    },
    staleTime: 30000,
  });

  const notificationsQuery = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications?limit=50");
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const allNotifications = notificationsQuery.data?.notifications ?? [];

  const notifCategoryIcon = (category: string) => {
    switch (category) {
      case "agent": return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case "billing": return <CreditCard className="w-3.5 h-3.5 text-amber-400" />;
      case "deployment": return <Globe className="w-3.5 h-3.5 text-green-400" />;
      case "security": return <Lock className="w-3.5 h-3.5 text-red-400" />;
      case "team": return <Users className="w-3.5 h-3.5 text-[#0079F2]" />;
      default: return <Bell className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />;
    }
  };

  const formatNotifTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  useEffect(() => {
    if (projectsQuery.data && projectsQuery.data.length === 0) {
      const seen = localStorage.getItem("ecode_onboarding_seen");
      if (!seen) setShowOnboarding(true);
    }
  }, [projectsQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mcpPayload = params.get("mcp");
    if (mcpPayload) {
      try {
        const decoded = JSON.parse(atob(mcpPayload));
        if (decoded.displayName && decoded.baseUrl) {
          const safePayload = { displayName: decoded.displayName, baseUrl: decoded.baseUrl };
          sessionStorage.setItem("pending_mcp_server", JSON.stringify(safePayload));
          toast({
            title: "MCP Server Install",
            description: `Ready to add "${decoded.displayName}" to a project. Open a project to complete setup.`,
          });
        }
      } catch {
        toast({ title: "Invalid MCP install link", variant: "destructive" });
      }
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const acceptInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/invites/${inviteId}/accept`);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invites/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Invite accepted", description: `You now have access to "${result.projectName || "the project"}"` });
      if (result.projectId) setLocation(`/project/${result.projectId}`);
    },
    onError: (err: any) => { toast({ title: "Failed to accept invite", description: err.message, variant: "destructive" }); },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/invites/${inviteId}/decline`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invites/pending"] });
      toast({ title: "Invite declined" });
    },
    onError: (err: any) => { toast({ title: "Failed to decline invite", description: err.message, variant: "destructive" }); },
  });

  const categoryToArtifactType: Record<string, string> = {
    web: "web-app", mobile: "mobile-app", slides: "slides", animation: "animation",
    design: "design", "data-visualization": "data-viz", automation: "automation",
    "3d-game": "3d-game", document: "document", spreadsheet: "spreadsheet",
  };

  const createProject = useMutation({
    mutationFn: async (data: { name: string; language: string; visibility?: string; artifactType?: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      setNewProjectName("");
      setNewProjectPrivate(false);
      setLocation(`/project/${project.id}`);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const generateProject = useMutation({
    mutationFn: async ({ prompt, model, outputType }: { prompt: string; model: string; outputType?: string }) => {
      setGenerationError(null);
      setGenerationStep(0);
      const res = await apiRequest("POST", "/api/projects/generate", { prompt, model, outputType: outputType || selectedCategory });
      return res.json();
    },
    onSuccess: (data: { project: Project }) => {
      setGenerationStep(0);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setAiPrompt("");
      setLocation(`/project/${data.project.id}`);
    },
    onError: (err: any) => {
      setGenerationStep(0);
      setGenerationError(err.message || "Something went wrong. Please try again.");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/projects/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project deleted" }); },
    onError: (err: any) => { toast({ title: "Failed to delete project", description: err.message || "Could not delete the project.", variant: "destructive" }); },
  });

  const duplicateProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/projects/${id}/duplicate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project duplicated" }); },
    onError: (err: any) => { toast({ title: "Failed to duplicate project", description: err.message || "Could not duplicate the project.", variant: "destructive" }); },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const compressedPrompt = params.get("prompt");
    const stack = params.get("stack");
    const referrer = params.get("referrer");

    if (referrer) {
      sessionStorage.setItem("ecode_referrer", referrer);
    }

    if (stack && stack !== "design" && stack !== "build") {
      toast({ title: "Invalid link", description: `Invalid stack mode "${stack}". Expected "design" or "build".`, variant: "destructive" });
      window.history.replaceState({}, "", "/dashboard");
      return;
    }

    if (compressedPrompt) {
      if (compressedPrompt.length > 10000) {
        toast({ title: "Invalid link", description: "The prompt parameter is too large.", variant: "destructive" });
        window.history.replaceState({}, "", "/dashboard");
        return;
      }
      const decompressed = LZString.decompressFromEncodedURIComponent(compressedPrompt);
      if (!decompressed) {
        toast({ title: "Invalid link", description: "Failed to decompress the prompt. The link may be malformed.", variant: "destructive" });
        window.history.replaceState({}, "", "/dashboard");
        return;
      }
      const outputType = stack === "design" ? "design" : "web";
      setAiPrompt(decompressed);
      if (outputType !== "web") {
        setSelectedCategory(outputType);
      }
      toast({ title: "Prompt loaded", description: "Your prompt has been pre-filled. Click Build to create your project." });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const userPlan = usageQuery.data?.plan || "free";
  const isFreePlan = userPlan === "free";

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}/visibility`, { visibility });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: `Project is now ${project.visibility}` });
    },
    onError: (err: any) => { toast({ title: "Failed to update visibility", description: err.message, variant: "destructive" }); },
  });

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const handleVisibilityToggle = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (project.visibility === "public") {
      if (isFreePlan) {
        toast({ title: "Upgrade required", description: "Private projects require a Core or Pro plan.", variant: "destructive" });
        return;
      }
      toggleVisibility.mutate({ id: project.id, visibility: "private" });
    } else {
      toggleVisibility.mutate({ id: project.id, visibility: "public" });
    }
  };

  const createFromTemplate = useMutation({
    mutationFn: async ({ templateId, visibility }: { templateId: string; visibility?: string }) => {
      const res = await apiRequest("POST", "/api/projects/from-template", { templateId, visibility: visibility || "public" });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation(`/project/${project.id}`);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message || "Failed to create project from template", variant: "destructive" }); },
  });

  const timeAgo = (date: string | Date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const projects = (projectsQuery.data || [])
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  const TEMPLATE_UI: Record<string, { icon: typeof Code2; gradient: string; iconColor: string; borderColor: string; snippet: string }> = {
    "react-app": { icon: Globe, gradient: "from-[#0079F2] to-[#00B4D8]", iconColor: "text-[#0079F2]", borderColor: "border-[#0079F2]/30 hover:border-[#0079F2]/60", snippet: "export default function App() {" },
    "express-api": { icon: Database, gradient: "from-[#0CCE6B] to-[#00B4D8]", iconColor: "text-[#0CCE6B]", borderColor: "border-[#0CCE6B]/30 hover:border-[#0CCE6B]/60", snippet: "app.get('/api', (req, res) =>" },
    "python-flask": { icon: Terminal, gradient: "from-[#7C65CB] to-[#A371F7]", iconColor: "text-[#7C65CB]", borderColor: "border-[#7C65CB]/30 hover:border-[#7C65CB]/60", snippet: "@app.route('/')" },
    "node-cli": { icon: FileCode, gradient: "from-[#F59E0B] to-[#EF4444]", iconColor: "text-[#F59E0B]", borderColor: "border-[#F59E0B]/30 hover:border-[#F59E0B]/60", snippet: "process.argv.slice(2)" },
    "html-css-js": { icon: FileText, gradient: "from-[#E34F26] to-[#F06529]", iconColor: "text-[#E34F26]", borderColor: "border-[#E34F26]/30 hover:border-[#E34F26]/60", snippet: "<!DOCTYPE html>" },
    "go-server": { icon: Globe, gradient: "from-[#00ADD8] to-[#00758D]", iconColor: "text-cyan-400", borderColor: "border-cyan-400/30 hover:border-cyan-400/60", snippet: "http.HandleFunc(\"/\", handler)" },
    "cpp-app": { icon: Code2, gradient: "from-[#6366F1] to-[#4338CA]", iconColor: "text-indigo-400", borderColor: "border-indigo-400/30 hover:border-indigo-400/60", snippet: "#include <iostream>" },
    "java-app": { icon: Code2, gradient: "from-[#EF4444] to-[#B91C1C]", iconColor: "text-red-500", borderColor: "border-red-500/30 hover:border-red-500/60", snippet: "public static void main(String[])" },
    "rust-app": { icon: Code2, gradient: "from-[#F97316] to-[#C2410C]", iconColor: "text-orange-400", borderColor: "border-orange-400/30 hover:border-orange-400/60", snippet: "fn main() {" },
    "ruby-script": { icon: Code2, gradient: "from-[#EF4444] to-[#DC2626]", iconColor: "text-red-400", borderColor: "border-red-400/30 hover:border-red-400/60", snippet: "class TaskManager" },
    "bash-script": { icon: Terminal, gradient: "from-[#64748B] to-[#475569]", iconColor: "text-slate-400", borderColor: "border-slate-400/30 hover:border-slate-400/60", snippet: "#!/bin/bash" },
    "mobile-blank": { icon: Smartphone, gradient: "from-[#8B5CF6] to-[#6D28D9]", iconColor: "text-purple-400", borderColor: "border-purple-400/30 hover:border-purple-400/60", snippet: '<View style={styles.container}>' },
    "mobile-tabs": { icon: Smartphone, gradient: "from-[#EC4899] to-[#BE185D]", iconColor: "text-pink-400", borderColor: "border-pink-400/30 hover:border-pink-400/60", snippet: "const [activeTab, setActiveTab]" },
    "mobile-social-feed": { icon: Smartphone, gradient: "from-[#F97316] to-[#C2410C]", iconColor: "text-orange-400", borderColor: "border-orange-400/30 hover:border-orange-400/60", snippet: "<FlatList data={posts}" },
    "pitch-deck": { icon: Presentation, gradient: "from-[#F59E0B] to-[#D97706]", iconColor: "text-amber-400", borderColor: "border-amber-400/30 hover:border-amber-400/60", snippet: "📊 Pitch Deck Slides" },
    "tech-talk": { icon: Presentation, gradient: "from-[#0EA5E9] to-[#0284C7]", iconColor: "text-sky-400", borderColor: "border-sky-400/30 hover:border-sky-400/60", snippet: "🎤 Technical Talk" },
    "portfolio-slides": { icon: Presentation, gradient: "from-[#8B5CF6] to-[#7C3AED]", iconColor: "text-violet-400", borderColor: "border-violet-400/30 hover:border-violet-400/60", snippet: "🎨 Portfolio Showcase" },
    "product-demo-video": { icon: Play, gradient: "from-[#EF4444] to-[#DC2626]", iconColor: "text-red-400", borderColor: "border-red-400/30 hover:border-red-400/60", snippet: "🎬 Product Demo" },
    "explainer-video": { icon: Play, gradient: "from-[#10B981] to-[#059669]", iconColor: "text-emerald-400", borderColor: "border-emerald-400/30 hover:border-emerald-400/60", snippet: "📹 Explainer Video" },
    "social-intro-video": { icon: Play, gradient: "from-[#EC4899] to-[#DB2777]", iconColor: "text-pink-400", borderColor: "border-pink-400/30 hover:border-pink-400/60", snippet: "📱 Social Intro" },
  };
  const defaultUI = { icon: Code2, gradient: "from-[#6366F1] to-[#4338CA]", iconColor: "text-indigo-400", borderColor: "border-indigo-400/30 hover:border-indigo-400/60", snippet: "" };

  const templatesQuery = useQuery<{ id: string; name: string; description: string; language: string }[]>({
    queryKey: ["/api/templates"],
  });

  const FALLBACK_TEMPLATES = [
    { id: "react-app", name: "React App", description: "React frontend with components and hooks", language: "TypeScript" },
    { id: "express-api", name: "Express API", description: "REST API with Express and routing", language: "JavaScript" },
    { id: "python-flask", name: "Python Flask", description: "Flask web server with routing", language: "Python" },
    { id: "node-cli", name: "Node CLI", description: "Command-line tool with Node.js", language: "JavaScript" },
    { id: "html-css-js", name: "HTML/CSS/JS", description: "Static website with vanilla web tech", language: "HTML" },
    { id: "go-server", name: "Go Server", description: "HTTP server with Go and net/http", language: "Go" },
    { id: "cpp-app", name: "C++ App", description: "C++ program with classes and STL", language: "C++" },
    { id: "java-app", name: "Java App", description: "Java application with OOP patterns", language: "Java" },
    { id: "rust-app", name: "Rust App", description: "Rust program with structs and enums", language: "Rust" },
    { id: "ruby-script", name: "Ruby Script", description: "Ruby script with classes and modules", language: "Ruby" },
    { id: "bash-script", name: "Bash Script", description: "Shell script with functions", language: "Bash" },
    { id: "mobile-blank", name: "Mobile App (Blank)", description: "Blank React Native/Expo mobile app", language: "TypeScript" },
    { id: "mobile-tabs", name: "Mobile App (Tab Navigation)", description: "React Native/Expo app with tab navigation", language: "TypeScript" },
    { id: "mobile-social-feed", name: "Mobile App (Social Feed)", description: "React Native/Expo social feed app", language: "TypeScript" },
    { id: "pitch-deck", name: "Pitch Deck", description: "Startup pitch deck with problem, solution & metrics slides", language: "Slides" },
    { id: "tech-talk", name: "Technical Talk", description: "Conference-style presentation with code examples", language: "Slides" },
    { id: "portfolio-slides", name: "Portfolio Showcase", description: "Creative portfolio with project highlights", language: "Slides" },
    { id: "product-demo-video", name: "Product Demo", description: "Product walkthrough video with scenes & transitions", language: "Video" },
    { id: "explainer-video", name: "Explainer Video", description: "Animated explainer with text overlays & shapes", language: "Video" },
    { id: "social-intro-video", name: "Social Intro", description: "Short social media intro clip", language: "Video" },
  ];

  const templateData = templatesQuery.data && templatesQuery.data.length > 0 ? templatesQuery.data : FALLBACK_TEMPLATES;
  const TEMPLATES = templateData.map(t => {
    const ui = TEMPLATE_UI[t.id] || defaultUI;
    return { id: t.id, name: t.name, desc: t.description, icon: ui.icon, gradient: ui.gradient, iconColor: ui.iconColor, borderColor: ui.borderColor, lang: t.language, snippet: ui.snippet };
  });

  const GENERATION_STEPS = [
    "Analyzing your prompt...",
    "Designing project structure...",
    "Generating code files...",
    "Setting up configuration...",
    "Finalizing your project...",
  ];

  useEffect(() => {
    if (!generateProject.isPending) return;
    const interval = setInterval(() => {
      setGenerationStep((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [generateProject.isPending]);

  const scrollTemplates = (direction: "left" | "right") => {
    if (templatesRef.current) {
      const scrollAmount = 240;
      templatesRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
  };

  const sidebarLinks = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "projects" as const, icon: FileCode, label: "My Projects" },
  ];

  const sidebarSecondaryLinks = [
    { icon: Compass, label: "Templates", action: () => setDialogOpen(true), testId: "nav-templates" },
    { icon: Box, label: "Frameworks", action: () => setLocation("/frameworks"), testId: "nav-frameworks" },
    { icon: Link2, label: "Open in E-Code", action: () => setLocation("/open"), testId: "nav-open-in-ecode" },
    { icon: MessageSquare, label: "Community", action: () => toast({ title: "Community", description: "Community forum coming soon." }), testId: "nav-community-link" },
  ];

  const mobileHomeContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)]">
      <div className="max-w-[680px] mx-auto px-4">
        <div className="pt-8 pb-4 text-center relative">
          <h1 className="relative text-[28px] font-bold text-[var(--ide-text)] mb-2 tracking-tight leading-tight" data-testid="text-mobile-hero">What will you create?</h1>
          <p className="relative text-[12px] text-[var(--ide-text-secondary)] max-w-xs mx-auto leading-relaxed">Describe your idea and AI will build it</p>
        </div>
        <form onSubmit={handleGenerateSubmit} className="mb-6">
          <div className="relative rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden focus-within:border-[#0079F2]/40 focus-within:shadow-sm transition-all">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Build me a todo app with dark mode..."
              rows={3}
              className="w-full bg-transparent text-[14px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] px-4 pt-4 pb-2 resize-none focus:outline-none leading-relaxed"
              disabled={generateProject.isPending}
              data-testid="input-ai-prompt-mobile"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
                }
              }}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                {(["claude", "gpt", "gemini"] as const).map(m => {
                  const cfg = { claude: { label: "Claude", active: "bg-[#7C65CB]/10 text-[#7C65CB] border-[#7C65CB]/25" }, gpt: { label: "GPT-4o", active: "bg-[#0CCE6B]/10 text-[#059669] border-[#0CCE6B]/25" }, gemini: { label: "Gemini", active: "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/25" } }[m];
                  return (
                    <button key={m} type="button" onClick={() => setAiModel(m)} className={`text-[11px] px-2.5 py-1.5 rounded-md transition-all font-medium border ${aiModel === m ? cfg.active : "text-[#9CA3AF] border-transparent hover:bg-[var(--ide-surface)]"}`} data-testid={`button-model-${m}-mobile`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <Button type="submit" size="sm" className="h-8 px-4 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg text-[12px] font-semibold gap-1" disabled={generateProject.isPending || aiPrompt.trim().length < 3} data-testid="button-generate-mobile">
                {generateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </form>
        {generateProject.isPending && (
          <div className="mb-6 rounded-xl border border-[#7C65CB]/20 bg-[#7C65CB]/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C65CB] to-[#0079F2] flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--ide-text)]">Building your app...</p>
                <p className="text-[10px] text-[var(--ide-text-secondary)] mt-0.5">~15-30 seconds</p>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7C65CB] to-[#0079F2] transition-all duration-700 ease-out" style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mb-4" data-testid="section-categories-mobile">
          <ArtifactTypeCarousel
            selectedType={selectedCategory}
            onSelectType={(type) => { setSelectedCategory(type || APP_CATEGORIES[0].id); setPromptSeed(prev => prev + 1); }}
            size="sm"
          />
        </div>
        <div className="mb-6" data-testid="section-example-prompts-mobile">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-medium text-[var(--ide-text-muted)]" data-testid="text-example-prompts-label-mobile">Try an example prompt</span>
            <button
              onClick={() => setPromptSeed(prev => prev + 1)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
              data-testid="button-refresh-prompts-mobile"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={`${selectedCategory}-${promptSeed}-${idx}`}
                onClick={() => setAiPrompt(prompt)}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-panel)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:border-[#0079F2]/30 hover:bg-[#0079F2]/5 transition-all text-left leading-relaxed"
                data-testid={`prompt-pill-${idx}-mobile`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2.5">Templates</h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4" ref={templatesRef}>
            {TEMPLATES.map((tmpl) => (
              <button key={tmpl.name} className={`flex items-center gap-2.5 p-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] transition-all active:scale-[0.97] min-w-[160px] shrink-0`} onClick={() => createFromTemplate.mutate({ templateId: tmpl.id })} disabled={createFromTemplate.isPending} data-testid={`template-${tmpl.id}-mobile`}>
                <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center border border-[var(--ide-hover)] shrink-0">
                  <tmpl.icon className={`w-4 h-4 ${tmpl.iconColor}`} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--ide-text)] truncate">{tmpl.name}</p>
                  <p className="text-[9px] text-[var(--ide-text-secondary)]">{tmpl.lang}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {!projectsQuery.isLoading && projects.length > 0 && (
          <div className="pb-24">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Recent</h3>
              <button className="text-[11px] text-[#0079F2] font-medium" onClick={() => setMobileTab("projects")} data-testid="button-view-all-mobile">
                View all <ChevronRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="space-y-2">
              {projects.slice(0, 5).map((project) => {
                const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                return (
                  <div key={project.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] active:scale-[0.98] transition-all cursor-pointer" onClick={() => setLocation(`/project/${project.id}`)} data-testid={`card-project-${project.id}-mobile`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                      {langInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[14px] text-[var(--ide-text)] truncate">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[var(--ide-text-secondary)] capitalize">{project.language}</span>
                        <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                        <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!projectsQuery.isLoading && projects.length === 0 && (
          <div className="pb-24 text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/10 to-[#7C65CB]/10 border border-[#0079F2]/15 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-[#0079F2]" />
            </div>
            <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold">No projects yet</p>
            <p className="text-[12px] text-[var(--ide-text-secondary)] max-w-xs mx-auto mb-5 leading-relaxed">Describe your idea above or tap + to create one</p>
          </div>
        )}
      </div>
    </div>
  );

  const mobileProjectsContent = (
    <div
      ref={projectListRef}
      className="flex-1 overflow-y-auto bg-[var(--ide-panel)]"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance > 0 ? pullDistance : 40 }}>
          <div className={`w-6 h-6 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full ${isRefreshing || pullDistance > 50 ? "animate-spin" : ""}`} style={{ opacity: Math.min(1, pullDistance / 50) }} />
        </div>
      )}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--ide-text)]" data-testid="text-my-projects-mobile">My Projects</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF]" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7.5 bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 w-36 text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40" data-testid="input-search-projects-mobile" />
            </div>
          </div>
        </div>
        {projectsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
                <Skeleton className="w-10 h-10 rounded-lg bg-[var(--ide-surface)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded bg-[var(--ide-surface)]" />
                  <Skeleton className="h-3 w-20 rounded bg-[var(--ide-surface)]" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]">
            <Code2 className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--ide-text)] mb-1 font-medium">{searchQuery ? "No matching projects" : "No projects yet"}</p>
            <p className="text-[12px] text-[var(--ide-text-secondary)]">{searchQuery ? "Try a different search" : "Tap + to create your first project"}</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-24">
            {projects.map((project) => {
              const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
              return (
                <div key={project.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] active:scale-[0.98] transition-all cursor-pointer" onClick={() => setLocation(`/project/${project.id}`)} data-testid={`card-project-${project.id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                    {langInfo.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[14px] text-[var(--ide-text)] truncate">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--ide-text-secondary)] capitalize">{project.language}</span>
                      <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                      <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-auto cursor-pointer transition-all ${project.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} onMouseEnter={() => setHoveredCardId(project.id)} onMouseLeave={() => setHoveredCardId(null)} onClick={(e) => handleVisibilityToggle(e, project)} data-testid={`badge-visibility-${project.id}`}>{hoveredCardId === project.id ? (project.visibility === "public" ? "Make private" : "Make public") : (project.visibility === "private" ? "Private" : project.visibility === "team" ? "Team" : "Public")}</span>
                      {project.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#059669] border border-[#0CCE6B]/20 font-medium">Live</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-md text-[#9CA3AF] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                      <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                        <Copy className="w-3 h-3" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                      <DropdownMenuItem className="gap-2 text-[11px] text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                        <Trash className="w-3 h-3" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const mobileNotificationsContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)] px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--ide-text)]">Notifications</h2>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-[11px] text-[#0079F2] hover:text-[#0068D6] rounded-lg"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="mobile-button-mark-all-read"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
          </Button>
        )}
      </div>
      {(pendingInvitesQuery.data?.length || 0) > 0 && (
        <div className="space-y-3 mb-4">
          {pendingInvitesQuery.data!.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] p-4" data-testid={`mobile-notification-invite-${invite.id}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0079F2]/15 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-[#0079F2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--ide-text)]">
                    <span className="font-semibold">{invite.inviterEmail.split("@")[0]}</span> invited you to collaborate on <span className="font-semibold">{invite.projectName}</span>
                  </p>
                  <p className="text-[11px] text-[var(--ide-text-muted)] mt-1 capitalize">Role: {invite.role}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-8 px-4 text-xs bg-[#0079F2] hover:bg-[#0068D6] text-white rounded-lg font-medium"
                      onClick={() => acceptInviteMutation.mutate(invite.id)}
                      disabled={acceptInviteMutation.isPending}
                      data-testid={`mobile-button-accept-invite-${invite.id}`}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-4 text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-lg"
                      onClick={() => declineInviteMutation.mutate(invite.id)}
                      disabled={declineInviteMutation.isPending}
                      data-testid={`mobile-button-decline-invite-${invite.id}`}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {allNotifications.length > 0 ? (
        <div className="space-y-2">
          {allNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-xl border bg-[var(--ide-panel)] p-4 transition-all ${notif.isRead ? "border-[var(--ide-border)] opacity-70" : "border-[#0079F2]/30 bg-[#0079F2]/5"}`}
              data-testid={`mobile-notification-${notif.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${notif.isRead ? "bg-[var(--ide-surface)]" : "bg-[#0079F2]/15"}`}>
                  {notifCategoryIcon(notif.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--ide-text)]">{notif.title}</p>
                  <p className="text-[12px] text-[var(--ide-text-secondary)] mt-0.5">{notif.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-[var(--ide-text-muted)]">{formatNotifTime(notif.createdAt as unknown as string)}</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{notif.category}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {!notif.isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-md"
                        onClick={() => markReadMutation.mutate(notif.id)}
                        data-testid={`mobile-button-mark-read-${notif.id}`}
                      >
                        <Check className="w-3 h-3 mr-1" /> Mark read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-[10px] text-red-400 hover:text-red-300 rounded-md"
                      onClick={() => deleteNotificationMutation.mutate(notif.id)}
                      data-testid={`mobile-button-delete-notification-${notif.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (pendingInvitesQuery.data?.length || 0) === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]">
          <Bell className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-3" />
          <p className="text-[14px] text-[var(--ide-text)] mb-1 font-medium" data-testid="text-no-notifications-mobile">No notifications</p>
          <p className="text-[12px] text-[var(--ide-text-secondary)]">You're all caught up</p>
        </div>
      ) : null}
    </div>
  );

  const mobileProfileContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)] px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-white">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
          <p className="text-[12px] text-[var(--ide-text-secondary)] truncate">{user?.email}</p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden mb-4 shadow-sm">
        <div className="px-4 py-3 border-b border-[var(--ide-border)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--ide-text-secondary)]">Plan</span>
            <span className="text-[12px] font-medium text-[#0079F2] capitalize">{usageQuery.data?.plan || "free"}</span>
          </div>
        </div>
        {usageQuery.data && (
          <>
            <div className="px-4 py-3 border-b border-[var(--ide-border)] space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Zap className="w-3 h-3" /> Runs</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.daily.executions.used}/{usageQuery.data.daily.executions.limit}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0CCE6B] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.executions.used / usageQuery.data.daily.executions.limit) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Sparkles className="w-3 h-3" /> Credits</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.daily.credits?.used || 0}/{usageQuery.data.daily.credits?.limit || 100}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0CCE6B] to-[#7C65CB] transition-all" style={{ width: `${Math.min(100, ((usageQuery.data.daily.credits?.used || 0) / (usageQuery.data.daily.credits?.limit || 100)) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.storage.usedMb}/{usageQuery.data.storage.limitMb} MB</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0079F2] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.storage.usedMb / usageQuery.data.storage.limitMb) * 100)}%` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="space-y-1.5 pb-24">
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/settings")} data-testid="mobile-profile-settings">
          <SettingsIcon className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Account Settings</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/teams")} data-testid="mobile-profile-teams">
          <Users className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Teams</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/pricing")} data-testid="mobile-profile-pricing">
          <CreditCard className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Upgrade Plan</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <div className="pt-3">
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-left active:scale-[0.98] transition-all" onClick={() => logout.mutate()} data-testid="mobile-profile-logout">
            <LogOut className="w-5 h-5 text-red-500" />
            <span className="text-[14px] text-red-500">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col ${"bg-[var(--ide-bg)] text-[var(--ide-text)]"}`}>
      {isMobile ? (
        <>
          <header className="flex items-center justify-between px-4 h-12 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 z-10">
            <div className="flex items-center gap-2">
              <ECodeLogo />
              <span className="text-[15px] font-bold text-[var(--ide-text)] tracking-tight">E-Code</span>
            </div>
            {mobileSearchOpen ? (
              <div className="flex items-center flex-1 ml-3">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                  <Input placeholder="Search Projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8 bg-[var(--ide-panel)] border border-[var(--ide-border)] h-9 w-full text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40" data-testid="input-mobile-search" autoFocus />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[var(--ide-text)]" onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }} data-testid="button-close-mobile-search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileSearchOpen(true)} data-testid="button-mobile-search">
                <Search className="w-4 h-4" />
              </button>
            )}
          </header>

          {mobileTab === "home" && mobileHomeContent}
          {mobileTab === "projects" && mobileProjectsContent}
          {mobileTab === "notifications" && mobileNotificationsContent}
          {mobileTab === "profile" && mobileProfileContent}

          <div className="flex items-stretch h-[56px] bg-[var(--ide-bg)] border-t border-[var(--ide-border)] shrink-0 z-40 mobile-safe-bottom" data-testid="mobile-dashboard-nav">
            {([
              { id: "home" as const, icon: Home, label: "Home" },
              { id: "projects" as const, icon: FileCode, label: "My Projects" },
              { id: "create" as const, icon: Plus, label: "Create" },
              { id: "notifications" as const, icon: Bell, label: "Notifs" },
              { id: "profile" as const, icon: User, label: "Profile" },
            ]).map(({ id, icon: Icon, label }) => {
              if (id === "create") {
                return (
                  <button key={id} className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all active:scale-90" onClick={() => setDialogOpen(true)} data-testid="mobile-tab-create">
                    <div className="w-10 h-10 rounded-xl bg-[#0079F2] flex items-center justify-center shadow-md -mt-3">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                  </button>
                );
              }
              const isActive = mobileTab === id;
              return (
                <button key={id} className="relative flex flex-col items-center justify-center gap-1 flex-1 transition-all active:scale-90" onClick={() => { if (id === "home" || id === "projects" || id === "notifications" || id === "profile") setMobileTab(id); }} data-testid={`mobile-tab-${id}`}>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-full bg-[#0079F2]" />}
                  <Icon className={`w-5 h-5 transition-all ${isActive ? "text-[#0079F2]" : "text-[#9CA3AF]"}`} />
                  <span className={`text-[10px] font-medium leading-none ${isActive ? "text-[#0079F2]" : "text-[#9CA3AF]"}`}>{label}</span>
                  {id === "notifications" && (unreadCount + (pendingInvitesQuery.data?.length || 0)) > 0 && <span className="absolute top-1.5 right-[calc(50%-2px)] translate-x-3 w-2.5 h-2.5 rounded-full bg-[#0079F2] ring-2 ring-[var(--ide-bg)]" />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
      <>
      <header className="flex items-center justify-between px-4 h-12 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]/60 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSidebarNav("home")}>
            <ECodeLogo />
            <span className="text-[15px] font-bold text-[var(--ide-text)] tracking-tight">E-Code</span>
          </div>
        </div>
        <div className="flex items-center flex-1 max-w-[400px] mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
            <Input
              placeholder="Search your Projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[var(--ide-panel)] border border-[var(--ide-border)] h-9 w-full text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
              data-testid="input-header-search"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium px-4 shadow-sm shadow-[#0079F2]/30" data-testid="button-new-project">
                <Plus className="w-3.5 h-3.5" /> Create Project
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
              <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => setDialogOpen(true)} data-testid="button-create-project">
                <Plus className="w-3.5 h-3.5" /> New Project
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => setLocation("/import?source=github")} data-testid="button-import-github">
                <GitBranch className="w-3.5 h-3.5" /> Import from GitHub
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                {(unreadCount + (pendingInvitesQuery.data?.length || 0)) > 0 ? (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#0079F2] text-[8px] font-bold text-white flex items-center justify-center animate-pulse" data-testid="badge-notification-count">{unreadCount + (pendingInvitesQuery.data?.length || 0)}</span>
                ) : (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[var(--ide-surface)] text-[7px] font-bold text-[var(--ide-text-muted)] flex items-center justify-center" data-testid="badge-notification-count">0</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30 p-0">
              <div className="px-3 py-2.5 border-b border-[var(--ide-border)] flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--ide-text)]">Notifications</p>
                <div className="flex items-center gap-2">
                  {(unreadCount + (pendingInvitesQuery.data?.length || 0)) > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0079F2]/15 text-[#0079F2] font-semibold">{unreadCount + (pendingInvitesQuery.data?.length || 0)} new</span>
                  )}
                  {unreadCount > 0 && (
                    <button
                      className="text-[9px] text-[#0079F2] hover:underline"
                      onClick={(e) => { e.stopPropagation(); markAllReadMutation.mutate(); }}
                      data-testid="button-mark-all-read"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
              {((pendingInvitesQuery.data?.length || 0) > 0 || allNotifications.length > 0) ? (
                <div className="max-h-80 overflow-y-auto">
                  {pendingInvitesQuery.data?.map((invite) => (
                    <div key={invite.id} className="px-3 py-2.5 border-b border-[var(--ide-border)] last:border-0 hover:bg-[var(--ide-surface)]/50" data-testid={`notification-invite-${invite.id}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#0079F2]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-[#0079F2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--ide-text)]">
                            <span className="font-medium">{invite.inviterEmail.split("@")[0]}</span> invited you to <span className="font-medium">{invite.projectName}</span>
                          </p>
                          <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5 capitalize">Role: {invite.role}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Button
                              size="sm"
                              className="h-6 px-3 text-[10px] bg-[#0079F2] hover:bg-[#0068D6] text-white rounded-md font-medium"
                              onClick={(e) => { e.stopPropagation(); acceptInviteMutation.mutate(invite.id); }}
                              disabled={acceptInviteMutation.isPending}
                              data-testid={`button-accept-invite-${invite.id}`}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-3 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded-md"
                              onClick={(e) => { e.stopPropagation(); declineInviteMutation.mutate(invite.id); }}
                              disabled={declineInviteMutation.isPending}
                              data-testid={`button-decline-invite-${invite.id}`}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {allNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-3 py-2.5 border-b border-[var(--ide-border)] last:border-0 transition-all ${notif.isRead ? "opacity-60" : "bg-[#0079F2]/5"}`}
                      data-testid={`notification-item-${notif.id}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${notif.isRead ? "bg-[var(--ide-surface)]" : "bg-[#0079F2]/15"}`}>
                          {notifCategoryIcon(notif.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-[var(--ide-text)]">{notif.title}</p>
                          <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-[var(--ide-text-muted)]">{formatNotifTime(notif.createdAt as unknown as string)}</span>
                            {!notif.isRead && (
                              <button
                                className="text-[9px] text-[#0079F2] hover:underline"
                                onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(notif.id); }}
                                data-testid={`button-mark-read-${notif.id}`}
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              className="text-[9px] text-red-400 hover:underline"
                              onClick={(e) => { e.stopPropagation(); deleteNotificationMutation.mutate(notif.id); }}
                              data-testid={`button-delete-notification-${notif.id}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-6 text-center">
                  <Bell className="w-5 h-5 text-[var(--ide-text-muted)] mx-auto mb-2" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-no-notifications">No notifications</p>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)]/50 cursor-pointer" data-testid="badge-cycles" onClick={() => setLocation("/pricing")}>
                  <CreditCard className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  <span className="text-[11px] font-medium text-[var(--ide-text-secondary)]">Free</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--ide-panel)] border-[var(--ide-border)] text-[var(--ide-text)] text-[11px]">
                Click to view plans
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={!isMobile && dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-[var(--ide-text)] text-lg font-bold">Create Project</DialogTitle>
                  <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Start from a template or create an empty project</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 mt-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                    <Input
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="pl-9 bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 rounded-lg text-[var(--ide-text)] text-xs placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40"
                      data-testid="input-template-search"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-[var(--ide-surface)]/50 rounded-lg p-0.5">
                    {(Object.keys(LANG_ICONS) as string[]).slice(0, 5).map((lang) => {
                      const info = LANG_ICONS[lang];
                      return (
                        <button key={lang} type="button" onClick={() => setTemplateLangFilter(templateLangFilter === lang ? null : lang)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${templateLangFilter === lang ? `${info.bg} ${info.color}` : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]"}`} data-testid={`filter-lang-${lang}`}>
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3 border-b border-[var(--ide-border)] -mx-6 px-6">
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setTemplateCategory(cat.id)}
                      className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${templateCategory === cat.id ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`}
                      data-testid={`tab-template-category-${cat.id}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-4">
                    {TEMPLATES
                      .filter(t => {
                        if (templateSearch && !t.name.toLowerCase().includes(templateSearch.toLowerCase()) && !t.lang.toLowerCase().includes(templateSearch.toLowerCase())) return false;
                        if (templateLangFilter && !t.lang.toLowerCase().includes(templateLangFilter)) return false;
                        if (templateCategory !== "all" && TEMPLATE_CATEGORY_MAP[t.id] !== templateCategory) return false;
                        return true;
                      })
                      .map((tmpl) => (
                      <button
                        key={tmpl.name}
                        className={`relative flex flex-col items-start gap-2 p-3 rounded-lg border ${tmpl.borderColor} bg-[var(--ide-bg)] transition-all text-left group hover:border-[#0079F2]/40 hover:bg-[var(--ide-panel)]`}
                        onClick={() => { createFromTemplate.mutate({ templateId: tmpl.id, visibility: newProjectPrivate ? "private" : "public" }); setDialogOpen(false); }}
                        disabled={createFromTemplate.isPending}
                        data-testid={`picker-template-${tmpl.id}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-7 h-7 rounded-md bg-[var(--ide-surface)] flex items-center justify-center border border-[var(--ide-border)]/50 shrink-0">
                            <tmpl.icon className={`w-3.5 h-3.5 ${tmpl.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[var(--ide-text)] truncate">{tmpl.name}</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">{tmpl.lang}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-[var(--ide-text-muted)] leading-relaxed line-clamp-2">{tmpl.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--ide-border)] pt-3 mt-1">
                  <p className="text-[10px] text-[var(--ide-text-muted)] mb-2">Or create an empty project</p>
                  <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang, visibility: newProjectPrivate ? "private" : "public", artifactType: categoryToArtifactType[selectedCategory] || "web-app" }); }} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 rounded-lg text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] flex-1" required data-testid="input-project-name" />
                      <select value={newProjectLang} onChange={(e) => setNewProjectLang(e.target.value)} className="h-9 px-2 rounded-lg text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)]" data-testid="select-project-lang">
                        {(Object.keys(LANG_ICONS) as string[]).map((lang) => (
                          <option key={lang} value={lang}>{LANG_ICONS[lang].label}</option>
                        ))}
                      </select>
                      <Button type="submit" className="h-9 px-4 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-xs font-medium" disabled={createProject.isPending} data-testid="button-create-project">
                        {createProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newProjectPrivate} onCheckedChange={setNewProjectPrivate} disabled={isFreePlan} data-testid="switch-private-project" />
                      <span className="text-[10px] text-[var(--ide-text-muted)]">Private project</span>
                      <Lock className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      {isFreePlan && <span className="text-[9px] text-amber-500">Upgrade to Core/Pro</span>}
                    </div>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center hover:ring-2 hover:ring-[#0079F2]/30 transition-all" data-testid="button-user-menu">
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
              <div className="px-3 py-2.5 border-b border-[var(--ide-border)]">
                <p className="text-xs font-medium text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => setLocation("/settings")}>
                <SettingsIcon className="w-3.5 h-3.5" /> Account
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
              <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => logout.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden sm:flex w-[220px] bg-[var(--ide-bg)] border-r border-[var(--ide-border)]/40 flex-col shrink-0">
          <div className="px-3 pt-3 pb-1">
            <Button
              className="w-full h-9 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[13px] font-medium rounded-lg gap-1.5"
              onClick={() => setDialogOpen(true)}
              data-testid="sidebar-create-project"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </Button>
          </div>
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {sidebarLinks.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${sidebarNav === id ? "bg-[var(--ide-panel)] text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text)]"}`}
                onClick={() => setSidebarNav(id)}
                data-testid={`nav-${id}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            {sidebarSecondaryLinks.map(({ icon: Icon, label, action, testId }) => (
              <button
                key={label}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text)] transition-colors"
                onClick={action}
                data-testid={testId}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <div className="!mt-4 pt-3 border-t border-[var(--ide-border)]/40">
              <p className="px-3 text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Resources</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" onClick={() => toast({ title: "Documentation", description: "Documentation coming soon." })} data-testid="nav-docs">
                <BookOpen className="w-3.5 h-3.5" /> Docs
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" onClick={() => toast({ title: "Help", description: "Help center coming soon." })} data-testid="nav-help">
                <HelpCircle className="w-3.5 h-3.5" /> Help
              </button>
            </div>
            <div className="!mt-4 pt-3 border-t border-[var(--ide-border)]/40">
              <p className="px-3 text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Teams</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" data-testid="nav-teams">
                <Users className="w-3.5 h-3.5" /> Create a Team
              </button>
            </div>
          </nav>

          <div className="p-3 border-t border-[var(--ide-border)]/40 space-y-3">
            {usageQuery.data && (
              <div className="px-2 space-y-2.5" data-testid="sidebar-usage">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Zap className="w-3 h-3" /> Runs</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-runs-usage">{usageQuery.data.daily.executions.used}/{usageQuery.data.daily.executions.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0CCE6B] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.executions.used / usageQuery.data.daily.executions.limit) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Sparkles className="w-3 h-3" /> Credits</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-ai-usage">{usageQuery.data.daily.credits?.used || 0}/{usageQuery.data.daily.credits?.limit || 100}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#0CCE6B] to-[#7C65CB] transition-all" style={{ width: `${Math.min(100, ((usageQuery.data.daily.credits?.used || 0) / (usageQuery.data.daily.credits?.limit || 100)) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-storage-usage">{usageQuery.data.storage.usedMb} / {usageQuery.data.storage.limitMb} MB</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0079F2] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.storage.usedMb / usageQuery.data.storage.limitMb) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Folder className="w-3 h-3" /> Projects</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-projects-usage">{usageQuery.data.projects.count}/{usageQuery.data.projects.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#F26522] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.projects.count / usageQuery.data.projects.limit) * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[9px] text-[var(--ide-text-muted)] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-[var(--ide-bg)]">
          {sidebarNav === "home" ? (
            <div className="max-w-[680px] mx-auto px-4 sm:px-6">
              <div className="pt-12 sm:pt-20 pb-6 text-center relative">
                <div className="absolute inset-0 -top-12 -left-20 -right-20 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.08)_0%,_rgba(124,101,203,0.04)_40%,_transparent_70%)] animate-gradient-shift pointer-events-none" />
                <h1 className="relative text-[32px] sm:text-[40px] font-bold text-[var(--ide-text)] mb-3 tracking-tight leading-tight" data-testid="text-hero-title">What do you want to create?</h1>
                <p className="relative text-[13px] text-[var(--ide-text-muted)] max-w-md mx-auto leading-relaxed">Describe your idea and AI will build it, or start from a template below</p>
              </div>

              <form onSubmit={handleGenerateSubmit} className="mb-10">
                <div className="relative rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden focus-within:border-[#0079F2]/40 focus-within:shadow-lg focus-within:shadow-[#0079F2]/5 transition-all">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Build me a todo app with drag-and-drop, dark mode, and local storage..."
                    rows={4}
                    className="w-full bg-transparent text-[13px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] px-4 pt-4 pb-2 resize-none focus:outline-none leading-relaxed"
                    disabled={generateProject.isPending}
                    data-testid="input-ai-prompt"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
                      }
                    }}
                  />
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAiModel("claude")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "claude" ? "bg-[#7C65CB]/15 text-[#A78BFA] border border-[#7C65CB]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-claude"
                      >
                        <Sparkles className="w-3 h-3" /> Claude
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gpt")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gpt" ? "bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-gpt"
                      >
                        <Zap className="w-3 h-3" /> GPT-4o
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gemini")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gemini" ? "bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-gemini"
                      >
                        <Star className="w-3 h-3" /> Gemini
                      </button>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg text-[12px] font-semibold gap-1.5 shadow-sm shadow-[#0079F2]/20"
                      disabled={generateProject.isPending || aiPrompt.trim().length < 3}
                      data-testid="button-generate-project"
                    >
                      {generateProject.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                      ) : (
                        <><Send className="w-3 h-3" /> Generate</>
                      )}
                    </Button>
                  </div>
                </div>
                {generateProject.isPending ? (
                  <div className="mt-4 rounded-xl border border-[#7C65CB]/30 bg-[#7C65CB]/5 p-5 animate-fade-in" data-testid="generation-progress">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C65CB] to-[#0079F2] flex items-center justify-center shrink-0 shadow-lg shadow-[#7C65CB]/20">
                        <Sparkles className="w-5 h-5 text-white animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-generation-title">Building your app...</p>
                        <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">This usually takes 15-30 seconds</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {GENERATION_STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          {i < generationStep ? (
                            <div className="w-4.5 h-4.5 rounded-full bg-[#0CCE6B]/20 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-[#0CCE6B]" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          ) : i === generationStep ? (
                            <Loader2 className="w-4 h-4 text-[#7C65CB] animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-[var(--ide-border)] shrink-0" />
                          )}
                          <span className={`text-[11px] transition-colors ${i < generationStep ? "text-[#0CCE6B]" : i === generationStep ? "text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-muted)]"}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 w-full h-1.5 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#7C65CB] to-[#0079F2] transition-all duration-700 ease-out" style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }} />
                    </div>
                  </div>
                ) : generationError ? (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 animate-fade-in" data-testid="generation-error">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-red-400 mb-1" data-testid="text-generation-error">Generation failed</p>
                        <p className="text-[11px] text-[var(--ide-text-secondary)] mb-3 leading-relaxed">{generationError}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="h-7 px-3 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] rounded-lg gap-1.5"
                            onClick={() => { setGenerationError(null); if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel }); }}
                            data-testid="button-retry-generation"
                          >
                            <Zap className="w-3 h-3" /> Try again
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[11px] rounded-lg"
                            onClick={() => setGenerationError(null)}
                            data-testid="button-dismiss-error"
                          >
                            Dismiss
                          </Button>
                        </div>
                        <p className="text-[10px] text-[var(--ide-text-muted)] mt-2.5">Tip: Try simplifying your prompt or choosing a different AI model</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-[var(--ide-text-muted)]">
                    <Sparkles className="w-3 h-3 text-[#7C65CB]" />
                    Powered by AI
                  </div>
                )}
              </form>

              <div className="mb-6" data-testid="section-categories">
                <ArtifactTypeCarousel
                  selectedType={selectedCategory}
                  onSelectType={(type) => { setSelectedCategory(type || APP_CATEGORIES[0].id); setPromptSeed(prev => prev + 1); }}
                  size="md"
                />
              </div>

              <div className="mb-8" data-testid="section-example-prompts">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-medium text-[var(--ide-text-muted)]" data-testid="text-example-prompts-label">Try an example prompt</span>
                  <button
                    onClick={() => setPromptSeed(prev => prev + 1)}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
                    data-testid="button-refresh-prompts"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((prompt, idx) => (
                    <button
                      key={`${selectedCategory}-${promptSeed}-${idx}`}
                      onClick={() => setAiPrompt(prompt)}
                      className="text-[11px] px-3.5 py-2 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-panel)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:border-[#0079F2]/30 hover:bg-[#0079F2]/5 transition-all text-left leading-relaxed"
                      data-testid={`prompt-pill-${idx}`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Templates</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollTemplates("left")} className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 transition-colors" data-testid="button-templates-left">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => scrollTemplates("right")} className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 transition-colors" data-testid="button-templates-right">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1" ref={templatesRef}>
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border ${tmpl.borderColor} bg-[var(--ide-panel)] transition-all text-left group active:scale-[0.98] overflow-hidden hover:scale-[1.02] hover:-translate-y-0.5 min-w-[180px] shrink-0`}
                      onClick={() => createFromTemplate.mutate({ templateId: tmpl.id })}
                      disabled={createFromTemplate.isPending}
                      data-testid={`template-${tmpl.id}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${tmpl.gradient} opacity-[0.06] group-hover:opacity-[0.12] transition-opacity`} />
                      <div className="relative flex items-center gap-2.5 w-full">
                        <div className="w-8 h-8 rounded-lg bg-[var(--ide-bg)]/80 flex items-center justify-center border border-[var(--ide-border)]/50 shrink-0">
                          <tmpl.icon className={`w-4 h-4 ${tmpl.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--ide-text)] group-hover:text-white transition-colors">{tmpl.name}</p>
                          <p className="text-[9px] text-[var(--ide-text-muted)]">{tmpl.lang}</p>
                        </div>
                      </div>
                      <div className="relative w-full mt-1 px-2 py-1.5 rounded-md bg-[var(--ide-bg)]/60 border border-[var(--ide-border)]/30">
                        <code className="text-[9px] text-[var(--ide-text-muted)] font-mono group-hover:text-[var(--ide-text-secondary)] transition-colors">{tmpl.snippet}</code>
                      </div>
                      <p className="relative text-[10px] text-[var(--ide-text-muted)] leading-relaxed">{tmpl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {projectsQuery.isLoading && (
                <div className="pb-8" data-testid="skeleton-recent-projects">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-3 w-20 rounded bg-[var(--ide-surface)]" />
                    <Skeleton className="h-3 w-16 rounded bg-[var(--ide-surface)]" />
                  </div>
                  <div className="border border-[var(--ide-border)]/50 rounded-xl overflow-hidden bg-[var(--ide-panel)]/20">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx !== 0 ? "border-t border-[var(--ide-border)]/30" : ""}`}>
                        <Skeleton className="w-8 h-8 rounded-lg bg-[var(--ide-surface)] shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Skeleton className="h-3.5 w-32 rounded bg-[var(--ide-surface)]" />
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-2.5 w-16 rounded bg-[var(--ide-surface)]" />
                            <Skeleton className="h-2.5 w-12 rounded bg-[var(--ide-surface)]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!projectsQuery.isLoading && projects.length === 0 && (
                <div className="pb-8 animate-fade-in">
                  <div className="text-center py-14 px-6 border border-[var(--ide-border)]/50 rounded-xl bg-[var(--ide-panel)]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-7 h-7 text-[#0079F2]" />
                      </div>
                      <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold" data-testid="text-empty-home">Start building something amazing</p>
                      <p className="text-[12px] text-[var(--ide-text-muted)] max-w-xs mx-auto mb-5 leading-relaxed">Describe your idea above and let AI build it, or create an empty project to start coding from scratch</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          size="sm"
                          className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium shadow-sm shadow-[#0079F2]/20"
                          onClick={() => setDialogOpen(true)}
                          data-testid="button-empty-create-project"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Project
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-4 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 text-[12px] rounded-lg gap-1.5"
                          onClick={() => {
                            const el = document.querySelector('[data-testid="input-ai-prompt"]') as HTMLTextAreaElement;
                            el?.focus();
                          }}
                          data-testid="button-empty-use-ai"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" /> Use AI
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!projectsQuery.isLoading && projects.length > 0 && (
                <div className="pb-8 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider" data-testid="text-my-projects">Recent Projects</h3>
                    <div className="flex items-center gap-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] transition-colors" data-testid="button-sort-by">
                            <ArrowUpDown className="w-3 h-3" />
                            {sortBy === "modified" ? "Last modified" : "Name"}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "modified" ? "text-[#0079F2]" : "text-[var(--ide-text-secondary)]"} focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)]`} onClick={() => setSortBy("modified")} data-testid="sort-modified">
                            Last modified
                          </DropdownMenuItem>
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "name" ? "text-[#0079F2]" : "text-[var(--ide-text-secondary)]"} focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)]`} onClick={() => setSortBy("name")} data-testid="sort-name">
                            Name
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button className="text-[11px] text-[#0079F2] hover:text-[#0079F2]/80 transition-colors" onClick={() => setSidebarNav("projects")}>
                        View all <ChevronRight className="w-3 h-3 inline" />
                      </button>
                    </div>
                  </div>
                  <div className="border border-[var(--ide-border)]/50 rounded-xl overflow-hidden bg-[var(--ide-panel)]/20">
                    {projects.slice(0, 5).map((project, idx) => {
                      const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                      const isProjectMobile = project.projectType === "mobile-app";
                      const pType = project.projectType;
                      const isSlides = pType === "slides";
                      const isVideo = pType === "video";
                      return (
                        <div
                          key={project.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-panel)]/80 cursor-pointer transition-all group even:bg-[var(--ide-panel)]/30 ${idx !== 0 ? "border-t border-[var(--ide-border)]/30" : ""}`}
                          onClick={() => setLocation(`/project/${project.id}`)}
                          data-testid={`card-project-${project.id}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${isProjectMobile ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : isSlides ? "bg-amber-500/10 text-amber-400 border-amber-400/30" : isVideo ? "bg-red-500/10 text-red-400 border-red-400/30" : `${langInfo.bg} ${langInfo.color}`}`}>
                            {isProjectMobile ? <Smartphone className="w-4 h-4" /> : isSlides ? <Presentation className="w-4 h-4" /> : isVideo ? <Play className="w-4 h-4" /> : langInfo.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[13px] text-[var(--ide-text)] truncate group-hover:text-white transition-colors">{project.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{isSlides ? "Slides" : isVideo ? "Video" : project.language}</span>
                              <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                              <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer transition-all ${project.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} onMouseEnter={() => setHoveredCardId(`list-${project.id}`)} onMouseLeave={() => setHoveredCardId(null)} onClick={(e) => handleVisibilityToggle(e, project)} data-testid={`badge-visibility-list-${project.id}`}>{hoveredCardId === `list-${project.id}` ? (project.visibility === "public" ? "Make private" : "Make public") : (project.visibility === "private" ? "Private" : project.visibility === "team" ? "Team" : "Public")}</span>
                              {project.isPublished && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 shrink-0 font-medium">Live</span>
                              )}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]">
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]/50" />
                                <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                  <Trash className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              ref={projectListRef}
              className="max-w-[800px] mx-auto px-4 sm:px-6 py-6"
              onTouchStart={handlePullStart}
              onTouchMove={handlePullMove}
              onTouchEnd={handlePullEnd}
            >
              {(pullDistance > 0 || isRefreshing) && (
                <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance > 0 ? pullDistance : 40 }}>
                  <div className={`w-6 h-6 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full ${isRefreshing || pullDistance > 50 ? "animate-spin" : ""}`} style={{ opacity: Math.min(1, pullDistance / 50) }} />
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--ide-text)]" data-testid="text-my-projects">My Projects</h2>
                <div className="flex items-center gap-2">
                  <div className="relative sm:hidden">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7.5 bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 w-40 text-[11px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
                      data-testid="input-search-projects"
                    />
                  </div>
                  <div className="hidden sm:flex items-center bg-[var(--ide-surface)]/50 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-[var(--ide-panel)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]"}`} data-testid="button-view-grid">
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-[var(--ide-panel)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]"}`} data-testid="button-view-list">
                      <ListIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Button size="sm" className="h-8 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] rounded-lg gap-1.5 font-medium px-3" onClick={() => setDialogOpen(true)} data-testid="button-new-project-list">
                    <Plus className="w-3.5 h-3.5" /> New Project
                  </Button>
                </div>
              </div>

              {projectsQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="skeleton-projects-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col p-4 rounded-xl border border-[var(--ide-border)]/50 bg-[var(--ide-panel)]/40">
                      <div className="flex items-start justify-between mb-3">
                        <Skeleton className="w-9 h-9 rounded-lg bg-[var(--ide-surface)]" />
                        <Skeleton className="w-6 h-6 rounded-md bg-[var(--ide-surface)]" />
                      </div>
                      <Skeleton className="h-4 w-28 rounded bg-[var(--ide-surface)] mb-2" />
                      <div className="flex items-center gap-2 mt-auto">
                        <Skeleton className="h-3 w-16 rounded bg-[var(--ide-surface)]" />
                        <Skeleton className="h-3 w-12 rounded bg-[var(--ide-surface)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 px-6 border border-[var(--ide-border)]/50 rounded-xl bg-[var(--ide-panel)]/30 animate-fade-in relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                  <div className="relative">
                    {searchQuery ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-4">
                          <Search className="w-6 h-6 text-[var(--ide-text-muted)]" />
                        </div>
                        <p className="text-[13px] text-[var(--ide-text-secondary)] mb-1 font-medium" data-testid="text-empty-state">No projects match your search</p>
                        <p className="text-[11px] text-[var(--ide-text-muted)]">Try a different search term</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                          <Code2 className="w-7 h-7 text-[#0079F2]" />
                        </div>
                        <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold" data-testid="text-empty-state">No projects yet</p>
                        <p className="text-[12px] text-[var(--ide-text-muted)] max-w-sm mx-auto mb-5 leading-relaxed">Create your first project to start coding. Use AI to generate one or start from scratch.</p>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            size="sm"
                            className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium shadow-sm shadow-[#0079F2]/20"
                            onClick={() => setDialogOpen(true)}
                            data-testid="button-empty-projects-create"
                          >
                            <Plus className="w-3.5 h-3.5" /> Create Project
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-4 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 text-[12px] rounded-lg gap-1.5"
                            onClick={() => setSidebarNav("home")}
                            data-testid="button-empty-projects-ai"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" /> Generate with AI
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                  <button
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-[var(--ide-border)] bg-[var(--ide-panel)]/20 hover:bg-[var(--ide-panel)]/50 hover:border-[#0079F2]/40 cursor-pointer transition-all group min-h-[120px]"
                    onClick={() => setDialogOpen(true)}
                    data-testid="card-create-new-project"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0079F2]/10 border border-[#0079F2]/20 flex items-center justify-center mb-2.5 group-hover:bg-[#0079F2]/20 transition-colors">
                      <Plus className="w-5 h-5 text-[#0079F2]" />
                    </div>
                    <p className="text-[12px] font-medium text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] transition-colors">Create New Project</p>
                  </button>
                  {projects.map((project) => {
                    const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                    const isProjectMobile = project.projectType === "mobile-app";
                    return (
                      <div
                        key={project.id}
                        className={`flex flex-col ${isMobile ? "p-5" : "p-4"} rounded-xl border border-[var(--ide-border)]/50 border-l-2 ${isProjectMobile ? "border-l-purple-400" : langInfo.borderAccent} bg-[var(--ide-panel)]/40 hover:bg-[var(--ide-panel)]/80 hover:border-[var(--ide-border)] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all group ${isMobile ? "min-h-[80px] active:scale-[0.98]" : ""}`}
                        onClick={() => setLocation(`/project/${project.id}`)}
                        data-testid={`card-project-${project.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`${isMobile ? "w-11 h-11" : "w-9 h-9"} rounded-lg flex items-center justify-center border text-[10px] font-bold ${isProjectMobile ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : `${langInfo.bg} ${langInfo.color}`}`}>
                            {isProjectMobile ? <Smartphone className={`${isMobile ? "w-5 h-5" : "w-4 h-4"}`} /> : langInfo.label}
                          </div>
                          <div className={`${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`} onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className={`${isMobile ? "w-10 h-10" : "w-6 h-6"} rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]`}>
                                  <MoreVertical className={`${isMobile ? "w-4 h-4" : "w-3 h-3"}`} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]/50" />
                                <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                  <Trash className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <h3 className="font-medium text-[13px] text-[var(--ide-text)] truncate group-hover:text-white transition-colors mb-1">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-auto">
                          <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{project.language}</span>
                          <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                          <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer transition-all ${project.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} onMouseEnter={() => setHoveredCardId(`grid-${project.id}`)} onMouseLeave={() => setHoveredCardId(null)} onClick={(e) => handleVisibilityToggle(e, project)} data-testid={`badge-visibility-grid-${project.id}`}>{hoveredCardId === `grid-${project.id}` ? (project.visibility === "public" ? "Make private" : "Make public") : (project.visibility === "private" ? "Private" : project.visibility === "team" ? "Team" : "Public")}</span>
                          {project.isPublished && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 shrink-0 font-medium ml-auto">Live</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : (
                <div className="border border-[var(--ide-border)]/50 rounded-xl overflow-hidden bg-[var(--ide-panel)]/20 animate-fade-in">
                  {projects.map((project, idx) => {
                    const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                    const isListMobile = project.projectType === "mobile-app";
                    return (
                      <div
                        key={project.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--ide-panel)]/60 cursor-pointer transition-all group ${idx !== 0 ? "border-t border-[var(--ide-border)]/30" : ""}`}
                        onClick={() => setLocation(`/project/${project.id}`)}
                        data-testid={`list-project-${project.id}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-[9px] font-bold shrink-0 ${isListMobile ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : `${langInfo.bg} ${langInfo.color}`}`}>
                          {isListMobile ? <Smartphone className="w-4 h-4" /> : langInfo.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[13px] text-[var(--ide-text)] truncate">{project.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{project.language}</span>
                            <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                            <span className="text-[10px] text-[var(--ide-text-muted)]">{timeAgo(project.updatedAt)}</span>
                          </div>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer transition-all ${project.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} onMouseEnter={() => setHoveredCardId(`row-${project.id}`)} onMouseLeave={() => setHoveredCardId(null)} onClick={(e) => handleVisibilityToggle(e, project)} data-testid={`badge-visibility-row-${project.id}`}>{hoveredCardId === `row-${project.id}` ? (project.visibility === "public" ? "Make private" : "Make public") : (project.visibility === "private" ? "Private" : project.visibility === "team" ? "Team" : "Public")}</span>
                        {project.isPublished && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 font-medium">Live</span>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                              <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                <Copy className="w-3 h-3" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[var(--ide-surface)]/50" />
                              <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                <Trash className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
            </div>
          )}
        </main>
      </div>
      </>
      )}

      <Drawer open={isMobile && dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-[var(--ide-text)] text-base">Create Project</DrawerTitle>
            <DrawerDescription className="text-[var(--ide-text-muted)] text-xs">Start with an empty project</DrawerDescription>
          </DrawerHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang, visibility: newProjectPrivate ? "private" : "public", artifactType: categoryToArtifactType[selectedCategory] || "web-app" }); }} className="space-y-4 px-4 pb-8">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--ide-text-muted)]">Title</Label>
              <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-12 rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40 text-base" required data-testid="input-project-name-mobile" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--ide-text-muted)]">Language</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LANG_ICONS) as string[]).map((lang) => {
                  const info = LANG_ICONS[lang];
                  return (
                    <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium border transition-all ${newProjectLang === lang ? `${info.bg} ${info.color} ring-1 ring-current/20` : "bg-[var(--ide-surface)]/50 text-[var(--ide-text-secondary)] border-transparent hover:border-[var(--ide-hover)]"}`} data-testid={`button-lang-${lang}-mobile`}>
                      <Code2 className="w-4 h-4" /> {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                <span className="text-xs text-[var(--ide-text)]">Private project</span>
                {isFreePlan && <span className="text-[9px] text-amber-500">(Upgrade to unlock)</span>}
              </div>
              <Switch checked={newProjectPrivate} onCheckedChange={setNewProjectPrivate} disabled={isFreePlan} data-testid="switch-private-project-mobile" />
            </div>
            <Button type="submit" className="w-full rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white h-12 text-base" disabled={createProject.isPending} data-testid="button-create-project-mobile">
              {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      <Dialog open={deleteConfirmDialogOpen} onOpenChange={(open) => { setDeleteConfirmDialogOpen(open); if (!open) setDeleteTargetProject(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Delete Project</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              Are you sure you want to delete <span className="text-[var(--ide-text)] font-medium">{deleteTargetProject?.name}</span>? This action cannot be undone and all files will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-lg" onClick={() => { setDeleteConfirmDialogOpen(false); setDeleteTargetProject(null); }} data-testid="button-cancel-delete-project">
              Cancel
            </Button>
            <Button
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
              onClick={() => {
                if (deleteTargetProject) {
                  deleteProject.mutate(deleteTargetProject.id);
                  setDeleteConfirmDialogOpen(false);
                  setDeleteTargetProject(null);
                }
              }}
              disabled={deleteProject.isPending}
              data-testid="button-confirm-delete-project"
            >
              {deleteProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showOnboarding && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 animate-fade-in" data-testid="onboarding-overlay">
          <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {onboardingStep === 0 && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26522]/20 to-[#F26522]/5 border border-[#F26522]/20 flex items-center justify-center mx-auto mb-6">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                    <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                    <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--ide-text)] mb-2" data-testid="text-onboarding-welcome">Welcome to E-Code!</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-6 leading-relaxed">Your cloud IDE for building, running, and deploying code from anywhere. Let's get you started in 30 seconds.</p>
                <Button className="h-10 px-6 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-sm font-medium" onClick={() => setOnboardingStep(1)} data-testid="button-onboarding-start">
                  Get Started
                </Button>
              </div>
            )}
            {onboardingStep === 1 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#0CCE6B]/10 flex items-center justify-center shrink-0">
                    <Code2 className="w-4 h-4 text-[#0CCE6B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">Create Your First Project</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 1 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Click the <strong className="text-[var(--ide-text)]">"+ Create"</strong> button in the top right to start a new project. Choose a language and give it a name.</p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] mb-6">
                  <div className="flex gap-2">
                    {["JavaScript", "TypeScript", "Python"].map(lang => (
                      <span key={lang} className="text-[10px] px-2 py-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)]">{lang}</span>
                    ))}
                    <span className="text-[10px] px-2 py-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">+5 more</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(0)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" onClick={() => setOnboardingStep(2)}>Next</Button>
                </div>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#7C65CB]/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#7C65CB]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">AI-Powered Coding</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 2 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Use the <strong className="text-[var(--ide-text)]">AI panel</strong> (Ctrl+I) to generate code, fix bugs, or ask questions. Choose from Claude, GPT, or Gemini.</p>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { name: "Generate", desc: "Create files from a prompt" },
                    { name: "Fix", desc: "Debug errors automatically" },
                    { name: "Explain", desc: "Understand any code" },
                  ].map(item => (
                    <div key={item.name} className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-center">
                      <p className="text-[11px] font-medium text-[var(--ide-text)] mb-0.5">{item.name}</p>
                      <p className="text-[9px] text-[var(--ide-text-muted)]">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(1)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" onClick={() => setOnboardingStep(3)}>Next</Button>
                </div>
              </div>
            )}
            {onboardingStep === 3 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#0079F2]/10 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-[#0079F2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">Deploy & Share</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 3 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">When your project is ready, hit <strong className="text-[var(--ide-text)]">Deploy</strong> to make it live. Share the link with anyone or collaborate with your team.</p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] mb-6">
                  <Terminal className="w-4 h-4 text-[#0CCE6B]" />
                  <span className="text-[11px] text-[var(--ide-text-secondary)] font-mono">your-app.e-code.dev</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#0CCE6B]/10 text-[#0CCE6B] font-medium">LIVE</span>
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(2)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-bold" onClick={() => { setShowOnboarding(false); localStorage.setItem("ecode_onboarding_seen", "true"); }} data-testid="button-onboarding-finish">
                    Start Coding
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-1.5 pb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === onboardingStep ? "bg-[#0079F2]" : "bg-[var(--ide-surface)]"}`} />
              ))}
            </div>
            <button
              className="absolute top-4 right-4 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
              onClick={() => { setShowOnboarding(false); localStorage.setItem("ecode_onboarding_seen", "true"); }}
              data-testid="button-close-onboarding"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
