import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, ArrowLeft, Code2, Globe, Server, Cpu, Terminal, Box,
  BadgeCheck, User, GitFork, Clock, ChevronRight, FileCode, Loader2,
  MessageSquare, ExternalLink, BookOpen,
} from "lucide-react";

interface Framework {
  id: string;
  name: string;
  language: string;
  frameworkDescription: string | null;
  frameworkCategory: string | null;
  frameworkCoverUrl: string | null;
  isOfficialFramework: boolean;
  authorName?: string;
  updatedAt: string;
}

interface FrameworkDetail extends Framework {
  userId: string;
  files: { id: string; filename: string; content: string }[];
  updates: { id: string; message: string; createdAt: string }[];
}

function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-[var(--ide-surface)] text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

const CATEGORIES = [
  { id: "all", label: "All", icon: Box },
  { id: "frontend", label: "Frontend", icon: Globe },
  { id: "backend", label: "Backend", icon: Server },
  { id: "fullstack", label: "Full Stack", icon: Code2 },
  { id: "systems", label: "Systems", icon: Cpu },
  { id: "scripting", label: "Scripting", icon: Terminal },
];

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178C6",
  javascript: "#F7DF1E",
  python: "#3776AB",
  go: "#00ADD8",
  rust: "#DEA584",
  cpp: "#00599C",
  java: "#ED8B00",
  ruby: "#CC342D",
  bash: "#4EAA25",
  html: "#E34F26",
  c: "#A8B9CC",
};

