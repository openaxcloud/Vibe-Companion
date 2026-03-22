import { useState, useMemo } from "react";
import { useTheme, type ThemeData, type BaseScheme } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Palette, Check, Search, Sun, Moon, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { GlobalColors, SyntaxColors } from "@shared/schema";

interface QuickTheme {
  id: string;
  name: string;
  group: BaseScheme;
  globalColors: GlobalColors;
  syntaxColors: SyntaxColors;
}

const QUICK_THEMES: QuickTheme[] = [
  {
    id: "ecode-dark", name: "E-Code Dark", group: "dark",
    globalColors: { background: "#0D1117", foreground: "#E6EDF3", outline: "#30363D", accent: "#7C65CB", accentPositive: "#3FB950", accentNegative: "#F85149" },
    syntaxColors: { keyword: "#FF7B72", string: "#A5D6FF", comment: "#8B949E", function: "#D2A8FF", variable: "#FFA657", type: "#79C0FF", number: "#79C0FF", operator: "#FF7B72", punctuation: "#C9D1D9", tag: "#7EE787", attribute: "#79C0FF", property: "#D2A8FF" },
  },
  {
    id: "github-dark", name: "GitHub Dark", group: "dark",
    globalColors: { background: "#0D1117", foreground: "#C9D1D9", outline: "#30363D", accent: "#58A6FF", accentPositive: "#3FB950", accentNegative: "#F85149" },
    syntaxColors: { keyword: "#FF7B72", string: "#A5D6FF", comment: "#8B949E", function: "#D2A8FF", variable: "#FFA657", type: "#79C0FF", number: "#79C0FF", operator: "#FF7B72", punctuation: "#C9D1D9", tag: "#7EE787", attribute: "#79C0FF", property: "#D2A8FF" },
  },
  {
    id: "monokai", name: "Monokai Pro", group: "dark",
    globalColors: { background: "#2D2A2E", foreground: "#FCFCFA", outline: "#49464E", accent: "#A9DC76", accentPositive: "#A9DC76", accentNegative: "#FF6188" },
    syntaxColors: { keyword: "#FF6188", string: "#FFD866", comment: "#727072", function: "#A9DC76", variable: "#FCFCFA", type: "#78DCE8", number: "#AB9DF2", operator: "#FF6188", punctuation: "#939293", tag: "#FF6188", attribute: "#78DCE8", property: "#78DCE8" },
  },
  {
    id: "dracula", name: "Dracula", group: "dark",
    globalColors: { background: "#282A36", foreground: "#F8F8F2", outline: "#6272A4", accent: "#BD93F9", accentPositive: "#50FA7B", accentNegative: "#FF5555" },
    syntaxColors: { keyword: "#FF79C6", string: "#F1FA8C", comment: "#6272A4", function: "#50FA7B", variable: "#F8F8F2", type: "#8BE9FD", number: "#BD93F9", operator: "#FF79C6", punctuation: "#F8F8F2", tag: "#FF79C6", attribute: "#50FA7B", property: "#66D9EF" },
  },
  {
    id: "one-dark", name: "One Dark Pro", group: "dark",
    globalColors: { background: "#282C34", foreground: "#ABB2BF", outline: "#3E4452", accent: "#61AFEF", accentPositive: "#98C379", accentNegative: "#E06C75" },
    syntaxColors: { keyword: "#C678DD", string: "#98C379", comment: "#5C6370", function: "#61AFEF", variable: "#E06C75", type: "#E5C07B", number: "#D19A66", operator: "#56B6C2", punctuation: "#ABB2BF", tag: "#E06C75", attribute: "#D19A66", property: "#61AFEF" },
  },
  {
    id: "tokyo-night", name: "Tokyo Night", group: "dark",
    globalColors: { background: "#1A1B26", foreground: "#C0CAF5", outline: "#3B4261", accent: "#7AA2F7", accentPositive: "#9ECE6A", accentNegative: "#F7768E" },
    syntaxColors: { keyword: "#9D7CD8", string: "#9ECE6A", comment: "#565F89", function: "#7AA2F7", variable: "#C0CAF5", type: "#2AC3DE", number: "#FF9E64", operator: "#89DDFF", punctuation: "#C0CAF5", tag: "#F7768E", attribute: "#7AA2F7", property: "#73DACA" },
  },
  {
    id: "nord", name: "Nord", group: "dark",
    globalColors: { background: "#2E3440", foreground: "#ECEFF4", outline: "#4C566A", accent: "#88C0D0", accentPositive: "#A3BE8C", accentNegative: "#BF616A" },
    syntaxColors: { keyword: "#81A1C1", string: "#A3BE8C", comment: "#616E88", function: "#88C0D0", variable: "#D8DEE9", type: "#8FBCBB", number: "#B48EAD", operator: "#81A1C1", punctuation: "#ECEFF4", tag: "#81A1C1", attribute: "#8FBCBB", property: "#88C0D0" },
  },
  {
    id: "catppuccin", name: "Catppuccin Mocha", group: "dark",
    globalColors: { background: "#1E1E2E", foreground: "#CDD6F4", outline: "#45475A", accent: "#CBA6F7", accentPositive: "#A6E3A1", accentNegative: "#F38BA8" },
    syntaxColors: { keyword: "#CBA6F7", string: "#A6E3A1", comment: "#6C7086", function: "#89B4FA", variable: "#CDD6F4", type: "#F9E2AF", number: "#FAB387", operator: "#89DCEB", punctuation: "#BAC2DE", tag: "#CBA6F7", attribute: "#89B4FA", property: "#F2CDCD" },
  },
  {
    id: "vitesse-dark", name: "Vitesse Dark", group: "dark",
    globalColors: { background: "#121212", foreground: "#DBD7CA", outline: "#2E2E2E", accent: "#4D9375", accentPositive: "#4D9375", accentNegative: "#CB7676" },
    syntaxColors: { keyword: "#4D9375", string: "#C98A7D", comment: "#666666", function: "#80A665", variable: "#DBD7CA", type: "#5DA994", number: "#4C9A91", operator: "#CB7676", punctuation: "#858585", tag: "#4D9375", attribute: "#BD976A", property: "#B8A965" },
  },
  {
    id: "ecode-light", name: "E-Code Light", group: "light",
    globalColors: { background: "#FFFFFF", foreground: "#1F2328", outline: "#D0D7DE", accent: "#7C65CB", accentPositive: "#1A7F37", accentNegative: "#CF222E" },
    syntaxColors: { keyword: "#CF222E", string: "#0A3069", comment: "#6E7781", function: "#8250DF", variable: "#953800", type: "#0550AE", number: "#0550AE", operator: "#CF222E", punctuation: "#24292F", tag: "#116329", attribute: "#0550AE", property: "#8250DF" },
  },
  {
    id: "github-light", name: "GitHub Light", group: "light",
    globalColors: { background: "#FFFFFF", foreground: "#24292F", outline: "#D0D7DE", accent: "#0969DA", accentPositive: "#1A7F37", accentNegative: "#CF222E" },
    syntaxColors: { keyword: "#CF222E", string: "#0A3069", comment: "#6E7781", function: "#8250DF", variable: "#953800", type: "#0550AE", number: "#0550AE", operator: "#CF222E", punctuation: "#24292F", tag: "#116329", attribute: "#0550AE", property: "#8250DF" },
  },
  {
    id: "solarized-light", name: "Solarized Light", group: "light",
    globalColors: { background: "#FDF6E3", foreground: "#657B83", outline: "#D6CFB5", accent: "#268BD2", accentPositive: "#859900", accentNegative: "#DC322F" },
    syntaxColors: { keyword: "#859900", string: "#2AA198", comment: "#93A1A1", function: "#268BD2", variable: "#B58900", type: "#D33682", number: "#D33682", operator: "#859900", punctuation: "#657B83", tag: "#268BD2", attribute: "#B58900", property: "#268BD2" },
  },
  {
    id: "min-light", name: "Min Light", group: "light",
    globalColors: { background: "#FFFFFF", foreground: "#1B1B1F", outline: "#E5E5E5", accent: "#1976D2", accentPositive: "#388E3C", accentNegative: "#D32F2F" },
    syntaxColors: { keyword: "#1976D2", string: "#388E3C", comment: "#9B9B9B", function: "#6A1B9A", variable: "#1B1B1F", type: "#00838F", number: "#E65100", operator: "#1976D2", punctuation: "#1B1B1F", tag: "#1976D2", attribute: "#6A1B9A", property: "#00838F" },
  },
];

