import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, Shield, Code, Bell, Eye, CreditCard, 
  Palette, Globe, Key, Github, Twitter, Lock,
  Mail, UserPlus, AlertCircle, Trash2, Download,
  Upload, CheckCircle, Settings2, Database, Zap,
  Moon, Sun, Monitor, Languages, LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ECodeLoading } from '@/components/ECodeLoading';

// Form schemas
const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  github: z.string().max(50, 'GitHub username must be less than 50 characters').optional(),
  twitter: z.string().max(50, 'Twitter handle must be less than 50 characters').optional(),
});

const securityFormSchema = z.object({
  currentPassword: z.string().min(8, 'Password must be at least 8 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const emailFormSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password is required'),
});

export default function UserSettings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState('en');

  // Fetch user settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/user/settings'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/user/settings');
    },
    enabled: !!user
  });

  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: settings?.displayName || '',
      bio: settings?.bio || '',
      website: settings?.website || '',
      location: settings?.location || '',
      github: settings?.github || '',
      twitter: settings?.twitter || '',
    }
  });

  // Security form
  const securityForm = useForm<z.infer<typeof securityFormSchema>>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  });

  // Email form
  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: settings?.email || '',
      password: '',
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileFormSchema>) => {
      const res = await apiRequest('PATCH', '/api/user/profile', data);
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
      });
    }
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof securityFormSchema>) => {
      const res = await apiRequest('POST', '/api/user/change-password', data);
      if (!res.ok) throw new Error('Failed to update password');
      return res.json();
    },
    onSuccess: () => {
      securityForm.reset();
      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully',
      });
    }
  });

  // Update email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailFormSchema>) => {
      const res = await apiRequest('POST', '/api/user/change-email', data);
      if (!res.ok) throw new Error('Failed to update email');
      return res.json();
    },
    onSuccess: () => {
      emailForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      toast({
        title: 'Email updated',
        description: 'Your email has been updated successfully',
      });
    }
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/user/account');
      if (!res.ok) throw new Error('Failed to delete account');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted',
      });
      navigate('/');
    }
  });

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background" data-testid="user-settings-page">
      <header className="border-b">
        <div className="container-responsive py-4 flex items-center justify-between">
          <Link href="/" className="text-responsive-lg font-bold" data-testid="link-home">E-Code</Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/projects" className="text-responsive-xs" data-testid="link-projects">Projects</Link>
            <Link href={`/user/${user.username}`} className="text-responsive-xs" data-testid="link-profile">Profile</Link>
          </div>
        </div>
      </header>

      <div className="container-responsive py-responsive max-w-4xl mb-16 md:mb-0">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-responsive-xl font-bold mb-1 sm:mb-2" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground text-responsive-sm">Manage your account settings and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="settings-tabs">
          {/* Scrollable tabs on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5 gap-1 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="profile" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-profile">Profile</TabsTrigger>
              <TabsTrigger value="account" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-account">Account</TabsTrigger>
              <TabsTrigger value="appearance" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-appearance">Appearance</TabsTrigger>
              <TabsTrigger value="notifications" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-security">Security</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="space-y-6" data-testid="content-profile">
            <Card data-testid="card-public-profile">
              <CardHeader>
                <CardTitle>Public Profile</CardTitle>
                <CardDescription>
                  This information will be displayed on your public profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-6">
                    <div className="flex items-center space-x-4 mb-6">
                      <Avatar className="h-20 w-20" data-testid="avatar-profile">
                        <AvatarImage src={settings?.avatarUrl} />
                        <AvatarFallback>
                          {user.displayName?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Button type="button" variant="outline" size="sm" data-testid="button-change-avatar">
                          <Upload className="h-4 w-4 mr-2" />
                          Change Avatar
                        </Button>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          JPG, PNG or GIF. Max size 2MB
                        </p>
                      </div>
                    </div>

                    <FormField
                      control={profileForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-display-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Tell us about yourself"
                              rows={4}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <FormDescription>
                            Brief description for your profile
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="San Francisco, CA" data-testid="input-location" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://example.com" data-testid="input-website" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="github"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GitHub Username</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-[13px] text-muted-foreground">
                                  <Github className="h-4 w-4" />
                                </span>
                                <Input {...field} className="rounded-l-none" placeholder="username" data-testid="input-github" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="twitter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Twitter Handle</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-[13px] text-muted-foreground">
                                  <Twitter className="h-4 w-4" />
                                </span>
                                <Input {...field} className="rounded-l-none" placeholder="username" data-testid="input-twitter" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6" data-testid="content-account">
            <Card data-testid="card-email-address">
              <CardHeader>
                <CardTitle>Email Address</CardTitle>
                <CardDescription>
                  Update your email address associated with your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit((data) => updateEmailMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Email Address</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={emailForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" data-testid="input-email-password" />
                          </FormControl>
                          <FormDescription>
                            Enter your password to confirm the change
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={updateEmailMutation.isPending} data-testid="button-update-email">
                      {updateEmailMutation.isPending ? 'Updating...' : 'Update Email'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card data-testid="card-export-data">
              <CardHeader>
                <CardTitle>Export Account Data</CardTitle>
                <CardDescription>
                  Download all your data including projects, settings, and activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" data-testid="button-export-data">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive" data-testid="card-delete-account">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Account</CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This action cannot be undone. All your projects, settings, and data will be permanently deleted.
                  </AlertDescription>
                </Alert>
                <Button 
                  variant="destructive" 
                  className="mt-4"
                  onClick={() => setDeleteAccountOpen(true)}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6" data-testid="content-appearance">
            <Card data-testid="card-theme">
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>
                  Choose your preferred color theme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-4 border rounded-lg text-center hover:bg-accent ${theme === 'light' ? 'border-primary bg-accent' : ''}`}
                    data-testid="button-theme-light"
                  >
                    <Sun className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[13px] font-medium">Light</p>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-4 border rounded-lg text-center hover:bg-accent ${theme === 'dark' ? 'border-primary bg-accent' : ''}`}
                    data-testid="button-theme-dark"
                  >
                    <Moon className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[13px] font-medium">Dark</p>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-4 border rounded-lg text-center hover:bg-accent ${theme === 'system' ? 'border-primary bg-accent' : ''}`}
                    data-testid="button-theme-system"
                  >
                    <Monitor className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[13px] font-medium">System</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-language">
              <CardHeader>
                <CardTitle>Language</CardTitle>
                <CardDescription>
                  Choose your preferred language
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en" data-testid="select-lang-en">English</SelectItem>
                    <SelectItem value="es" data-testid="select-lang-es">Español</SelectItem>
                    <SelectItem value="fr" data-testid="select-lang-fr">Français</SelectItem>
                    <SelectItem value="de" data-testid="select-lang-de">Deutsch</SelectItem>
                    <SelectItem value="ja" data-testid="select-lang-ja">日本語</SelectItem>
                    <SelectItem value="zh" data-testid="select-lang-zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card data-testid="card-editor-preferences">
              <CardHeader>
                <CardTitle>Editor Preferences</CardTitle>
                <CardDescription>
                  Customize your coding environment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Font Size</p>
                    <p className="text-[13px] text-muted-foreground">Editor font size in pixels</p>
                  </div>
                  <Select defaultValue="14">
                    <SelectTrigger className="w-24" data-testid="select-font-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12" data-testid="select-font-12">12px</SelectItem>
                      <SelectItem value="14" data-testid="select-font-14">14px</SelectItem>
                      <SelectItem value="16" data-testid="select-font-16">16px</SelectItem>
                      <SelectItem value="18" data-testid="select-font-18">18px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Tab Size</p>
                    <p className="text-[13px] text-muted-foreground">Number of spaces per tab</p>
                  </div>
                  <Select defaultValue="2">
                    <SelectTrigger className="w-24" data-testid="select-tab-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2" data-testid="select-tab-2">2</SelectItem>
                      <SelectItem value="4" data-testid="select-tab-4">4</SelectItem>
                      <SelectItem value="8" data-testid="select-tab-8">8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Word Wrap</p>
                    <p className="text-[13px] text-muted-foreground">Wrap long lines in editor</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-word-wrap" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Minimap</p>
                    <p className="text-[13px] text-muted-foreground">Show code minimap in editor</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-minimap" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6" data-testid="content-notifications">
            <Card data-testid="card-email-notifications">
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Choose what emails you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Project Updates</p>
                    <p className="text-[13px] text-muted-foreground">Get notified when someone stars or forks your projects</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-project-updates" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Collaboration Invites</p>
                    <p className="text-[13px] text-muted-foreground">Receive emails when invited to collaborate</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-collaboration-invites" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Security Alerts</p>
                    <p className="text-[13px] text-muted-foreground">Important security updates and alerts</p>
                  </div>
                  <Switch defaultChecked disabled data-testid="switch-security-alerts" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Newsletter</p>
                    <p className="text-[13px] text-muted-foreground">Product updates and announcements</p>
                  </div>
                  <Switch data-testid="switch-newsletter" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-push-notifications">
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>
                  Configure in-app notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Comments & Mentions</p>
                    <p className="text-[13px] text-muted-foreground">When someone mentions you or comments</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-comments-mentions" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Deploy Status</p>
                    <p className="text-[13px] text-muted-foreground">Updates on deployment status</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-deploy-status" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">System Notifications</p>
                    <p className="text-[13px] text-muted-foreground">Important system updates</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-system-notifications" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6" data-testid="content-security">
            <Card data-testid="card-change-password">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your account password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...securityForm}>
                  <form onSubmit={securityForm.handleSubmit((data) => updatePasswordMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={securityForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" data-testid="input-current-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={securityForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" data-testid="input-new-password" />
                          </FormControl>
                          <FormDescription>
                            At least 8 characters long
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={securityForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" data-testid="input-confirm-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={updatePasswordMutation.isPending} data-testid="button-update-password">
                      {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card data-testid="card-two-factor">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
                  </AlertDescription>
                </Alert>
                <Button variant="outline" data-testid="button-enable-2fa">
                  <Shield className="h-4 w-4 mr-2" />
                  Enable 2FA
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-active-sessions">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>
                  Manage your active login sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="session-current">
                    <div className="flex items-center space-x-3">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Chrome on Windows</p>
                        <p className="text-[13px] text-muted-foreground">
                          Current session · San Francisco, CA
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Current</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="session-other">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Safari on iPhone</p>
                        <p className="text-[13px] text-muted-foreground">
                          Last active 2 hours ago · New York, NY
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" data-testid="button-revoke-session">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button variant="outline" className="w-full" data-testid="button-signout-all">
                  Sign out all other sessions
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Account Dialog */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent data-testid="dialog-delete-account">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete your account? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                All your projects, settings, and data will be permanently deleted. This cannot be recovered.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccountOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteAccountMutation.mutate(undefined)}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}