export default function Frameworks() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = useParams<{ id?: string }>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const selectedId = params.id || null;
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  const frameworksQuery = useQuery<Framework[]>({
    queryKey: ["/api/frameworks", { search, category, language: langFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category !== "all") params.set("category", category);
      if (langFilter) params.set("language", langFilter);
      const res = await fetch(`/api/frameworks?${params}`);
      if (!res.ok) throw new Error("Failed to load frameworks");
      return res.json();
    },
  });

  const detailQuery = useQuery<FrameworkDetail>({
    queryKey: ["/api/frameworks", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/frameworks/${selectedId}`);
      if (!res.ok) throw new Error("Failed to load framework");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const forkMutation = useMutation({
    mutationFn: async (frameworkId: string) => {
      const res = await apiRequest("POST", `/api/projects/${frameworkId}/fork`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Framework forked successfully" });
      navigate(`/project/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Fork failed", description: err.message, variant: "destructive" });
    },
  });

  const postUpdateMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest("POST", `/api/frameworks/${id}/updates`, { message });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Update posted" });
      setUpdateDialogOpen(false);
      setUpdateMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/frameworks", selectedId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to post update", description: err.message, variant: "destructive" });
    },
  });

  const frameworks = frameworksQuery.data || [];
  const detail = detailQuery.data;

  const allLangs = Array.from(new Set(frameworks.map(f => f.language))).sort();

  if (selectedId && detail) {
    return (
      <div className="min-h-screen bg-[var(--ide-bg)]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/frameworks")}
            className="flex items-center gap-1.5 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-6 transition-colors"
            data-testid="btn-back-frameworks"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Frameworks
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-bold text-[var(--ide-text)]" data-testid="text-framework-name">{detail.name}</h1>
                {detail.isOfficialFramework && (
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]" data-testid="badge-official">
                    <BadgeCheck className="w-3 h-3 mr-1" /> Official
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[var(--ide-text-secondary)]" data-testid="text-framework-desc">
                {detail.frameworkDescription || "No description"}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--ide-text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANG_COLORS[detail.language] || "#888" }} />
                  {detail.language}
                </span>
                {detail.frameworkCategory && (
                  <span className="capitalize">{detail.frameworkCategory}</span>
                )}
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {detail.isOfficialFramework ? "E-Code Official" : detail.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> {detail.files.length} files
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {isAuthenticated && (
                <Button
                  onClick={() => forkMutation.mutate(detail.id)}
                  disabled={forkMutation.isPending}
                  className="bg-[#0CCE6B] hover:bg-[#0AB85E] text-black font-medium text-sm px-5"
                  data-testid="btn-fork-framework"
                >
                  {forkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GitFork className="w-4 h-4 mr-1.5" /> Use this Framework</>}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {(() => {
                const readmeFile = detail.files.find(f =>
                  f.filename.toLowerCase() === "readme.md" || f.filename.toLowerCase() === "readme"
                );
                if (!readmeFile) return null;
                return (
                  <div className="rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden" data-testid="section-readme">
                    <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                      <h3 className="text-sm font-medium text-[var(--ide-text)]">README</h3>
                    </div>
                    <div
                      className="px-5 py-4 text-sm text-[var(--ide-text)] leading-relaxed prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(readmeFile.content) }}
                      data-testid="text-readme-content"
                    />
                  </div>
                );
              })()}

              <div className="rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ide-border)]">
                  <h3 className="text-sm font-medium text-[var(--ide-text)]">Files</h3>
                </div>
                <div className="divide-y divide-[var(--ide-border)]">
                  {detail.files.map((f) => (
                    <div key={f.id} className="px-4 py-2.5 flex items-center gap-2 hover:bg-[var(--ide-surface)] transition-colors" data-testid={`file-${f.filename}`}>
                      <FileCode className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                      <span className="text-sm text-[var(--ide-text)]">{f.filename}</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto">{f.content.length} chars</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] bg-[var(--ide-panel)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[var(--ide-text)] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Updates
                  </h3>
                  {isAuthenticated && user?.id === detail.userId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                      onClick={() => setUpdateDialogOpen(true)}
                      data-testid="btn-post-update"
                    >
                      Post Update
                    </Button>
                  )}
                </div>
                {detail.updates.length === 0 ? (
                  <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-4">No updates yet</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {detail.updates.map((u) => (
                      <div key={u.id} className="border-l-2 border-[var(--ide-border)] pl-3 py-1" data-testid={`update-${u.id}`}>
                        <p className="text-xs text-[var(--ide-text)]">{u.message}</p>
                        <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
          <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[var(--ide-text)] text-base">Post Framework Update</DialogTitle>
              <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Share what changed in this framework</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Textarea
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                placeholder="Describe what changed..."
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-sm text-[var(--ide-text)] min-h-[100px] rounded-lg"
                data-testid="textarea-update-message"
              />
              <Button
                className="w-full bg-[#0079F2] hover:bg-[#006AD4] text-white"
                disabled={!updateMessage.trim() || postUpdateMutation.isPending}
                onClick={() => postUpdateMutation.mutate({ id: selectedId!, message: updateMessage })}
                data-testid="btn-submit-update"
              >
                {postUpdateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Update"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ide-bg)]">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-2 transition-colors"
              data-testid="btn-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
            <h1 className="text-2xl font-bold text-[var(--ide-text)]">Developer Frameworks</h1>
            <p className="text-sm text-[var(--ide-text-secondary)] mt-1">Discover reusable project templates created by the community</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search frameworks..."
              className="pl-9 bg-[var(--ide-panel)] border-[var(--ide-border)] h-10 text-sm text-[var(--ide-text)] rounded-lg"
              data-testid="input-search-frameworks"
            />
          </div>
          {allLangs.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setLangFilter(null)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${!langFilter ? "bg-[#0079F2] text-white" : "bg-[var(--ide-panel)] text-[var(--ide-text-secondary)] border border-[var(--ide-border)] hover:text-[var(--ide-text)]"}`}
                data-testid="btn-lang-all"
              >
                All Languages
              </button>
              {allLangs.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(langFilter === lang ? null : lang)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${langFilter === lang ? "bg-[#0079F2] text-white" : "bg-[var(--ide-panel)] text-[var(--ide-text-secondary)] border border-[var(--ide-border)] hover:text-[var(--ide-text)]"}`}
                  data-testid={`btn-lang-${lang}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${category === cat.id ? "bg-[#0079F2] text-white" : "bg-[var(--ide-panel)] text-[var(--ide-text-secondary)] border border-[var(--ide-border)] hover:text-[var(--ide-text)]"}`}
                data-testid={`btn-cat-${cat.id}`}
              >
                <Icon className="w-3.5 h-3.5" /> {cat.label}
              </button>
            );
          })}
        </div>

        {frameworksQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : frameworks.length === 0 ? (
          <div className="text-center py-20">
            <Box className="w-10 h-10 mx-auto text-[var(--ide-text-muted)] mb-3" />
            <p className="text-sm text-[var(--ide-text-secondary)]">No frameworks found</p>
            <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {frameworks.map((fw) => (
              <button
                key={fw.id}
                onClick={() => navigate(`/frameworks/${fw.id}`)}
                className="text-left rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] bg-[var(--ide-panel)] p-4 hover:border-[var(--ide-hover)] transition-all group"
                data-testid={`card-framework-${fw.id}`}
              >
                {fw.frameworkCoverUrl && (
                  <div className="w-full h-32 rounded-lg mb-3 overflow-hidden bg-[var(--ide-surface)]">
                    <img src={fw.frameworkCoverUrl} alt={fw.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[var(--ide-text)] group-hover:text-[#0079F2] transition-colors">{fw.name}</h3>
                  <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] group-hover:text-[#0079F2] transition-colors shrink-0 mt-0.5" />
                </div>
                <p className="text-[11px] text-[var(--ide-text-secondary)] line-clamp-2 mb-3">
                  {fw.frameworkDescription || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LANG_COLORS[fw.language] || "#888" }} />
                      {fw.language}
                    </span>
                    {fw.frameworkCategory && (
                      <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{fw.frameworkCategory}</span>
                    )}
                  </div>
                  {fw.isOfficialFramework ? (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] py-0 px-1.5" data-testid={`badge-official-${fw.id}`}>
                      <BadgeCheck className="w-2.5 h-2.5 mr-0.5" /> Official
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {fw.authorName}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}