export function ReplitThemesPanel({ projectId }: { projectId: string }) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "dark" | "light">("all");
  const { toast } = useToast();
  const { activeTheme, setActiveTheme } = useTheme();

  const currentThemeId = useMemo(() => {
    const match = QUICK_THEMES.find(qt =>
      qt.globalColors.background === activeTheme.globalColors.background &&
      qt.globalColors.foreground === activeTheme.globalColors.foreground
    );
    return match?.id || null;
  }, [activeTheme]);

  const handleApply = (qt: QuickTheme) => {
    const themeData: ThemeData = {
      id: null,
      title: qt.name,
      baseScheme: qt.group,
      globalColors: qt.globalColors,
      syntaxColors: qt.syntaxColors,
    };
    setActiveTheme(themeData);
    toast({ title: `Theme: ${qt.name}`, description: "Applied successfully" });
  };

  const filtered = useMemo(() => {
    return QUICK_THEMES.filter(t => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchGroup = groupFilter === "all" || t.group === groupFilter;
      return matchSearch && matchGroup;
    });
  }, [search, groupFilter]);

  const darkThemes = filtered.filter(t => t.group === "dark");
  const lightThemes = filtered.filter(t => t.group === "light");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-[#CBA6F7]" />
          <h2 className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-themes-title">Themes</h2>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search themes..."
            className="h-7 pl-7 text-[11px] bg-[var(--ide-surface)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md"
            data-testid="input-search-themes"
          />
        </div>
        <div className="flex gap-1">
          {([["all", Monitor, "All"], ["dark", Moon, "Dark"], ["light", Sun, "Light"]] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setGroupFilter(id)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                groupFilter === id
                  ? "bg-[#CBA6F7]/15 border-[#CBA6F7]/40 text-[#CBA6F7]"
                  : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
              )}
              data-testid={`button-filter-${id}`}
            >
              <Icon className="w-2.5 h-2.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {darkThemes.length > 0 && (groupFilter === "all" || groupFilter === "dark") && (
          <ThemeGroup title="Dark Themes" themes={darkThemes} currentThemeId={currentThemeId} onApply={handleApply} />
        )}
        {lightThemes.length > 0 && (groupFilter === "all" || groupFilter === "light") && (
          <ThemeGroup title="Light Themes" themes={lightThemes} currentThemeId={currentThemeId} onApply={handleApply} />
        )}
        {filtered.length === 0 && (
          <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-6">No themes match your search</p>
        )}
      </div>
    </div>
  );
}

