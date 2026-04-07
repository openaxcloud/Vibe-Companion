import { useState } from 'react';
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

export default function Themes() {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState('dark-pro');
  const [systemTheme, setSystemTheme] = useState('dark');

  const themes = {
    editor: [
      {
        id: 'dark-pro',
        name: 'Dark Pro',
        description: 'Professional dark theme with high contrast',
        preview: { bg: '#1e1e1e', fg: '#d4d4d4', accent: '#007acc' },
        downloads: 124500,
        rating: 4.9,
        author: 'E-Code Team',
        official: true
      },
      {
        id: 'light-minimal',
        name: 'Light Minimal',
        description: 'Clean and minimal light theme',
        preview: { bg: '#ffffff', fg: '#333333', accent: '#0066cc' },
        downloads: 89230,
        rating: 4.7,
        author: 'E-Code Team',
        official: true
      },
      {
        id: 'monokai',
        name: 'Monokai',
        description: 'Classic Monokai color scheme',
        preview: { bg: '#272822', fg: '#f8f8f2', accent: '#66d9ef' },
        downloads: 67890,
        rating: 4.8,
        author: 'Community',
        official: false
      },
      {
        id: 'dracula',
        name: 'Dracula',
        description: 'Dark theme with vibrant colors',
        preview: { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
        downloads: 56789,
        rating: 4.9,
        author: 'Community',
        official: false
      },
      {
        id: 'solarized-dark',
        name: 'Solarized Dark',
        description: 'Precision colors for machines and people',
        preview: { bg: '#002b36', fg: '#839496', accent: '#268bd2' },
        downloads: 45678,
        rating: 4.6,
        author: 'Community',
        official: false
      },
      {
        id: 'nord',
        name: 'Nord',
        description: 'Arctic, north-bluish color palette',
        preview: { bg: '#2e3440', fg: '#d8dee9', accent: '#88c0d0' },
        downloads: 34567,
        rating: 4.7,
        author: 'Community',
        official: false
      }
    ],
    ui: [
      {
        id: 'default',
        name: 'Default',
        description: 'E-Code default UI theme',
        preview: { primary: '#0079f2', bg: '#0e1525', surface: '#1c2333' }
      },
      {
        id: 'midnight',
        name: 'Midnight',
        description: 'Deep dark theme for night owls',
        preview: { primary: '#6366f1', bg: '#0f0f23', surface: '#1a1a2e' }
      },
      {
        id: 'forest',
        name: 'Forest',
        description: 'Nature-inspired green theme',
        preview: { primary: '#10b981', bg: '#064e3b', surface: '#065f46' }
      },
      {
        id: 'sunset',
        name: 'Sunset',
        description: 'Warm orange and purple tones',
        preview: { primary: '#f59e0b', bg: '#451a03', surface: '#78350f' }
      }
    ]
  };

  const customThemeSettings = [
    { id: 'font-size', label: 'Font Size', value: '14px' },
    { id: 'line-height', label: 'Line Height', value: '1.5' },
    { id: 'tab-size', label: 'Tab Size', value: '2' },
    { id: 'word-wrap', label: 'Word Wrap', value: 'on' }
  ];

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    toast({
      title: "Theme applied",
      description: `Successfully switched to ${themes.editor.find(t => t.id === themeId)?.name} theme`
    });
  };

  const handleCreateTheme = () => {
    toast({
      title: "Theme editor opened",
      description: "Customize your theme in the editor panel"
    });
  };

  const handleExportTheme = () => {
    toast({
      title: "Theme exported",
      description: "Your theme settings have been downloaded"
    });
  };

  const handleImportTheme = () => {
    toast({
      title: "Import theme",
      description: "Select a theme file to import"
    });
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Palette className="h-8 w-8 text-primary" />
          Themes
        </h1>
        <p className="text-muted-foreground mt-2">
          Customize your coding environment with beautiful themes
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse">Browse Themes</TabsTrigger>
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="create">Create Theme</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
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
                {themes.editor.map((theme) => (
                  <Card 
                    key={theme.id} 
                    className={`cursor-pointer transition-all ${
                      selectedTheme === theme.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleThemeChange(theme.id)}
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
                          <p className="text-sm text-muted-foreground">
                            by {theme.author}
                          </p>
                        </div>
                        {selectedTheme === theme.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      
                      {/* Theme Preview */}
                      <div 
                        className="rounded-md p-3 mb-3 font-mono text-xs"
                        style={{ 
                          backgroundColor: theme.preview.bg,
                          color: theme.preview.fg 
                        }}
                      >
                        <div style={{ color: theme.preview.accent }}>function</div>
                        <div>  <span style={{ color: theme.preview.accent }}>console</span>.log(<span style={{ color: '#ce9178' }}>"Hello World"</span>);</div>
                        <div>{'}'}</div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {theme.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm">
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
                        <Button size="sm" variant="outline">
                          Preview
                        </Button>
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
                {themes.ui.map((theme) => (
                  <Card key={theme.id} className="cursor-pointer">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{theme.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
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
                      
                      <Button size="sm" className="w-full">
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
                {themes.editor.filter(t => ['dark-pro', 'light-minimal'].includes(t.id)).map((theme) => (
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
                        <p className="text-sm text-muted-foreground">
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
                <Button variant="outline" onClick={handleImportTheme}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Theme
                </Button>
                <Button variant="outline" onClick={handleExportTheme}>
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
                <h3 className="text-lg font-semibold mb-2">Theme Creator</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Create beautiful, personalized themes with our visual theme editor. 
                  Customize colors, fonts, and more.
                </p>
                <Button onClick={handleCreateTheme}>
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
                      <p className="text-xs text-muted-foreground">
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
                <RadioGroup value={systemTheme} onValueChange={setSystemTheme}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                      <Sun className="h-4 w-4" />
                      Light
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                      <Moon className="h-4 w-4" />
                      Dark
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="auto" />
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
                        className="w-24 px-2 py-1 text-sm rounded border bg-background"
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
                    <span className="text-sm">Sync theme across devices</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-sm">Enable theme animations</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Use high contrast mode</span>
                  </label>
                </div>
              </div>

              <Button className="w-full">
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