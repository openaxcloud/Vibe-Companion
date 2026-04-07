import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  User,
  Bell,
  Shield,
  Key,
  Palette,
  Code,
  Globe,
  CreditCard,
  Crown,
  Database,
  Download,
  Trash2,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Github,
  Link,
  Upload,
} from 'lucide-react';
import { TOUR_STORAGE_KEY } from '@/components/ide/IDEGuidedTour';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('account');

  // Form states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [theme, setTheme] = useState('system');
  const [editorTheme, setEditorTheme] = useState('dark');
  const [fontSize, setFontSize] = useState('14');
  const [tabSize, setTabSize] = useState('2');
  const [wordWrap, setWordWrap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    mentions: true,
    updates: false,
    marketing: false,
  });

  const handleSaveProfile = () => {
    toast({
      title: 'Profile updated',
      description: 'Your profile has been successfully updated.',
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: 'Account deletion',
      description: 'This feature is not available in demo mode.',
      variant: 'destructive',
    });
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {[
              { id: 'account', label: 'Account', icon: User },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'appearance', label: 'Appearance', icon: Palette },
              { id: 'editor', label: 'Editor', icon: Code },
              { id: 'privacy', label: 'Privacy & Security', icon: Shield },
              { id: 'billing', label: 'Billing', icon: CreditCard },
              { id: 'integrations', label: 'Integrations', icon: Link },
              { id: 'data', label: 'Data & Export', icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>

          <div className={TABLET_GRID_CLASSES.settingsContentTabletOptimized}>
            {activeTab === 'account' && (
              <Card className={cardClassName} data-testid="card-account-settings">
                <CardHeader>
                  <CardTitle className="text-foreground">Account Settings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Update your account information and profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 ring-2 ring-border">
                      <AvatarImage src={user?.avatarUrl || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {(user?.displayName || user?.username || 'U')?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button 
                        size="sm" 
                        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                        data-testid="button-upload-avatar"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Avatar
                      </Button>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        JPG, PNG or GIF. Max 2MB.
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground">Username</Label>
                      <Input 
                        value={user?.username || ''} 
                        disabled 
                        className={`${inputClassName} opacity-60`}
                        data-testid="input-username"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Username cannot be changed
                      </p>
                    </div>

                    <div>
                      <Label className="text-foreground">Display Name</Label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                        className={inputClassName}
                        data-testid="input-display-name"
                      />
                    </div>

                    <div>
                      <Label className="text-foreground">Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className={inputClassName}
                        data-testid="input-settings-email"
                      />
                    </div>

                    <div>
                      <Label className="text-foreground">Bio</Label>
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={4}
                        className={`${inputClassName} min-h-[88px]`}
                        data-testid="textarea-settings-bio"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveProfile} 
                    className="min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-save-profile"
                  >
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className={cardClassName} data-testid="card-notifications-settings">
                <CardHeader>
                  <CardTitle className="text-foreground">Notification Preferences</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Choose how you want to be notified
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Email Notifications</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        checked={notifications.email}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, email: checked })
                        }
                        className={switchClassName}
                        data-testid="switch-email-notifications"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Push Notifications</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Receive push notifications in your browser
                        </p>
                      </div>
                      <Switch
                        checked={notifications.push}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, push: checked })
                        }
                        className={switchClassName}
                        data-testid="switch-push-notifications"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Mentions</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Get notified when someone mentions you
                        </p>
                      </div>
                      <Switch
                        checked={notifications.mentions}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, mentions: checked })
                        }
                        className={switchClassName}
                        data-testid="switch-mentions"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Product Updates</Label>
                        <p className="text-[13px] text-muted-foreground">
                          News about new features and improvements
                        </p>
                      </div>
                      <Switch
                        checked={notifications.updates}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, updates: checked })
                        }
                        className={switchClassName}
                        data-testid="switch-updates"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Marketing Emails</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Promotional content and special offers
                        </p>
                      </div>
                      <Switch
                        checked={notifications.marketing}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, marketing: checked })
                        }
                        className={switchClassName}
                        data-testid="switch-marketing"
                      />
                    </div>
                  </div>

                  <Button 
                    className="min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-save-preferences"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'appearance' && (<>
              <Card className={cardClassName} data-testid="card-appearance-settings">
                <CardHeader>
                  <CardTitle className="text-foreground">Appearance</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Customize how E-Code looks for you
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground">Theme</Label>
                      <Select value={pendingTheme} onValueChange={(v) => setPendingTheme(v as 'light' | 'dark' | 'system')}>
                        <SelectTrigger 
                          className={inputClassName}
                          data-testid="select-theme"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card">
                          <SelectItem value="light" data-testid="select-theme-light">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              Light
                            </div>
                          </SelectItem>
                          <SelectItem value="dark" data-testid="select-theme-dark">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Dark
                            </div>
                          </SelectItem>
                          <SelectItem value="system" data-testid="select-theme-system">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-foreground">Primary Color</Label>
                      <div className="grid grid-cols-6 gap-2 mt-2">
                        {[
                          { name: 'orange', color: 'bg-primary' },
                          { name: 'blue', color: 'bg-blue-500' },
                          { name: 'green', color: 'bg-green-500' },
                          { name: 'purple', color: 'bg-purple-500' },
                          { name: 'red', color: 'bg-red-500' },
                          { name: 'pink', color: 'bg-pink-500' },
                        ].map((colorOption) => (
                          <button
                            key={colorOption.name}
                            className={`h-8 w-full rounded-lg ${colorOption.color} hover:ring-2 ring-offset-2 ring-foreground transition-all duration-200`}
                            data-testid={`button-color-${colorOption.name}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-apply-theme"
                    onClick={() => {
                      setGlobalTheme(pendingTheme);
                      toast({
                        title: 'Theme Applied',
                        description: `Theme changed to ${pendingTheme}`,
                      });
                    }}
                  >
                    Apply Theme
                  </Button>
                </CardContent>
              </Card>

              <Card className={cardClassName} data-testid="card-guided-tour">
                <CardHeader>
                  <CardTitle className="text-foreground">Guided Tour</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Replay the IDE guided tour to rediscover all workspace features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="gap-2 border-border bg-card text-foreground hover:bg-muted hover:border-primary/30 transition-all duration-200"
                    onClick={() => {
                      localStorage.removeItem(TOUR_STORAGE_KEY);
                      toast({
                        title: 'Tour reset',
                        description: 'Open any project in the IDE to replay the guided tour now.',
                      });
                      navigate('/dashboard');
                    }}
                    data-testid="button-replay-tour"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Replay IDE Tour
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Resets the tour and navigates you to your projects. Open any project to start the tour.
                  </p>
                </CardContent>
              </Card>
            </>)}

            {activeTab === 'editor' && (
              <Card className={cardClassName} data-testid="card-editor-settings">
                <CardHeader>
                  <CardTitle className="text-foreground">Editor Preferences</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure your code editor settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground">Editor Theme</Label>
                      <Select value={editorTheme} onValueChange={setEditorTheme}>
                        <SelectTrigger 
                          className={inputClassName}
                          data-testid="select-editor-theme"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card">
                          <SelectItem value="dark" data-testid="select-editor-dark">Dark</SelectItem>
                          <SelectItem value="light" data-testid="select-editor-light">Light</SelectItem>
                          <SelectItem value="monokai" data-testid="select-editor-monokai">Monokai</SelectItem>
                          <SelectItem value="solarized" data-testid="select-editor-solarized">Solarized</SelectItem>
                          <SelectItem value="dracula" data-testid="select-editor-dracula">Dracula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-foreground">Font Size</Label>
                      <Select value={fontSize} onValueChange={setFontSize}>
                        <SelectTrigger 
                          className={inputClassName}
                          data-testid="select-font-size"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card">
                          <SelectItem value="12" data-testid="select-font-12">12px</SelectItem>
                          <SelectItem value="14" data-testid="select-font-14">14px</SelectItem>
                          <SelectItem value="16" data-testid="select-font-16">16px</SelectItem>
                          <SelectItem value="18" data-testid="select-font-18">18px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-foreground">Tab Size</Label>
                      <Select value={tabSize} onValueChange={setTabSize}>
                        <SelectTrigger 
                          className={inputClassName}
                          data-testid="select-tab-size"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card">
                          <SelectItem value="2" data-testid="select-tab-2">2 spaces</SelectItem>
                          <SelectItem value="4" data-testid="select-tab-4">4 spaces</SelectItem>
                          <SelectItem value="8" data-testid="select-tab-8">8 spaces</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Word Wrap</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Wrap long lines of code
                        </p>
                      </div>
                      <Switch 
                        checked={wordWrap} 
                        onCheckedChange={setWordWrap} 
                        className={switchClassName}
                        data-testid="switch-word-wrap"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Minimap</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Show code minimap
                        </p>
                      </div>
                      <Switch 
                        checked={minimap} 
                        onCheckedChange={setMinimap} 
                        className={switchClassName}
                        data-testid="switch-minimap"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Auto Save</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Automatically save changes
                        </p>
                      </div>
                      <Switch 
                        checked={autoSave} 
                        onCheckedChange={setAutoSave} 
                        className={switchClassName}
                        data-testid="switch-auto-save"
                      />
                    </div>
                  </div>

                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-save-editor-settings"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Editor Settings'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <Card className={cardClassName} data-testid="card-privacy-settings">
                  <CardHeader>
                    <CardTitle className="text-foreground">Privacy Settings</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Control your privacy and data sharing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Public Profile</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Make your profile visible to others
                        </p>
                      </div>
                      <Switch 
                        defaultChecked 
                        className={switchClassName}
                        data-testid="switch-public-profile"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Show Activity</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Display your coding activity on your profile
                        </p>
                      </div>
                      <Switch 
                        defaultChecked 
                        className={switchClassName}
                        data-testid="switch-show-activity"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <Label className="text-foreground">Analytics</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Help improve E-Code with anonymous usage data
                        </p>
                      </div>
                      <Switch 
                        defaultChecked 
                        className={switchClassName}
                        data-testid="switch-analytics"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-security-settings">
                  <CardHeader>
                    <CardTitle className="text-foreground">Security</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Secure your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-foreground">Password</Label>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          disabled 
                          className={`${inputClassName} opacity-60 flex-1`}
                          data-testid="input-password"
                        />
                        <Button 
                          variant="outline" 
                          className="border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                          data-testid="button-change-password"
                        >
                          Change
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-foreground">Two-Factor Authentication</Label>
                      <p className="text-[13px] text-muted-foreground mb-2">
                        Add an extra layer of security to your account
                      </p>
                      <Button 
                        variant="outline" 
                        className="gap-2 border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                        data-testid="button-enable-2fa"
                      >
                        <Shield className="h-4 w-4" />
                        Enable 2FA
                      </Button>
                    </div>

                    <div>
                      <Label className="text-foreground">Sessions</Label>
                      <p className="text-[13px] text-muted-foreground mb-2">
                        Manage your active sessions
                      </p>
                      <Button 
                        variant="outline"
                        className="border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                        data-testid="button-view-sessions"
                      >
                        View Sessions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <Card className={cardClassName} data-testid="card-billing-plan">
                  <CardHeader>
                    <CardTitle className="text-foreground">Current Plan</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      You're currently on the Free plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 border border-border rounded-lg bg-muted">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-foreground">Free Plan</h3>
                          <Badge 
                            variant="secondary" 
                            className="bg-primary/10 text-primary border-0"
                          >
                            Current
                          </Badge>
                        </div>
                        <ul className="space-y-2 text-[13px]">
                          <li className="flex items-center gap-2 text-foreground">
                            <Check className="h-4 w-4 text-green-500" />
                            Unlimited public repls
                          </li>
                          <li className="flex items-center gap-2 text-foreground">
                            <Check className="h-4 w-4 text-green-500" />
                            500MB storage
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <X className="h-4 w-4 text-red-500" />
                            Private repls
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <X className="h-4 w-4 text-red-500" />
                            Always-on repls
                          </li>
                        </ul>
                      </div>

                      <Button 
                        className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                        data-testid="button-upgrade-pro"
                      >
                        <Crown className="h-4 w-4" />
                        Upgrade to Pro
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-payment-methods">
                  <CardHeader>
                    <CardTitle className="text-foreground">Payment Methods</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Manage your payment methods
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[13px] text-muted-foreground">
                      No payment methods on file
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                      data-testid="button-add-payment"
                    >
                      Add Payment Method
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}