function ThemeGroup({ title, themes, currentThemeId, onApply }: {
  title: string;
  themes: QuickTheme[];
  currentThemeId: string | null;
  onApply: (t: QuickTheme) => void;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1.5">
        {themes.map(theme => {
          const active = currentThemeId === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => onApply(theme)}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left",
                active
                  ? "border-[#CBA6F7]/60 bg-[#CBA6F7]/10"
                  : "border-transparent hover:bg-[var(--ide-surface)] hover:border-[var(--ide-border)]"
              )}
              data-testid={`button-theme-${theme.id}`}
            >
              <div className="w-12 h-8 rounded-md border border-[var(--ide-border)] overflow-hidden flex shrink-0" style={{ backgroundColor: theme.globalColors.background }}>
                <div className="w-3 h-full" style={{ backgroundColor: theme.globalColors.background, borderRight: `1px solid ${theme.globalColors.outline}` }} />
                <div className="flex-1 p-0.5 flex flex-col gap-0.5">
                  <div className="h-1 rounded-sm w-full" style={{ backgroundColor: theme.globalColors.accent }} />
                  <div className="h-1 rounded-sm w-3/4" style={{ backgroundColor: theme.globalColors.foreground, opacity: 0.4 }} />
                  <div className="h-1 rounded-sm w-1/2" style={{ backgroundColor: theme.globalColors.foreground, opacity: 0.3 }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-[var(--ide-text)]">{theme.name}</span>
              </div>
              {active && <Check className="w-3.5 h-3.5 text-[#CBA6F7] shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
