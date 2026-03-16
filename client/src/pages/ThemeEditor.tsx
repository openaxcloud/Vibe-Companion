import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { ChevronLeft, Save, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme, type ThemeData, BUILTIN_DARK, BUILTIN_LIGHT } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { GlobalColors, SyntaxColors, Theme } from "@shared/schema";
import {
  DEFAULT_DARK_GLOBAL_COLORS,
  DEFAULT_LIGHT_GLOBAL_COLORS,
  DEFAULT_DARK_SYNTAX_COLORS,
  DEFAULT_LIGHT_SYNTAX_COLORS,
} from "@shared/schema";
import { buildHighlightStyle, buildEditorTheme } from "@/components/CodeEditor";
import { EditorView } from "@codemirror/view";
import { syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";

const GLOBAL_COLOR_LABELS: { key: keyof GlobalColors; label: string; description: string }[] = [
  { key: "background", label: "Background", description: "Main editor and panel background" },
  { key: "outline", label: "Outline", description: "Borders and separators" },
  { key: "foreground", label: "Foreground", description: "Primary text color" },
  { key: "primary", label: "Primary", description: "Accent color for buttons and links" },
  { key: "positive", label: "Positive", description: "Success and confirmation colors" },
  { key: "negative", label: "Negative", description: "Error and destructive colors" },
];

const SYNTAX_COLOR_LABELS: { key: keyof SyntaxColors; label: string }[] = [
  { key: "variableNames", label: "Variable Names" },
  { key: "variableDefinitions", label: "Variable Definitions" },
  { key: "functionReferences", label: "Function References" },
  { key: "functionDefinitions", label: "Function Definitions" },
  { key: "keywords", label: "Keywords" },
  { key: "propertyNames", label: "Property Names" },
  { key: "propertyDefinitions", label: "Property Definitions" },
  { key: "functionProperties", label: "Function Properties" },
  { key: "tagNames", label: "Tag Names" },
  { key: "typeNames", label: "Type Names" },
  { key: "classNames", label: "Class Names" },
  { key: "attributeNames", label: "Attribute Names" },
  { key: "comments", label: "Comments" },
  { key: "strings", label: "Strings" },
  { key: "numbers", label: "Numbers" },
  { key: "booleans", label: "Booleans" },
  { key: "regularExpressions", label: "Regular Expressions" },
  { key: "operators", label: "Operators" },
  { key: "brackets", label: "Brackets" },
];

const PREVIEW_CODE = `// Theme Preview - JavaScript
import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

class UserService {
  private baseUrl: string = "/api/users";

  async getUsers(): Promise<User[]> {
    const response = await fetch(this.baseUrl);
    return response.json();
  }

  filterActive(users: User[]): User[] {
    const pattern = /^[a-z]+$/i;
    return users.filter(u => u.isActive && pattern.test(u.name));
  }
}

function Dashboard({ title }: { title: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [count, setCount] = useState(0);
  const service = new UserService();

  useEffect(() => {
    // Load users on mount
    service.getUsers().then(data => {
      setUsers(data);
      setCount(data.length);
    });
  }, []);

  const activeCount = users.filter(u => u.isActive).length;
  const ratio = activeCount / (count || 1);

  return (
    <div className="dashboard">
      <h1>{title}</h1>
      <p>Total: {count} | Active: {activeCount}</p>
      <p>Ratio: {(ratio * 100).toFixed(2)}%</p>
      {users.map(user => (
        <span key={user.id}>{user.name}</span>
      ))}
    </div>
  );
}

export default Dashboard;
`;

function ColorPicker({ label, value, onChange, description }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-[var(--ide-border)] cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
          data-testid={`color-${label.toLowerCase().replace(/\s/g, "-")}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--ide-text)]">{label}</p>
        {description && <p className="text-[11px] text-[var(--ide-text-muted)]">{description}</p>}
      </div>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-[90px] h-7 text-[11px] font-mono bg-[var(--ide-input)] border-[var(--ide-border)] text-[var(--ide-text)]"
        data-testid={`input-color-${label.toLowerCase().replace(/\s/g, "-")}`}
      />
    </div>
  );
}

export default function ThemeEditor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setActiveTheme, refreshThemes } = useTheme();
  const { user } = useAuth();

  const params = window.location.pathname.match(/\/themes\/editor\/(.+)/);
  const editId = params?.[1];

  const { data: existingTheme } = useQuery<Theme>({
    queryKey: ["/api/themes", editId],
    enabled: !!editId,
    queryFn: async () => {
      const res = await fetch(`/api/themes/${editId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Theme not found");
      return res.json();
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseScheme, setBaseScheme] = useState<"dark" | "light">("dark");
  const [globalColors, setGlobalColors] = useState<GlobalColors>({ ...DEFAULT_DARK_GLOBAL_COLORS });
  const [syntaxColors, setSyntaxColors] = useState<SyntaxColors>({ ...DEFAULT_DARK_SYNTAX_COLORS });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (existingTheme && !initialized) {
      setTitle(existingTheme.title);
      setDescription(existingTheme.description);
      setBaseScheme(existingTheme.baseScheme as "dark" | "light");
      setGlobalColors(existingTheme.globalColors);
      setSyntaxColors(existingTheme.syntaxColors);
      setInitialized(true);
    }
  }, [existingTheme, initialized]);

  const handleBaseSchemeChange = (scheme: "dark" | "light") => {
    setBaseScheme(scheme);
    if (!initialized || !editId) {
      setGlobalColors(scheme === "dark" ? { ...DEFAULT_DARK_GLOBAL_COLORS } : { ...DEFAULT_LIGHT_GLOBAL_COLORS });
      setSyntaxColors(scheme === "dark" ? { ...DEFAULT_DARK_SYNTAX_COLORS } : { ...DEFAULT_LIGHT_SYNTAX_COLORS });
    }
  };

  const updateGlobal = (key: keyof GlobalColors, val: string) => {
    setGlobalColors(prev => ({ ...prev, [key]: val }));
  };

  const updateSyntax = (key: keyof SyntaxColors, val: string) => {
    setSyntaxColors(prev => ({ ...prev, [key]: val }));
  };

  const previewTheme = useMemo(() => buildEditorTheme(globalColors, baseScheme === "dark"), [globalColors, baseScheme]);
  const previewHighlight = useMemo(() => buildHighlightStyle(syntaxColors), [syntaxColors]);
  const previewExtensions = useMemo(() => [
    javascript({ jsx: true, typescript: true }),
    previewTheme,
    syntaxHighlighting(previewHighlight),
  ], [previewTheme, previewHighlight]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please provide a name for your theme.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = { title, description, baseScheme, globalColors, syntaxColors };
      let theme: Theme;
      if (editId) {
        const res = await apiRequest("PUT", `/api/themes/${editId}`, body);
        theme = await res.json();
      } else {
        const res = await apiRequest("POST", "/api/themes", body);
        theme = await res.json();
      }
      refreshThemes();
      toast({ title: "Theme saved", description: `"${theme.title}" has been saved.` });
      setActiveTheme({
        id: theme.id,
        title: theme.title,
        baseScheme: theme.baseScheme as "dark" | "light",
        globalColors: theme.globalColors,
        syntaxColors: theme.syntaxColors,
      });
      if (!editId) {
        setLocation(`/themes/editor/${theme.id}`);
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!editId) {
      toast({ title: "Save first", description: "Please save the theme before publishing.", variant: "destructive" });
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast({ title: "Missing info", description: "Both title and description are required to publish.", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      await apiRequest("POST", `/api/themes/${editId}/publish`);
      refreshThemes();
      toast({ title: "Published!", description: "Your theme is now available in the community catalog." });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleApply = () => {
    setActiveTheme({
      id: editId || null,
      title: title || "Custom Theme",
      baseScheme,
      globalColors,
      syntaxColors,
    });
    toast({ title: "Theme applied", description: "Your workspace is now using this theme." });
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="flex items-center gap-1.5 text-[13px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </Link>
          <div className="w-px h-5 bg-[var(--ide-border)]" />
          <h1 className="text-[14px] font-semibold">{editId ? "Edit Theme" : "Create Theme"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleApply} className="text-[12px] h-7 gap-1.5" data-testid="button-apply-theme">
            <Eye className="w-3.5 h-3.5" />
            Apply
          </Button>
          {editId && (
            <Button variant="outline" size="sm" onClick={handlePublish} disabled={publishing} className="text-[12px] h-7 gap-1.5" data-testid="button-publish-theme">
              <Upload className="w-3.5 h-3.5" />
              {publishing ? "Publishing..." : "Publish"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-[12px] h-7 gap-1.5 bg-[#0079F2] hover:bg-[#0066CC] text-white" data-testid="button-save-theme">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[340px] border-r border-[var(--ide-border)] overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <Label className="text-[12px] text-[var(--ide-text-secondary)] mb-1">Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My Custom Theme"
                className="h-8 text-[13px] bg-[var(--ide-input)] border-[var(--ide-border)]"
                data-testid="input-theme-title"
              />
            </div>
            <div>
              <Label className="text-[12px] text-[var(--ide-text-secondary)] mb-1">Description</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A beautiful theme for..."
                className="w-full h-16 px-3 py-2 text-[13px] bg-[var(--ide-input)] border border-[var(--ide-border)] rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#0079F2] text-[var(--ide-text)]"
                data-testid="input-theme-description"
              />
            </div>
            <div>
              <Label className="text-[12px] text-[var(--ide-text-secondary)] mb-1.5">Base Scheme</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBaseSchemeChange("dark")}
                  className={`flex-1 px-3 py-1.5 text-[12px] rounded-md border transition-colors ${baseScheme === "dark" ? "bg-[var(--ide-surface)] border-[#0079F2] text-[var(--ide-text)]" : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"}`}
                  data-testid="button-scheme-dark"
                >
                  Dark
                </button>
                <button
                  onClick={() => handleBaseSchemeChange("light")}
                  className={`flex-1 px-3 py-1.5 text-[12px] rounded-md border transition-colors ${baseScheme === "light" ? "bg-[var(--ide-surface)] border-[#0079F2] text-[var(--ide-text)]" : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"}`}
                  data-testid="button-scheme-light"
                >
                  Light
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-2">Global Colors</h3>
              <div className="space-y-0.5">
                {GLOBAL_COLOR_LABELS.map(({ key, label, description }) => (
                  <ColorPicker
                    key={key}
                    label={label}
                    value={globalColors[key]}
                    onChange={val => updateGlobal(key, val)}
                    description={description}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--ide-border)] pt-4">
              <h3 className="text-[12px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-2">Syntax Colors</h3>
              <div className="space-y-0.5">
                {SYNTAX_COLOR_LABELS.map(({ key, label }) => (
                  <ColorPicker
                    key={key}
                    label={label}
                    value={syntaxColors[key]}
                    onChange={val => updateSyntax(key, val)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
            <p className="text-[12px] text-[var(--ide-text-secondary)]">Live Preview</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeMirror
              value={PREVIEW_CODE}
              extensions={previewExtensions}
              theme="none"
              readOnly
              basicSetup={{
                lineNumbers: true,
                bracketMatching: true,
                foldGutter: true,
              }}
              style={{ height: "100%", width: "100%" }}
              data-testid="theme-preview-editor"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
