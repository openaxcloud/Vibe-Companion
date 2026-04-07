import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  Save,
  Download,
  Upload,
  Sparkles,
  Eye,
  Edit,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface ThemeSettings {
  id?: number;
  projectId: number;
  themeId: string;
  customColors: Record<string, string>;
  fontSize: number;
  borderRadius: number;
}

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    border: string;
  };
  isPro?: boolean;
  isCustom?: boolean;
}

export function ReplitThemesPanel({ projectId }: { projectId?: string }) {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [customColors, setCustomColors] = useState({
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#ffffff',
    foreground: '#1f2937',
    accent: '#f59e0b',
    muted: '#6b7280',
    border: '#e5e7eb'
  });

  const [fontSize, setFontSize] = useState([14]);
  const [borderRadius, setBorderRadius] = useState([4]);

  // Fetch theme settings from API
  const { data: themeSettings, isLoading, isSuccess } = useQuery<ThemeSettings>({
    queryKey: ['/api/projects', projectId, 'themes'],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiRequest('GET', `/api/projects/${projectId}/themes`);
      if (!res.ok) throw new Error('Failed to fetch theme settings');
      return await res.json();
    },
    enabled: !!projectId,
  });

  // Sync local state with fetched settings
  useEffect(() => {
    if (themeSettings) {
      setSelectedTheme(themeSettings.themeId || 'light');
      if (themeSettings.customColors && Object.keys(themeSettings.customColors).length > 0) {
        setCustomColors(prev => ({ ...prev, ...themeSettings.customColors }));
      }
      setFontSize([themeSettings.fontSize || 14]);
      setBorderRadius([themeSettings.borderRadius || 4]);
    }
  }, [themeSettings]);

  // Save theme mutation
  const saveThemeMutation = useMutation({
    mutationFn: async (settings: Partial<ThemeSettings>) => {
      if (!projectId) throw new Error('No project ID');
      const res = await apiRequest('PUT', `/api/projects/${projectId}/themes`, settings);
      if (!res.ok) throw new Error('Failed to save theme settings');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'themes'] });
      toast({ title: 'Theme saved', description: 'Your theme settings have been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Auto-save when theme changes - only save after initial data is loaded
  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    if (projectId && isSuccess) {
      saveThemeMutation.mutate({ themeId, customColors, fontSize: fontSize[0], borderRadius: borderRadius[0] });
    }
  };

  const themePresets: ThemePreset[] = [
    {
      id: 'light',
      name: 'Light',
      description: 'Clean and bright theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#ffffff',
        foreground: '#1f2937',
        accent: '#f59e0b',
        muted: '#6b7280',
        border: '#e5e7eb'
      }
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Easy on the eyes',
      colors: {
        primary: '#60a5fa',
        secondary: '#a78bfa',
        background: '#1e1e1e',
        foreground: '#f3f4f6',
        accent: '#fbbf24',
        muted: '#9ca3af',
        border: '#374151'
      }
    },
    {
      id: 'midnight',
      name: 'Midnight',
      description: 'Deep blue dark theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#0f172a',
        foreground: '#e2e8f0',
        accent: '#38bdf8',
        muted: '#94a3b8',
        border: '#1e293b'
      },
      isPro: true
    },
    {
      id: 'forest',
      name: 'Forest',
      description: 'Natural green tones',
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        background: '#f0fdf4',
        foreground: '#14532d',
        accent: '#84cc16',
        muted: '#4ade80',
        border: '#bbf7d0'
      },
      isPro: true
    },
    {
      id: 'sunset',
      name: 'Sunset',
      description: 'Warm and vibrant',
      colors: {
        primary: '#f97316',
        secondary: '#dc2626',
        background: '#fef3c7',
        foreground: '#7c2d12',
        accent: '#fbbf24',
        muted: '#fb923c',
        border: '#fed7aa'
      }
    }
  ];

  const handleColorChange = (colorKey: string, value: string) => {
    setCustomColors(prev => ({
      ...prev,
      [colorKey]: value
    }));
  };

  const handleSaveCustomTheme = () => {
    if (projectId && !isLoading) {
      saveThemeMutation.mutate({ 
        themeId: 'custom', 
        customColors, 
        fontSize: fontSize[0], 
        borderRadius: borderRadius[0] 
      });
    }
  };

  const handleSaveEditorSettings = () => {
    if (projectId && !isLoading) {
      saveThemeMutation.mutate({ 
        themeId: selectedTheme, 
        customColors, 
        fontSize: fontSize[0], 
        borderRadius: borderRadius[0] 
      });
    }
  };

  const handleExportTheme = () => {
    const themeData = {
      name: 'Custom Theme',
      colors: customColors,
      fontSize: fontSize[0],
      borderRadius: borderRadius[0]
    };
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.json';
    a.click();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Themes</span>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex gap-0.5 p-0.5 bg-[var(--ecode-sidebar-hover)] rounded">
          <button
            className={cn(
              "flex-1 px-3 py-1.5 text-[13px] rounded transition-colors",
              "flex items-center justify-center gap-2",
              selectedTheme === 'light' && "bg-background shadow-sm"
            )}
            onClick={() => handleThemeSelect('light')}
            disabled={isLoading}
            data-testid="button-theme-light"
          >
            <Sun className="h-3 w-3" />
            Light
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-1.5 text-[13px] rounded transition-colors",
              "flex items-center justify-center gap-2",
              selectedTheme === 'dark' && "bg-background shadow-sm"
            )}
            onClick={() => handleThemeSelect('dark')}
            disabled={isLoading}
            data-testid="button-theme-dark"
          >
            <Moon className="h-3 w-3" />
            Dark
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-1.5 text-[13px] rounded transition-colors",
              "flex items-center justify-center gap-2",
              selectedTheme === 'system' && "bg-background shadow-sm"
            )}
            onClick={() => handleThemeSelect('system')}
            disabled={isLoading}
            data-testid="button-theme-system"
          >
            <Monitor className="h-3 w-3" />
            System
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="presets" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 px-4 pt-2">
          <TabsTrigger value="presets" className="text-[11px]">Presets</TabsTrigger>
          <TabsTrigger value="customize" className="text-[11px]">Customize</TabsTrigger>
          <TabsTrigger value="editor" className="text-[11px]">Editor</TabsTrigger>
        </TabsList>

        {/* Presets Tab */}
        <TabsContent value="presets" className="flex-1">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="grid gap-3">
                {themePresets.map((theme) => (
                  <div
                    key={theme.id}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-all",
                      selectedTheme === theme.id 
                        ? "border-status-info bg-status-info/10" 
                        : "border-border hover:border-border hover:bg-muted"
                    )}
                    onClick={() => !theme.isPro && setSelectedTheme(theme.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-[13px]">{theme.name}</h4>
                          {theme.isPro && (
                            <Badge className="text-[11px] px-1.5 py-0">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Pro
                            </Badge>
                          )}
                          {theme.isCustom && (
                            <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                              Custom
                            </Badge>
                          )}
                          {selectedTheme === theme.id && (
                            <Check className="h-4 w-4 text-status-info" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{theme.description}</p>
                      </div>
                    </div>

                    {/* Color Preview */}
                    <div className="flex gap-2 mt-3">
                      {Object.entries(theme.colors).slice(0, 5).map(([key, color]) => (
                        <div
                          key={key}
                          className="flex-1 h-8 rounded border border-border"
                          style={{ backgroundColor: color }}
                          title={key}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Customize Tab */}
        <TabsContent value="customize" className="flex-1">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Color Customization */}
              {Object.entries(customColors).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key} className="text-[13px] capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-border"
                        style={{ backgroundColor: value }}
                      />
                      <span className="text-[11px] font-mono text-muted-foreground">{value}</span>
                    </div>
                  </div>
                  <Input
                    id={key}
                    type="color"
                    value={value}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    className="h-8"
                  />
                </div>
              ))}

              {/* Typography */}
              <div className="pt-4 border-t border-border">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[13px]">Font Size</Label>
                      <span className="text-[11px] text-muted-foreground">{fontSize[0]}px</span>
                    </div>
                    <Slider
                      value={fontSize}
                      onValueChange={setFontSize}
                      min={12}
                      max={20}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[13px]">Border Radius</Label>
                      <span className="text-[11px] text-muted-foreground">{borderRadius[0]}px</span>
                    </div>
                    <Slider
                      value={borderRadius}
                      onValueChange={setBorderRadius}
                      min={0}
                      max={12}
                      step={1}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleSaveCustomTheme}>
                  <Save className="h-3 w-3 mr-1" />
                  Save Theme
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportTheme}>
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1">
          <ScrollArea className="h-full">
            <div className="p-4">
              <h4 className="text-[13px] font-medium mb-3">Editor Themes</h4>
              
              <div className="space-y-2">
                {['VS Code', 'Monokai', 'GitHub', 'Solarized', 'Dracula', 'Nord'].map((theme) => (
                  <button
                    key={theme}
                    className="w-full p-3 text-left border border-border rounded hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-foreground">{theme}</span>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Live Preview */}
              <div className="mt-6">
                <h4 className="text-[13px] font-medium mb-3">Preview</h4>
                <div className="p-4 bg-background rounded text-white font-mono text-[11px]">
                  <div className="text-status-info">// Sample code preview</div>
                  <div>
                    <span className="text-primary">function</span>{' '}
                    <span className="text-status-warning">hello</span>
                    <span className="text-muted-foreground">(</span>
                    <span className="text-status-warning">name</span>
                    <span className="text-muted-foreground">)</span>{' '}
                    <span className="text-muted-foreground">{'{'}</span>
                  </div>
                  <div className="ml-4">
                    <span className="text-primary">return</span>{' '}
                    <span className="text-status-success">`Hello, ${'{'}name{'}'}`</span>
                    <span className="text-muted-foreground">;</span>
                  </div>
                  <div className="text-muted-foreground">{'}'}</div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}