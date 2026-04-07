import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Palette, Sun, Moon, Monitor, Check, 
  Star, Download, Upload, Code, Sparkles,
  Brush, Eye, Settings, ChevronRight
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Theme {
  id: string;
  name: string;
  description?: string;
  preview: {
    bg: string;
    fg: string;
    accent: string;
  };
  category?: string;
  rating?: number;
  downloads?: number;
}

interface ThemeSettings {
  activeEditorTheme: string;
  systemTheme: string;
  editor?: any;
  ui?: any;
  includes?: string[];
  customSettings?: {
    fontSize: string;
    lineHeight: string;
    tabSize: string;
    wordWrap: string;
  };
}

interface ThemesResponse {
  editor: Theme[];
  ui: Theme[];
  includes: string[];
}

export default function Themes() {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState('dark-pro');
  const [systemTheme, setSystemTheme] = useState('dark');
  const [themeSettings, setThemeSettings] = useState<ThemeSettings | null>(null);

  // Fetch available themes
  const { data: themes, isLoading: themesLoading } = useQuery<ThemesResponse>({
    queryKey: ['/api/themes']
  });
  
  // Fetch user theme settings
  const { data: userSettings } = useQuery<ThemeSettings>({
    queryKey: ['/api/themes/settings']
  });
  
  // Fetch installed themes
  const { data: installedThemes } = useQuery<Theme[]>({
    queryKey: ['/api/themes/installed']
  });
  
  // Update theme settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ThemeSettings) => {
      const response = await apiRequest('PUT', '/api/themes/settings', settings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/settings'] });
      toast({
        title: "Settings saved",
        description: "Your theme settings have been updated"
      });
    }
  });
  
  // Install theme mutation
  const installThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const response = await apiRequest('POST', '/api/themes/install', { themeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/installed'] });
      toast({
        title: "Theme installed",
        description: "The theme has been added to your collection"
      });
    }
  });
  
  // Initialize theme settings from user data
  useEffect(() => {
    if (userSettings) {
      setSelectedTheme(userSettings.activeEditorTheme || 'dark-pro');
      setSystemTheme(userSettings.systemTheme || 'dark');
      setThemeSettings(userSettings);
    }
  }, [userSettings]);

  const customThemeSettings = [
    { id: 'font-size', label: 'Font Size', value: '14px' },
    { id: 'line-height', label: 'Line Height', value: '1.5' },
    { id: 'tab-size', label: 'Tab Size', value: '2' },
    { id: 'word-wrap', label: 'Word Wrap', value: 'on' }
  ];

  const handleThemeChange = async (themeId: string) => {
    setSelectedTheme(themeId);
    
    // Update theme settings on the server
    const updatedSettings: ThemeSettings = {
      ...(themeSettings || {}),
      activeEditorTheme: themeId,
      systemTheme: themeSettings?.systemTheme || systemTheme || 'dark'
    };
    
    updateSettingsMutation.mutate(updatedSettings);
    
    const themeName = themes?.editor?.find((t: any) => t.id === themeId)?.name || themeId;
    toast({
      title: "Theme applied",
      description: `Successfully switched to ${themeName} theme`
    });
  };

  const handleCreateTheme = async () => {
    // Create custom theme API call
    const customTheme = {
      name: 'My Custom Theme',
      description: 'A personalized theme',
      preview: { bg: '#1e1e1e', fg: '#d4d4d4', accent: '#007acc' }
    };
    
    try {
      const response = await apiRequest('POST', '/api/themes/create', customTheme);
      await response.json();
      
      toast({
        title: "Theme created",
        description: "Your custom theme has been created"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create theme",
        variant: "destructive"
      });
    }
  };

  const handleExportTheme = async () => {
    try {
      const response = await fetch('/api/themes/export', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ecode-theme-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Theme exported",
          description: "Your theme settings have been downloaded"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export theme",
        variant: "destructive"
      });
    }
  };

  const handleImportTheme = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const settings = JSON.parse(event.target?.result as string);
            const response = await apiRequest('POST', '/api/themes/import', { settings });
            await response.json();
            
            queryClient.invalidateQueries({ queryKey: ['/api/themes/settings'] });
            
            toast({
              title: "Theme imported",
              description: "Your theme settings have been imported successfully"
            });
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to import theme file",
              variant: "destructive"
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };
  
  const handleSaveSettings = () => {
    const settingsToSave: ThemeSettings = {
      ...(themeSettings || {}),
      activeEditorTheme: themeSettings?.activeEditorTheme || selectedTheme || 'dark-pro',
      systemTheme: systemTheme,
      customSettings: {
        fontSize: (document.getElementById('font-size') as HTMLInputElement)?.value || '14px',
        lineHeight: (document.getElementById('line-height') as HTMLInputElement)?.value || '1.5',
        tabSize: (document.getElementById('tab-size') as HTMLInputElement)?.value || '2',
        wordWrap: (document.getElementById('word-wrap') as HTMLInputElement)?.value || 'on'
      }
    };
    updateSettingsMutation.mutate(settingsToSave);
  };
  
  if (themesLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-6">
        <div className="text-center">Loading themes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-6" data-testid="page-themes">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3 text-[var(--ecode-text)]" data-testid="heading-themes">
          <Palette className="h-8 w-8 text-purple-500" />
          Themes
        </h1>
        <p className="text-[var(--ecode-text-secondary)] mt-2 text-base">
          Customize your coding environment with beautiful themes
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-4" data-testid="tabs-themes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse" data-testid="tab-browse">Browse Themes</TabsTrigger>
          <TabsTrigger value="installed" data-testid="tab-installed">Installed</TabsTrigger>
          <TabsTrigger value="create" data-testid="tab-create">Create Theme</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Browse Themes Tab */}
        <TabsContent value="browse" className="space-y-6">
          {/* Editor Themes */}
          <Card>
            <CardHeader>
              <CardTitle>Editor Themes</CardTitle>
              <CardDescription>
                Choose a color scheme for your code editor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {themes?.editor?.map((theme: any) => (
                  <Card 
                    key={theme.id} 
                    className={`cursor-pointer transition-all ${
                      selectedTheme === theme.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleThemeChange(theme.id)}
                    data-testid={`card-theme-${theme.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {theme.name}
                            {theme.official && (
                              <Badge variant="secondary">
                                <Check className="h-3 w-3 mr-1" />
                                Official
                              </Badge>
                            )}
                          </h3>
                          <p className="text-[13px] text-muted-foreground">
                            by {theme.author}
                          </p>
                        </div>
                        {selectedTheme === theme.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      
                      {/* Theme Preview */}
                      <div 
                        className="rounded-md p-3 mb-3 font-mono text-[11px]"
                        style={{ 
                          backgroundColor: theme.preview.bg,
                          color: theme.preview.fg 
                        }}
                      >
                        <div style={{ color: theme.preview.accent }}>function</div>
                        <div>  <span style={{ color: theme.preview.accent }}>console</span>.log(<span style={{ color: '#ce9178' }}>"Hello World"</span>);</div>
                        <div>{'}'}</div>
                      </div>
                      
                      <p className="text-[13px] text-muted-foreground mb-3">
                        {theme.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {theme.downloads.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {theme.rating}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {!installedThemes?.includes(theme.id) && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                installThemeMutation.mutate(theme.id);
                              }}
                              disabled={installThemeMutation.isPending}
                              data-testid={`button-install-theme-${theme.id}`}
                            >
                              Install
                            </Button>
                          )}
                          <Button size="sm" variant="outline" data-testid={`button-preview-theme-${theme.id}`}>
                            Preview
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* UI Themes */}
          <Card>
            <CardHeader>
              <CardTitle>UI Themes</CardTitle>
              <CardDescription>
                Change the overall appearance of E-Code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {themes?.ui?.map((theme: any) => (
                  <Card key={theme.id} className="cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{theme.name}</h3>
                      <p className="text-[13px] text-muted-foreground mb-3">
                        {theme.description}
                      </p>
                      
                      {/* UI Preview */}
                      <div className="flex gap-2 mb-3">
                        <div 
                          className="w-12 h-12 rounded-lg"
                          style={{ backgroundColor: theme.preview.bg }}
                        />
                        <div 
                          className="w-12 h-12 rounded-lg"
                          style={{ backgroundColor: theme.preview.surface }}
                        />
                        <div 
                          className="w-12 h-12 rounded-lg"
                          style={{ backgroundColor: theme.preview.primary }}
                        />
                      </div>
                      
                      <Button size="sm" className="w-full" data-testid={`button-apply-ui-theme-${theme.id}`}>
                        Apply Theme
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Installed Tab */}
        <TabsContent value="installed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Installed Themes</CardTitle>
              <CardDescription>
                Manage your installed themes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {themes?.editor?.filter((t: any) => installedThemes?.includes(t.id)).map((theme: any) => (
                  <div key={theme.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: theme.preview.bg }}
                        />
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: theme.preview.accent }}
                        />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {theme.name}
                          {selectedTheme === theme.id && (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {theme.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTheme !== theme.id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleThemeChange(theme.id)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={handleImportTheme} data-testid="button-import-theme">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Theme
                </Button>
                <Button variant="outline" onClick={handleExportTheme} data-testid="button-export-theme">
                  <Download className="mr-2 h-4 w-4" />
                  Export Current
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Theme Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Theme</CardTitle>
              <CardDescription>
                Design your own theme from scratch or modify existing ones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">Theme Creator</h3>
                <p className="text-[13px] text-muted-foreground mb-6 max-w-md mx-auto">
                  Create beautiful, personalized themes with our visual theme editor. 
                  Customize colors, fonts, and more.
                </p>
                <Button onClick={handleCreateTheme} data-testid="button-create-theme">
                  <Brush className="mr-2 h-4 w-4" />
                  Open Theme Creator
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Theme Templates</CardTitle>
              <CardDescription>
                Start with a template and customize it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { name: 'High Contrast', icon: <Eye />, description: 'For better visibility' },
                  { name: 'Colorblind Safe', icon: <Palette />, description: 'Accessible colors' },
                  { name: 'Minimal', icon: <Code />, description: 'Distraction-free coding' }
                ].map((template, index) => (
                  <Button key={index} variant="outline" className="h-auto p-4 justify-start">
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-1">
                        {template.icon}
                        <span className="font-medium">{template.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme Settings</CardTitle>
              <CardDescription>
                Configure how themes work in your environment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* System Theme */}
              <div className="space-y-3">
                <Label>System Theme</Label>
                <RadioGroup value={systemTheme} onValueChange={setSystemTheme} data-testid="radiogroup-system-theme">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" data-testid="radio-light" />
                    <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                      <Sun className="h-4 w-4" />
                      Light
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" data-testid="radio-dark" />
                    <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                      <Moon className="h-4 w-4" />
                      Dark
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="auto" data-testid="radio-auto" />
                    <Label htmlFor="auto" className="flex items-center gap-2 cursor-pointer">
                      <Monitor className="h-4 w-4" />
                      Auto (follow system)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Editor Settings */}
              <div className="space-y-3">
                <h3 className="font-medium">Editor Settings</h3>
                <div className="space-y-2">
                  {customThemeSettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor={setting.id}>{setting.label}</Label>
                      <input
                        id={setting.id}
                        type="text"
                        defaultValue={setting.value}
                        className="w-24 px-2 py-1 text-[13px] rounded border bg-background"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Advanced */}
              <div className="space-y-3">
                <h3 className="font-medium">Advanced</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-[13px]">Sync theme across devices</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-[13px]">Enable theme animations</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-[13px]">Use high contrast mode</span>
                  </label>
                </div>
              </div>

              <Button className="w-full" onClick={handleSaveSettings}>
                Save Settings
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}