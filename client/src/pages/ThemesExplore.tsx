import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Search, Download, Check, Palette, Users, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme, themeFromDbTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Theme } from "@shared/schema";

function ThemeCard({ theme, isInstalled, onInstall, onUninstall, onPreview }: {
  theme: Theme & { authorName?: string };
  isInstalled: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onPreview: () => void;
}) {
  const gc = theme.globalColors;
  const sc = theme.syntaxColors;

  return (
    <div
      className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden hover:border-[#0079F2]/50 transition-colors cursor-pointer group"
      onClick={onPreview}
      data-testid={`card-theme-${theme.id}`}
    >
      <div className="h-28 relative overflow-hidden" style={{ background: gc.background }}>
        <div className="absolute inset-0 p-3 font-mono text-[10px] leading-relaxed overflow-hidden opacity-80">
          <span style={{ color: sc.keywords }}>const</span>{" "}
          <span style={{ color: sc.variableDefinitions }}>app</span>{" "}
          <span style={{ color: sc.operators }}>=</span>{" "}
          <span style={{ color: sc.functionReferences }}>create</span>
          <span style={{ color: sc.brackets }}>()</span>
          <span style={{ color: gc.foreground }}>;</span>
          <br />
          <span style={{ color: sc.comments }}>{"// " + theme.title}</span>
          <br />
          <span style={{ color: sc.keywords }}>function</span>{" "}
          <span style={{ color: sc.functionDefinitions }}>render</span>
          <span style={{ color: sc.brackets }}>(</span>
          <span style={{ color: sc.variableNames }}>data</span>
          <span style={{ color: sc.brackets }}>)</span>{" "}
          <span style={{ color: sc.brackets }}>{"{"}</span>
          <br />
          {"  "}
          <span style={{ color: sc.keywords }}>return</span>{" "}
          <span style={{ color: sc.strings }}>"Hello"</span>
          <span style={{ color: gc.foreground }}>;</span>
          <br />
          <span style={{ color: sc.brackets }}>{"}"}</span>
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          {[gc.background, gc.foreground, gc.primary, gc.positive, gc.negative, gc.outline].map((c, i) => (
            <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[var(--ide-text)] truncate" data-testid={`text-theme-title-${theme.id}`}>{theme.title}</h3>
            <p className="text-[11px] text-[var(--ide-text-muted)] truncate">{theme.authorName || "Anonymous"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {theme.baseScheme === "dark" ? <Moon className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <Sun className="w-3 h-3 text-[var(--ide-text-muted)]" />}
            <span className="text-[10px] text-[var(--ide-text-muted)]">{theme.installCount}</span>
            <Download className="w-3 h-3 text-[var(--ide-text-muted)]" />
          </div>
        </div>
        {theme.description && (
          <p className="text-[11px] text-[var(--ide-text-secondary)] mt-1 line-clamp-2">{theme.description}</p>
        )}
        <div className="mt-2">
          {isInstalled ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[11px] gap-1"
              onClick={e => { e.stopPropagation(); onUninstall(); }}
              data-testid={`button-uninstall-${theme.id}`}
            >
              <Check className="w-3 h-3" />
              Installed
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full h-7 text-[11px] gap-1 bg-[#0079F2] hover:bg-[#0066CC] text-white"
              onClick={e => { e.stopPropagation(); onInstall(); }}
              data-testid={`button-install-${theme.id}`}
            >
              <Download className="w-3 h-3" />
              Install
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThemesExplore() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setActiveTheme, refreshThemes, installedThemes } = useTheme();
  const [search, setSearch] = useState("");
  const [schemeFilter, setSchemeFilter] = useState<"" | "dark" | "light">("");
  const [colorFilter, setColorFilter] = useState("");

  const { data: themes = [], isLoading } = useQuery<(Theme & { authorName?: string })[]>({
    queryKey: ["/api/themes/explore", search, schemeFilter, colorFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (schemeFilter) params.set("baseScheme", schemeFilter);
      if (colorFilter) params.set("color", colorFilter);
      const res = await fetch(`/api/themes/explore?${params}`, { credentials: "include" });
      return res.json();
    },
    staleTime: 30000,
  });

  const installedIds = new Set(installedThemes.map(t => t.id));

  const handleInstall = async (themeId: string) => {
    try {
      await apiRequest("POST", `/api/themes/${themeId}/install`);
      refreshThemes();
      queryClient.invalidateQueries({ queryKey: ["/api/themes/explore"] });
      toast({ title: "Installed", description: "Theme added to your collection." });
    } catch (err: any) {
      toast({ title: "Install failed", description: err.message, variant: "destructive" });
    }
  };

  const handleUninstall = async (themeId: string) => {
    try {
      await apiRequest("DELETE", `/api/themes/${themeId}/uninstall`);
      refreshThemes();
      queryClient.invalidateQueries({ queryKey: ["/api/themes/explore"] });
      toast({ title: "Uninstalled", description: "Theme removed from your collection." });
    } catch (err: any) {
      toast({ title: "Uninstall failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePreview = (theme: Theme) => {
    setActiveTheme(themeFromDbTheme(theme));
    toast({ title: "Previewing", description: `Previewing "${theme.title}". Install to keep it.` });
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <Link href="/settings">
          <button className="flex items-center gap-1.5 text-[13px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="button-back">
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </Link>
        <div className="w-px h-5 bg-[var(--ide-border)]" />
        <Palette className="w-4 h-4 text-[#0079F2]" />
        <h1 className="text-[14px] font-semibold">Explore Themes</h1>
      </div>

      <div className="px-6 py-4 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-3 max-w-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search themes by name, author, or description..."
              className="pl-9 h-9 text-[13px] bg-[var(--ide-input)] border-[var(--ide-border)]"
              data-testid="input-search-themes"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSchemeFilter("")}
              className={`px-3 py-1.5 text-[12px] rounded-md border transition-colors ${!schemeFilter ? "bg-[var(--ide-surface)] border-[#0079F2] text-[var(--ide-text)]" : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"}`}
              data-testid="button-filter-all"
            >
              All
            </button>
            <button
              onClick={() => setSchemeFilter("dark")}
              className={`px-3 py-1.5 text-[12px] rounded-md border transition-colors flex items-center gap-1 ${schemeFilter === "dark" ? "bg-[var(--ide-surface)] border-[#0079F2] text-[var(--ide-text)]" : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"}`}
              data-testid="button-filter-dark"
            >
              <Moon className="w-3 h-3" /> Dark
            </button>
            <button
              onClick={() => setSchemeFilter("light")}
              className={`px-3 py-1.5 text-[12px] rounded-md border transition-colors flex items-center gap-1 ${schemeFilter === "light" ? "bg-[var(--ide-surface)] border-[#0079F2] text-[var(--ide-text)]" : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"}`}
              data-testid="button-filter-light"
            >
              <Sun className="w-3 h-3" /> Light
            </button>
            <div className="w-px h-5 bg-[var(--ide-border)]" />
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={colorFilter || "#0079F2"}
                onChange={e => setColorFilter(e.target.value)}
                className="w-7 h-7 rounded border border-[var(--ide-border)] cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                data-testid="input-color-filter"
              />
              {colorFilter && (
                <button
                  onClick={() => setColorFilter("")}
                  className="text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] px-1"
                  data-testid="button-clear-color"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-20">
              <Palette className="w-12 h-12 mx-auto mb-3 text-[var(--ide-text-muted)]" />
              <p className="text-[14px] text-[var(--ide-text-secondary)]">No themes found</p>
              <p className="text-[12px] text-[var(--ide-text-muted)] mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {themes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isInstalled={installedIds.has(theme.id)}
                  onInstall={() => handleInstall(theme.id)}
                  onUninstall={() => handleUninstall(theme.id)}
                  onPreview={() => handlePreview(theme)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
