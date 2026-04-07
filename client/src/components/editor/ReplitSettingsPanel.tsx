import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { LazyMotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/components/ThemeProvider';
import {
  Settings,
  Code,
  Palette,
  Keyboard,
  Globe,
  Shield,
  Bell,
  User,
  Save,
  RotateCcw,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ElementType;
}

interface ProjectSettings {
  projectId?: number;
  fontSize: string;
  tabSize: string;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  autoSave: boolean;
  formatOnSave: boolean;
  editorTheme: string;
  projectName: string;
  projectDescription: string;
  projectPrivacy: 'public' | 'private' | 'unlisted';
  themeId?: string;
  customColors?: Record<string, string>;
  borderRadius?: number;
}

const defaultSettings: ProjectSettings = {
  fontSize: '14',
  tabSize: '2',
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoSave: true,
  formatOnSave: true,
  editorTheme: 'vs-light',
  projectName: 'My Project',
  projectDescription: 'A Replit project',
  projectPrivacy: 'public',
};

function SettingsSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {[1, 2, 3, 4].map((i) => (
        <LazyMotionDiv
          key={i}
          className="h-10 rounded-lg bg-muted"
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

export function ReplitSettingsPanel({ projectId }: { projectId?: string }) {
  const [activeSection, setActiveSection] = useState('editor');
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  const [fontSize, setFontSize] = useState(defaultSettings.fontSize);
  const [tabSize, setTabSize] = useState(defaultSettings.tabSize);
  const [wordWrap, setWordWrap] = useState(defaultSettings.wordWrap);
  const [lineNumbers, setLineNumbers] = useState(defaultSettings.lineNumbers);
  const [minimap, setMinimap] = useState(defaultSettings.minimap);
  const [autoSave, setAutoSave] = useState(defaultSettings.autoSave);
  const [formatOnSave, setFormatOnSave] = useState(defaultSettings.formatOnSave);

  const { theme, setTheme } = useTheme();
  const [editorTheme, setEditorTheme] = useState(defaultSettings.editorTheme);

  const [projectName, setProjectName] = useState(defaultSettings.projectName);
  const [projectDescription, setProjectDescription] = useState(defaultSettings.projectDescription);
  const [projectPrivacy, setProjectPrivacy] = useState<'public' | 'private' | 'unlisted'>(defaultSettings.projectPrivacy);

  const { data: settings, isLoading, refetch } = useQuery<ProjectSettings>({
    queryKey: ['/api/projects', projectId, 'settings'],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (settings) {
      setFontSize(settings.fontSize ?? defaultSettings.fontSize);
      setTabSize(settings.tabSize ?? defaultSettings.tabSize);
      setWordWrap(settings.wordWrap ?? defaultSettings.wordWrap);
      setLineNumbers(settings.lineNumbers ?? defaultSettings.lineNumbers);
      setMinimap(settings.minimap ?? defaultSettings.minimap);
      setAutoSave(settings.autoSave ?? defaultSettings.autoSave);
      setFormatOnSave(settings.formatOnSave ?? defaultSettings.formatOnSave);
      setEditorTheme(settings.editorTheme ?? defaultSettings.editorTheme);
      setProjectName(settings.projectName ?? defaultSettings.projectName);
      setProjectDescription(settings.projectDescription ?? defaultSettings.projectDescription);
      setProjectPrivacy(settings.projectPrivacy ?? defaultSettings.projectPrivacy);
      setIsDirty(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProjectSettings>) => {
      return apiRequest<ProjectSettings>('PUT', `/api/projects/${projectId}/settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'settings'] });
      setIsDirty(false);
      toast({
        title: 'Settings saved',
        description: 'Your project settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred while saving settings.',
        variant: 'destructive',
      });
    },
  });

  const sections: SettingSection[] = [
    { id: 'editor', title: 'Editor', icon: Code },
    { id: 'theme', title: 'Appearance', icon: Palette },
    { id: 'keyboard', title: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'environment', title: 'Environment', icon: Globe },
    { id: 'project', title: 'Project', icon: Shield },
    { id: 'notifications', title: 'Notifications', icon: Bell },
    { id: 'account', title: 'Account', icon: User }
  ];

  const handleSave = () => {
    saveMutation.mutate({
      fontSize,
      tabSize,
      wordWrap,
      lineNumbers,
      minimap,
      autoSave,
      formatOnSave,
      editorTheme,
      projectName,
      projectDescription,
      projectPrivacy,
    });
  };

  const handleReset = async () => {
    await refetch();
    setIsDirty(false);
    toast({
      title: 'Settings reset',
      description: 'Settings have been reset to last saved values.',
    });
  };

  const renderSectionContent = () => {
    if (isLoading) {
      return <SettingsSkeleton />;
    }

    switch (activeSection) {
      case 'editor':
        return (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Editor Preferences</span>
              
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fontSize" className="text-[13px] text-muted-foreground">Font Size</Label>
                    <Select value={fontSize} onValueChange={(v) => { setFontSize(v); setIsDirty(true); }}>
                      <SelectTrigger id="fontSize" className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="12" className="text-[15px] text-foreground">12px</SelectItem>
                        <SelectItem value="14" className="text-[15px] text-foreground">14px</SelectItem>
                        <SelectItem value="16" className="text-[15px] text-foreground">16px</SelectItem>
                        <SelectItem value="18" className="text-[15px] text-foreground">18px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tabSize" className="text-[13px] text-muted-foreground">Tab Size</Label>
                    <Select value={tabSize} onValueChange={(v) => { setTabSize(v); setIsDirty(true); }}>
                      <SelectTrigger id="tabSize" className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="2" className="text-[15px] text-foreground">2 spaces</SelectItem>
                        <SelectItem value="4" className="text-[15px] text-foreground">4 spaces</SelectItem>
                        <SelectItem value="8" className="text-[15px] text-foreground">8 spaces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted">
                    <Label htmlFor="wordWrap" className="text-[15px] leading-[20px] text-foreground cursor-pointer">Word Wrap</Label>
                    <Switch
                      id="wordWrap"
                      checked={wordWrap}
                      onCheckedChange={(v) => { setWordWrap(v); setIsDirty(true); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted">
                    <Label htmlFor="lineNumbers" className="text-[15px] leading-[20px] text-foreground cursor-pointer">Line Numbers</Label>
                    <Switch
                      id="lineNumbers"
                      checked={lineNumbers}
                      onCheckedChange={(v) => { setLineNumbers(v); setIsDirty(true); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted">
                    <Label htmlFor="minimap" className="text-[15px] leading-[20px] text-foreground cursor-pointer">Minimap</Label>
                    <Switch
                      id="minimap"
                      checked={minimap}
                      onCheckedChange={(v) => { setMinimap(v); setIsDirty(true); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted">
                    <Label htmlFor="autoSave" className="text-[15px] leading-[20px] text-foreground cursor-pointer">Auto Save</Label>
                    <Switch
                      id="autoSave"
                      checked={autoSave}
                      onCheckedChange={(v) => { setAutoSave(v); setIsDirty(true); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted">
                    <Label htmlFor="formatOnSave" className="text-[15px] leading-[20px] text-foreground cursor-pointer">Format on Save</Label>
                    <Switch
                      id="formatOnSave"
                      checked={formatOnSave}
                      onCheckedChange={(v) => { setFormatOnSave(v); setIsDirty(true); }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'theme':
        return (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Appearance Settings</span>
              
              <div className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="theme" className="text-[13px] text-muted-foreground">Application Theme</Label>
                  <Select value={theme} onValueChange={(v) => { setTheme(v as 'light' | 'dark' | 'system'); setIsDirty(true); }}>
                    <SelectTrigger id="theme" className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="light" className="text-[15px] text-foreground">Light</SelectItem>
                      <SelectItem value="dark" className="text-[15px] text-foreground">Dark</SelectItem>
                      <SelectItem value="system" className="text-[15px] text-foreground">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="editorTheme" className="text-[13px] text-muted-foreground">Editor Theme</Label>
                  <Select value={editorTheme} onValueChange={(v) => { setEditorTheme(v); setIsDirty(true); }}>
                    <SelectTrigger id="editorTheme" className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="vs-light" className="text-[15px] text-foreground">VS Light</SelectItem>
                      <SelectItem value="vs-dark" className="text-[15px] text-foreground">VS Dark</SelectItem>
                      <SelectItem value="monokai" className="text-[15px] text-foreground">Monokai</SelectItem>
                      <SelectItem value="github" className="text-[15px] text-foreground">GitHub</SelectItem>
                      <SelectItem value="solarized" className="text-[15px] text-foreground">Solarized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case 'keyboard':
        return (
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Keyboard Shortcuts</span>
            
            <div className="space-y-2 mt-3">
              {[
                { action: 'Save', keys: 'Cmd+S' },
                { action: 'Open File', keys: 'Cmd+O' },
                { action: 'Command Palette', keys: 'Cmd+Shift+P' },
                { action: 'Find', keys: 'Cmd+F' },
                { action: 'Replace', keys: 'Cmd+H' },
                { action: 'Toggle Terminal', keys: 'Cmd+`' },
                { action: 'New File', keys: 'Cmd+N' },
                { action: 'Close Tab', keys: 'Cmd+W' }
              ].map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between h-8 px-3 rounded-lg bg-muted hover:bg-accent transition-colors">
                  <span className="text-[15px] leading-[20px] text-foreground">{shortcut.action}</span>
                  <kbd className="px-2 py-0.5 text-[13px] bg-card text-muted-foreground rounded-lg border border-border">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full h-8 rounded-lg bg-card border-border text-[15px] text-foreground hover:bg-accent">
              Customize Shortcuts
            </Button>
          </div>
        );

      case 'environment':
        return (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Environment Variables</span>
              
              <div className="space-y-3 mt-3">
                {[
                  { key: 'NODE_ENV', value: 'development' },
                  { key: 'PORT', value: '3000' },
                  { key: 'API_URL', value: 'https://api.example.com' }
                ].map((env, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={env.key}
                      placeholder="Key"
                      className="flex-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground placeholder:text-muted-foreground"
                      onChange={() => setIsDirty(true)}
                    />
                    <Input
                      value={env.value}
                      placeholder="Value"
                      className="flex-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground placeholder:text-muted-foreground"
                      onChange={() => setIsDirty(true)}
                    />
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full h-8 rounded-lg mt-3 bg-card border-border text-[15px] text-foreground hover:bg-accent">
                Add Variable
              </Button>
            </div>
          </div>
        );

      case 'project':
        return (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Project Settings</span>
              
              <div className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="projectName" className="text-[13px] text-muted-foreground">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => { setProjectName(e.target.value); setIsDirty(true); }}
                    className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="projectDescription" className="text-[13px] text-muted-foreground">Description</Label>
                  <Input
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => { setProjectDescription(e.target.value); setIsDirty(true); }}
                    className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="privacy" className="text-[13px] text-muted-foreground">Privacy</Label>
                  <Select value={projectPrivacy} onValueChange={(v) => { setProjectPrivacy(v as 'public' | 'private' | 'unlisted'); setIsDirty(true); }}>
                    <SelectTrigger id="privacy" className="mt-1 h-8 rounded-lg bg-card border-border text-[15px] text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="public" className="text-[15px] text-foreground">Public</SelectItem>
                      <SelectItem value="private" className="text-[15px] text-foreground">Private</SelectItem>
                      <SelectItem value="unlisted" className="text-[15px] text-foreground">Unlisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <Settings className="w-[18px] h-[18px] text-muted-foreground mb-3" />
            <p className="text-[15px] leading-[20px] text-muted-foreground">Section coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Settings</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-48 border-r border-border">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 h-8 rounded-lg transition-colors",
                      activeSection === section.id
                        ? "bg-card text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    data-testid={`button-section-${section.id}`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="flex-1 text-left text-[15px] leading-[20px]">{section.title}</span>
                    <ChevronRight className="w-[18px] h-[18px] opacity-50" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-3">
              {renderSectionContent()}
            </div>
          </ScrollArea>

          {isDirty && (
            <LazyMotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-border p-3 bg-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">You have unsaved changes</span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="h-8 rounded-lg bg-transparent border-border text-[15px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={handleReset}
                    disabled={saveMutation.isPending}
                    data-testid="button-reset-settings"
                  >
                    <RotateCcw className="w-[18px] h-[18px] mr-1" />
                    Reset
                  </Button>
                  <Button 
                    className="h-8 rounded-lg bg-primary text-[15px] text-primary-foreground hover:bg-primary/90"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-[18px] h-[18px] mr-1 animate-spin" />
                    ) : (
                      <Save className="w-[18px] h-[18px] mr-1" />
                    )}
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </LazyMotionDiv>
          )}
        </div>
      </div>
    </div>
  );
}
