import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  X, ChevronDown, ChevronRight, Palette, FileCode2, Brain, Terminal,
  Bell, Accessibility, Keyboard, Settings, Key, Plus,
} from "lucide-react";
import type {
  UserPreferences, UserPreferencesStored,
  CommunityThemeDefinition, CustomTheme,
} from "@shared/schema";
import { COMMUNITY_THEMES } from "@shared/schema";
import KeyboardShortcutsSettings from "./KeyboardShortcutsSettings";

interface UserSettingsPanelProps {
  prefs: UserPreferences;
  onPrefsChange: (partial: Partial<UserPreferencesStored>) => void;
  onClose: () => void;
  onOpenProjectSettings: () => void;
  onOpenEnvVars: () => void;
}

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--ide-border)]">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--ide-surface)]/40 transition-colors text-left"
        onClick={() => setOpen(!open)}
        data-testid={`section-${title.toLowerCase().replace(/[^a-z]/g, "-")}`}
      >
        {open ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
        <Icon className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex-1">{title}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function ToggleSetting({ label, description, checked, onCheckedChange, testId }: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 min-w-0 pr-2">
        <span className="text-[11px] text-[var(--ide-text-secondary)] block">{label}</span>
        {description && <span className="text-[9px] text-[var(--ide-text-muted)] block mt-0.5">{description}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}

function ThemeSwatch({ theme, selected, onClick }: {
  theme: CommunityThemeDefinition;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg p-2 border transition-all text-left ${
        selected
          ? "border-[#0079F2] ring-1 ring-[#0079F2]/30"
          : "border-[var(--ide-border)] hover:border-[var(--ide-text-muted)]"
      }`}
      onClick={onClick}
      data-testid={`theme-swatch-${theme.id}`}
    >
      <div className="flex gap-1 mb-1.5">
        {Object.values(theme.colors).map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="text-[10px] text-[var(--ide-text)] font-medium truncate">{theme.name}</div>
      <div className="text-[8px] text-[var(--ide-text-muted)] truncate">{theme.author}</div>
    </button>
  );
}

function CustomThemeEditor({ theme, onChange }: {
  theme: CustomTheme | null;
  onChange: (t: CustomTheme | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(theme?.name || "My Theme");
  const [colors, setColors] = useState(theme?.colors || {
    background: "#1C2333", text: "#CFD7E6", accent: "#0079F2", panel: "#0E1525", border: "#2B3245"
  });

  const save = () => {
    onChange({ name, colors });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-[var(--ide-border)] hover:border-[#0079F2]/40 hover:bg-[var(--ide-surface)] transition-colors text-left mt-2"
        onClick={() => setEditing(true)}
        data-testid="button-create-custom-theme"
      >
        <Plus className="w-3 h-3 text-[var(--ide-text-muted)]" />
        <span className="text-[10px] text-[var(--ide-text-secondary)]">
          {theme ? "Edit Custom Theme" : "Create Custom Theme"}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]/30 space-y-2" data-testid="custom-theme-editor">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Theme name"
        className="h-7 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
        data-testid="input-theme-name"
      />
      {(["background", "text", "accent", "panel", "border"] as const).map((key) => (
        <div key={key} className="flex items-center gap-2">
          <label className="text-[9px] text-[var(--ide-text-muted)] capitalize w-16">{key}</label>
          <input
            type="color"
            value={colors[key]}
            onChange={(e) => setColors(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            data-testid={`input-color-${key}`}
          />
          <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{colors[key]}</span>
        </div>
      ))}
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" className="h-6 px-3 text-[9px] bg-[#0079F2] text-white hover:bg-[#006AD4]" onClick={save} data-testid="button-save-custom-theme">Save</Button>
        <Button size="sm" variant="ghost" className="h-6 px-3 text-[9px] text-[var(--ide-text-muted)]" onClick={() => setEditing(false)}>Cancel</Button>
        {theme && (
          <Button size="sm" variant="ghost" className="h-6 px-3 text-[9px] text-red-400 ml-auto" onClick={() => { onChange(null); setEditing(false); }} data-testid="button-delete-custom-theme">Remove</Button>
        )}
      </div>
    </div>
  );
}

export default function UserSettingsPanel({
  prefs, onPrefsChange, onClose, onOpenProjectSettings, onOpenEnvVars,
}: UserSettingsPanelProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="settings-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Settings</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={onClose} data-testid="button-close-settings">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section title="Appearance" icon={Palette} defaultOpen={true}>
          <div className="space-y-3">
            <div>
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-1.5 block">Base Theme</span>
              <div className="flex gap-2">
                <button
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-[11px] ${prefs.theme === "dark" ? "bg-[#0079F2]/10 border border-[#0079F2]/30 text-[var(--ide-text)]" : "bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-muted)]"}`}
                  onClick={() => onPrefsChange({ theme: "dark", communityTheme: null })}
                  data-testid="button-theme-dark"
                >
                  <span className="w-4 h-4 rounded-full bg-[var(--ide-bg)] border border-[var(--ide-border)]" /> Dark
                </button>
                <button
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-[11px] ${prefs.theme === "light" ? "bg-[#0079F2]/10 border border-[#0079F2]/30 text-[var(--ide-text)]" : "bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-muted)]"}`}
                  onClick={() => onPrefsChange({ theme: "light", communityTheme: null })}
                  data-testid="button-theme-light"
                >
                  <span className="w-4 h-4 rounded-full bg-white border border-gray-300" /> Light
                </button>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-1.5 block">Community Themes</span>
              <div className="grid grid-cols-2 gap-1.5">
                {COMMUNITY_THEMES.map(theme => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    selected={prefs.communityTheme === theme.id}
                    onClick={() => onPrefsChange({ communityTheme: theme.id })}
                  />
                ))}
              </div>
              {prefs.communityTheme && (
                <button
                  className="mt-1.5 text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] underline"
                  onClick={() => onPrefsChange({ communityTheme: null })}
                  data-testid="button-clear-community-theme"
                >
                  Clear community theme
                </button>
              )}
            </div>
            <div>
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-1 block">Custom Theme</span>
              <CustomThemeEditor
                theme={prefs.customTheme}
                onChange={(t) => onPrefsChange({ customTheme: t })}
              />
            </div>
          </div>
        </Section>

        <Section title="File Editor" icon={FileCode2}>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px] text-[var(--ide-text-secondary)]">Font Size</span>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => onPrefsChange({ fontSize: Math.max(10, prefs.fontSize - 1) })} data-testid="button-font-size-decrease">
                  <span className="text-xs font-bold">-</span>
                </Button>
                <span className="text-[11px] text-[var(--ide-text)] w-6 text-center font-mono" data-testid="text-font-size">{prefs.fontSize}</span>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => onPrefsChange({ fontSize: Math.min(24, prefs.fontSize + 1) })} data-testid="button-font-size-increase">
                  <span className="text-xs font-bold">+</span>
                </Button>
              </div>
            </div>
            <ToggleSetting label="Auto Close Brackets" description="Automatically close brackets, quotes, etc." checked={prefs.autoCloseBrackets} onCheckedChange={(v) => onPrefsChange({ autoCloseBrackets: v })} testId="switch-auto-close-brackets" />
            <ToggleSetting label="Indentation Detection" description="Auto-detect indentation from file content" checked={prefs.indentationDetection} onCheckedChange={(v) => onPrefsChange({ indentationDetection: v })} testId="switch-indentation-detection" />
            <ToggleSetting label="Format Pasted Text" description="Auto-format text when pasting" checked={prefs.formatPastedText} onCheckedChange={(v) => onPrefsChange({ formatPastedText: v })} testId="switch-format-pasted" />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px] text-[var(--ide-text-secondary)]">Indentation Character</span>
              <div className="flex items-center gap-1">
                {(["spaces", "tabs"] as const).map(c => (
                  <button key={c} onClick={() => onPrefsChange({ indentationChar: c })} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${prefs.indentationChar === c ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"}`} data-testid={`button-indent-char-${c}`}>
                    {c === "spaces" ? "Spaces" : "Tabs"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px] text-[var(--ide-text-secondary)]">Indentation Size</span>
              <div className="flex items-center gap-1">
                {[2, 4, 8].map(size => (
                  <button key={size} onClick={() => onPrefsChange({ indentationSize: size, tabSize: size })} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${prefs.indentationSize === size ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"}`} data-testid={`button-indent-size-${size}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <ToggleSetting label="Word Wrap" description="Wrap long lines to fit the editor width" checked={prefs.wordWrap} onCheckedChange={(v) => onPrefsChange({ wordWrap: v })} testId="switch-word-wrap" />
            <ToggleSetting label="Minimap" description="Show code minimap in the editor" checked={prefs.minimap} onCheckedChange={(v) => onPrefsChange({ minimap: v })} testId="switch-minimap" />
            <div className="flex items-center justify-between py-1.5">
              <div className="flex-1 min-w-0 pr-2">
                <span className="text-[11px] text-[var(--ide-text-secondary)] block">Multiselect Modifier</span>
                <span className="text-[9px] text-[var(--ide-text-muted)] block mt-0.5">Key for adding multiple cursors</span>
              </div>
              <div className="flex items-center gap-1">
                {(["Alt", "Ctrl", "Meta"] as const).map(mod => (
                  <button key={mod} onClick={() => onPrefsChange({ multiselectModifier: mod })} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${prefs.multiselectModifier === mod ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] border border-[var(--ide-border)]"}`} data-testid={`button-multiselect-${mod.toLowerCase()}`}>
                    {mod}
                  </button>
                ))}
              </div>
            </div>
            <ToggleSetting label="Filetree Git Status" description="Show git status indicators on file tree entries" checked={prefs.filetreeGitStatus} onCheckedChange={(v) => onPrefsChange({ filetreeGitStatus: v })} testId="switch-filetree-git" />
          </div>
        </Section>

        <Section title="Code Intelligence" icon={Brain}>
          <div className="space-y-1">
            <ToggleSetting label="Semantic Tokens" description="Enhanced syntax highlighting with semantic information" checked={prefs.semanticTokens} onCheckedChange={(v) => onPrefsChange({ semanticTokens: v })} testId="switch-semantic-tokens" />
            <ToggleSetting label="AI Code Completion" description="Inline AI-powered code suggestions" checked={prefs.aiCodeCompletion} onCheckedChange={(v) => onPrefsChange({ aiCodeCompletion: v })} testId="switch-ai-completion" />
            <ToggleSetting label="Accept Suggestion on Commit" description="Accept autocomplete on commit characters" checked={prefs.acceptSuggestionOnCommit} onCheckedChange={(v) => onPrefsChange({ acceptSuggestionOnCommit: v })} testId="switch-accept-on-commit" />
          </div>
        </Section>

        <Section title="Shell & Preview" icon={Terminal}>
          <div className="space-y-1">
            <ToggleSetting label="Shell Bell" description="Play audible sound on terminal bell character" checked={prefs.shellBell} onCheckedChange={(v) => onPrefsChange({ shellBell: v })} testId="switch-shell-bell" />
            <ToggleSetting label="Automatic Preview" description="Auto-open preview when server starts" checked={prefs.automaticPreview} onCheckedChange={(v) => onPrefsChange({ automaticPreview: v })} testId="switch-auto-preview" />
            <ToggleSetting label="Forward Opened Ports" description="Automatically detect and forward new ports" checked={prefs.forwardPorts} onCheckedChange={(v) => onPrefsChange({ forwardPorts: v })} testId="switch-forward-ports" />
          </div>
        </Section>

        <Section title="Notifications" icon={Bell}>
          <div className="space-y-1">
            <ToggleSetting label="Agent Audio Notification" description="Play sound when AI agent requests feedback" checked={prefs.agentAudioNotification} onCheckedChange={(v) => onPrefsChange({ agentAudioNotification: v })} testId="switch-agent-audio" />
            <ToggleSetting
              label="Agent Push Notification"
              description="Desktop notifications when agent needs attention"
              checked={prefs.agentPushNotification}
              onCheckedChange={(v) => {
                if (v && "Notification" in window && Notification.permission !== "granted") {
                  Notification.requestPermission().then(perm => {
                    if (perm === "granted") {
                      onPrefsChange({ agentPushNotification: true });
                    }
                  });
                } else {
                  onPrefsChange({ agentPushNotification: v });
                }
              }}
              testId="switch-agent-push"
            />
          </div>
        </Section>

        <Section title="Accessibility" icon={Accessibility}>
          <div className="space-y-1">
            <ToggleSetting label="Accessible Terminal Output" description="Enable screen reader mode and ARIA attributes for terminal" checked={prefs.accessibleTerminal} onCheckedChange={(v) => onPrefsChange({ accessibleTerminal: v })} testId="switch-accessible-terminal" />
          </div>
        </Section>

        <Section title="Keyboard Shortcuts" icon={Keyboard}>
          <KeyboardShortcutsSettings />
        </Section>

        <div className="border-b border-[var(--ide-border)] px-3 py-3">
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Project</span>
          <div className="mt-2 space-y-0.5">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={onOpenProjectSettings} data-testid="button-open-project-settings">
              <Settings className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
              <span className="text-[11px] text-[var(--ide-text-secondary)]">Project Settings</span>
              <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={onOpenEnvVars} data-testid="button-open-env-vars">
              <Key className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="text-[11px] text-[var(--ide-text-secondary)]">Secrets</span>
              <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
            </button>
          </div>
        </div>

        <div className="px-3 py-3">
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">About</span>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--ide-text-muted)]">Version</span>
              <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--ide-text-muted)]">Runtime</span>
              <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">Node.js</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--ide-text-muted)]">Editor</span>
              <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">CodeMirror 6</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--ide-border)]">
              <img src="/logo.png" alt="Vibe Companion" width={10} height={10} className="rounded" style={{ objectFit: 'contain' }} />
              <span className="text-[10px] text-[var(--ide-text-muted)]">Powered by Vibe Companion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
