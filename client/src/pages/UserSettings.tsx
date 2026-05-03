import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, fetchCsrfToken } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, Shield, Bell, Key, Lock, Mail, AlertCircle, Trash2,
  Download, Upload, Monitor, Moon, Sun, LogOut, Plus, X,
  Globe, MapPin, Copy, Check, Github
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'wouter';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ECodeLoading } from '@/components/ECodeLoading';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  bio:      z.string().max(500, 'Bio must be less than 500 characters').optional().or(z.literal('')),
  website:  z.string().url('Must be a valid URL').optional().or(z.literal('')),
  location: z.string().max(100).optional().or(z.literal('')),
  github:   z.string().max(50).optional().or(z.literal('')),
  twitter:  z.string().max(50).optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const emailSchema = z.object({
  email:    z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required to confirm the change'),
});

const usernameSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens'),
});

// ---------------------------------------------------------------------------
// Notification-preferences schema (maps to real DB columns)
// Fields: agent | billing | deployment | security | team | system |
//         projectUpdates | commentsMentions | newsletter
// ---------------------------------------------------------------------------
type NotifPrefs = {
  agent: boolean;
  billing: boolean;
  deployment: boolean;
  security: boolean;
  team: boolean;
  system: boolean;
  projectUpdates: boolean;
  commentsMentions: boolean;
  newsletter: boolean;
};

const defaultNotifPrefs: NotifPrefs = {
  agent: true, billing: true, deployment: true,
  security: true, team: true, system: true,
  projectUpdates: true, commentsMentions: true, newsletter: false,
};

// ---------------------------------------------------------------------------
// Clipboard copy hook
// ---------------------------------------------------------------------------
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

// ---------------------------------------------------------------------------
// Helper: notification toggle row
// ---------------------------------------------------------------------------
function NotifRow({
  label, description, field, prefs, onChange, testId,
}: {
  label: string; description?: string;
  field: keyof NotifPrefs; prefs: NotifPrefs;
  onChange: (k: keyof NotifPrefs, v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch
        checked={prefs[field]}
        onCheckedChange={v => onChange(field, v)}
        data-testid={testId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function UserSettings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const { theme, setTheme } = useTheme();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 2FA flow state
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle');
  const [twoFASetupData, setTwoFASetupData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [twoFAError, setTwoFAError] = useState('');

  // SSH key add
  const [sshAddOpen, setSshAddOpen] = useState(false);
  const [sshLabel, setSshLabel] = useState('');
  const [sshKey, setSshKey] = useState('');

  // API token create
  const [newTokenSecret, setNewTokenSecret] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const [tokenName, setTokenName] = useState('');

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Notification prefs local state (synced from server)
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(defaultNotifPrefs);

  // ---------------------------------------------------------------------------
  // Data queries
  // ---------------------------------------------------------------------------
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/user/settings'],
    queryFn: () => apiRequest<any>('GET', '/api/user/settings'),
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ['/api/user/preferences'],
    queryFn: () => apiRequest<any>('GET', '/api/user/preferences'),
    enabled: !!user,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['/api/user/sessions'],
    queryFn: () => apiRequest<any[]>('GET', '/api/user/sessions'),
    enabled: !!user && activeTab === 'security',
  });

  const { data: sshKeys = [], refetch: refetchSshKeys } = useQuery({
    queryKey: ['/api/user/ssh-keys'],
    queryFn: () => apiRequest<any[]>('GET', '/api/user/ssh-keys'),
    enabled: !!user && activeTab === 'security',
  });

  const { data: apiTokens = [], refetch: refetchTokens } = useQuery({
    queryKey: ['/api/user/api-tokens'],
    queryFn: () => apiRequest<any[]>('GET', '/api/user/api-tokens'),
    enabled: !!user && activeTab === 'security',
  });

  const { data: connectedServices } = useQuery({
    queryKey: ['/api/user/connected-services'],
    queryFn: () => apiRequest<any>('GET', '/api/user/connected-services'),
    enabled: !!user && activeTab === 'account',
  });

  const { data: twoFAStatus } = useQuery({
    queryKey: ['/api/user/2fa-status'],
    queryFn: () => apiRequest<{ enabled: boolean }>('GET', '/api/user/2fa-status'),
    enabled: !!user && activeTab === 'security',
  });

  // Sync notification prefs from settings
  useEffect(() => {
    if (settings?.notificationPreferences) {
      const np = settings.notificationPreferences;
      setNotifPrefs({
        agent:            np.agent            ?? true,
        billing:          np.billing          ?? true,
        deployment:       np.deployment       ?? true,
        security:         np.security         ?? true,
        team:             np.team             ?? true,
        system:           np.system           ?? true,
        projectUpdates:   np.projectUpdates   ?? true,
        commentsMentions: np.commentsMentions ?? true,
        newsletter:       np.newsletter       ?? false,
      });
    }
  }, [settings?.notificationPreferences]);

  // ---------------------------------------------------------------------------
  // Forms
  // ---------------------------------------------------------------------------
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', bio: '', website: '', location: '', github: '', twitter: '' },
  });

  useEffect(() => {
    if (settings) {
      profileForm.reset({
        displayName: settings.displayName || '',
        bio:      settings.bio       || '',
        website:  settings.website   || '',
        location: settings.location  || '',
        github:   settings.githubUsername || '',
        twitter:  settings.twitterUsername || '',
      });
      if (settings.avatarUrl) setAvatarPreview(settings.avatarUrl);
    }
  }, [settings]);

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (settings?.email) emailForm.setValue('email', settings.email);
  }, [settings?.email]);

  const usernameForm = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: '' },
  });

  useEffect(() => {
    if (settings?.username) usernameForm.setValue('username', settings.username);
  }, [settings?.username]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const updateProfileMut = useMutation({
    mutationFn: (data: z.infer<typeof profileSchema>) =>
      apiRequest('PUT', '/api/user/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: 'Profile updated' });
    },
    onError: (err: any) => toast({ title: 'Failed to update profile', description: err.message, variant: 'destructive' }),
  });

  const updatePasswordMut = useMutation({
    mutationFn: (d: z.infer<typeof passwordSchema>) =>
      apiRequest('PUT', '/api/user/password', { currentPassword: d.currentPassword, newPassword: d.newPassword }),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: 'Password updated', description: 'You have been kept signed in.' });
    },
    onError: (err: any) => toast({ title: 'Failed to update password', description: err.message, variant: 'destructive' }),
  });

  const updateEmailMut = useMutation({
    mutationFn: (d: z.infer<typeof emailSchema>) =>
      apiRequest('PUT', '/api/user/email', d),
    onSuccess: (res: any) => {
      emailForm.setValue('password', '');
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: 'Email updated', description: res?.message });
    },
    onError: (err: any) => toast({ title: 'Failed to update email', description: err.message, variant: 'destructive' }),
  });

  const resendVerificationMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/user/resend-verification'),
    onSuccess: (res: any) => toast({ title: 'Verification email sent', description: res?.message }),
    onError: (err: any) => toast({ title: 'Failed to send', description: err.message, variant: 'destructive' }),
  });

  const updateUsernameMut = useMutation({
    mutationFn: (d: z.infer<typeof usernameSchema>) =>
      apiRequest('PUT', '/api/user/username', d),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: 'Username updated', description: `Now @${res?.username}` });
    },
    onError: (err: any) => toast({ title: 'Failed to change username', description: err.message, variant: 'destructive' }),
  });

  const deleteAccountMut = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/user/account', { confirmation: 'DELETE MY ACCOUNT' }),
    onSuccess: () => { queryClient.clear(); navigate('/'); },
    onError: (err: any) => toast({ title: 'Failed to delete account', description: err.message, variant: 'destructive' }),
  });

  const updatePrefsMut = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest('PUT', '/api/user/preferences', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] }),
  });

  const updateNotifMut = useMutation({
    mutationFn: (data: Partial<NotifPrefs>) =>
      apiRequest('PUT', '/api/user/notification-preferences', data),
    onError: () => toast({ title: 'Failed to save notification preferences', variant: 'destructive' }),
  });

  const revokeSessionMut = useMutation({
    mutationFn: (sid: string) => apiRequest('DELETE', `/api/user/sessions/${sid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/sessions'] });
      toast({ title: 'Session revoked' });
    },
    onError: (err: any) => toast({ title: 'Failed to revoke session', description: err.message, variant: 'destructive' }),
  });

  const revokeOthersMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/user/sessions/revoke-others'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/sessions'] });
      toast({ title: 'All other sessions revoked' });
    },
  });

  const addSshKeyMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/user/ssh-keys', { label: sshLabel, publicKey: sshKey }),
    onSuccess: () => {
      setSshAddOpen(false); setSshLabel(''); setSshKey('');
      refetchSshKeys();
      toast({ title: 'SSH key added' });
    },
    onError: (err: any) => toast({ title: 'Failed to add SSH key', description: err.message, variant: 'destructive' }),
  });

  const deleteSshKeyMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/user/ssh-keys/${id}`),
    onSuccess: () => { refetchSshKeys(); toast({ title: 'SSH key removed' }); },
  });

  const createTokenMut = useMutation({
    mutationFn: () => apiRequest<any>('POST', '/api/user/api-tokens', { name: tokenName }),
    onSuccess: (res: any) => {
      setNewTokenSecret(res?.token ?? null);
      setTokenName('');
      refetchTokens();
    },
    onError: (err: any) => toast({ title: 'Failed to create token', description: err.message, variant: 'destructive' }),
  });

  const revokeTokenMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/user/api-tokens/${id}`),
    onSuccess: () => { refetchTokens(); toast({ title: 'Token revoked' }); },
  });

  const disconnectServiceMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/user/connected-services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connected-services'] });
      toast({ title: 'Service disconnected' });
    },
    onError: (err: any) => toast({ title: 'Failed to disconnect', description: err.message, variant: 'destructive' }),
  });

  // 2FA mutations — use /api/user/2fa/* for consistent namespace
  const setup2FAMut = useMutation({
    mutationFn: () => apiRequest<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>('POST', '/api/user/2fa/setup'),
    onSuccess: (data) => {
      setTwoFASetupData(data);
      setTwoFAStep('setup');
      setTwoFAError('');
    },
    onError: (err: any) => toast({ title: 'Failed to start 2FA setup', description: err.message, variant: 'destructive' }),
  });

  const confirm2FAMut = useMutation({
    mutationFn: (token: string) => apiRequest('POST', '/api/user/2fa/confirm', { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/2fa-status'] });
      setTwoFAStep('idle');
      setTwoFAToken('');
      setTwoFASetupData(null);
      setTwoFAError('');
      toast({ title: '2FA enabled', description: 'Your account is now protected by an authenticator app.' });
    },
    onError: (err: any) => setTwoFAError(err.message || 'Invalid code — please try again.'),
  });

  const disable2FAMut = useMutation({
    mutationFn: (password: string) => apiRequest('POST', '/api/user/2fa/disable', { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/2fa-status'] });
      setTwoFAStep('idle');
      setTwoFAPassword('');
      setTwoFAError('');
      toast({ title: '2FA disabled', description: 'Two-factor authentication has been turned off.' });
    },
    onError: (err: any) => setTwoFAError(err.message || 'Incorrect password.'),
  });

  // ---------------------------------------------------------------------------
  // Avatar upload
  // ---------------------------------------------------------------------------
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Avatar must be under 2 MB.', variant: 'destructive' });
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message);
      }
      const data = await res.json();
      setAvatarPreview(data.avatarUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: 'Avatar updated' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Notification toggle helper
  // ---------------------------------------------------------------------------
  const handleNotifToggle = (key: keyof NotifPrefs, value: boolean) => {
    const next: NotifPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    updateNotifMut.mutate(next);
  };

  // ---------------------------------------------------------------------------
  // Editor preference helpers (from user preferences JSON)
  // ---------------------------------------------------------------------------
  const fontSize   = prefs?.fontSize        ?? 14;
  const tabSize    = prefs?.indentationSize  ?? 2;
  const wordWrap   = prefs?.wordWrap         ?? false;
  const minimap    = prefs?.minimap          ?? true;
  const language   = prefs?.language        ?? 'en';

  if (!user) { navigate('/'); return null; }
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ECodeLoading />
      </div>
    );
  }

  const displayInitials = (settings?.displayName || user.username || 'U').slice(0, 2).toUpperCase();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background" data-testid="user-settings-page">
      {/* Header */}
      <header className="border-b">
        <div className="container-responsive py-4 flex items-center justify-between">
          <Link href="/" className="text-responsive-lg font-bold" data-testid="link-home">E-Code</Link>
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-projects">Projects</Link>
            <Link href={`/user/${user.username}`} className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-profile">Profile</Link>
          </div>
        </div>
      </header>

      <div className="container-responsive py-responsive max-w-4xl mb-16 md:mb-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account settings and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="settings-tabs">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5 gap-1 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="profile"       className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-profile">Profile</TabsTrigger>
              <TabsTrigger value="account"       className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-account">Account</TabsTrigger>
              <TabsTrigger value="appearance"    className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-appearance">Appearance</TabsTrigger>
              <TabsTrigger value="notifications" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security"      className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-security">Security</TabsTrigger>
            </TabsList>
          </div>

          {/* ============================================================== */}
          {/* PROFILE TAB                                                      */}
          {/* ============================================================== */}
          <TabsContent value="profile" className="space-y-6 mt-4" data-testid="content-profile">
            <Card data-testid="card-public-profile">
              <CardHeader>
                <CardTitle>Public Profile</CardTitle>
                <CardDescription>This information is displayed on your public profile page.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(d => updateProfileMut.mutate(d))} className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-20 w-20" data-testid="avatar-profile">
                        <AvatarImage src={avatarPreview || settings?.avatarUrl} />
                        <AvatarFallback>{displayInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={handleAvatarChange}
                          data-testid="input-avatar-file"
                        />
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => avatarInputRef.current?.click()}
                          data-testid="button-change-avatar">
                          <Upload className="h-4 w-4 mr-2" />
                          Change Avatar
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF or WEBP. Max 2 MB.</p>
                      </div>
                    </div>

                    <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-display-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={profileForm.control} name="bio" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Tell us about yourself" rows={3} data-testid="input-bio" />
                        </FormControl>
                        <FormDescription>Brief description for your profile (max 500 characters)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="location" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                              </span>
                              <Input {...field} className="rounded-l-none" placeholder="San Francisco, CA" data-testid="input-location" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={profileForm.control} name="website" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                              </span>
                              <Input {...field} className="rounded-l-none" placeholder="https://example.com" data-testid="input-website" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="github" render={({ field }) => (
                        <FormItem>
                          <FormLabel>GitHub Username</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-xs text-muted-foreground">gh</span>
                              <Input {...field} className="rounded-l-none" placeholder="username" data-testid="input-github" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={profileForm.control} name="twitter" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter / X Handle</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-xs text-muted-foreground">@</span>
                              <Input {...field} className="rounded-l-none" placeholder="handle" data-testid="input-twitter" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateProfileMut.isPending} data-testid="button-save-profile">
                        {updateProfileMut.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* ACCOUNT TAB                                                       */}
          {/* ============================================================== */}
          <TabsContent value="account" className="space-y-6 mt-4" data-testid="content-account">
            {/* Email */}
            <Card data-testid="card-email-address">
              <CardHeader>
                <CardTitle>Email Address</CardTitle>
                <CardDescription>Update your login email. Your current password is required to confirm the change.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings?.emailVerified === false && (
                  <Alert className="mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                      <span>Your email address is not verified.</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resendVerificationMut.mutate()}
                        disabled={resendVerificationMut.isPending}
                        data-testid="button-resend-verification"
                      >
                        {resendVerificationMut.isPending ? 'Sending…' : 'Resend verification email'}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(d => updateEmailMut.mutate(d))} className="space-y-4">
                    <FormField control={emailForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Email Address</FormLabel>
                        <FormControl><Input {...field} type="email" autoComplete="email" data-testid="input-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={emailForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl><Input {...field} type="password" autoComplete="current-password" data-testid="input-email-password" /></FormControl>
                        <FormDescription>Enter your password to confirm this change</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={updateEmailMut.isPending} data-testid="button-update-email">
                      {updateEmailMut.isPending ? 'Updating…' : 'Update Email'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Username */}
            <Card data-testid="card-username">
              <CardHeader>
                <CardTitle>Username</CardTitle>
                <CardDescription>
                  {settings?.usernameChangedAt
                    ? 'Your username has already been changed. This can only be done once.'
                    : 'Your username can only be changed once.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...usernameForm}>
                  <form onSubmit={usernameForm.handleSubmit(d => updateUsernameMut.mutate(d))} className="space-y-4">
                    <FormField control={usernameForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-xs text-muted-foreground">@</span>
                            <Input {...field} className="rounded-l-none" autoComplete="username" data-testid="input-username" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button
                      type="submit"
                      disabled={updateUsernameMut.isPending || !!settings?.usernameChangedAt}
                      data-testid="button-change-username"
                    >
                      {updateUsernameMut.isPending ? 'Saving…' : 'Change Username'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Connected services */}
            <Card data-testid="card-connected-services">
              <CardHeader>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>OAuth accounts linked to your E-Code identity. Connect accounts to enable single sign-on and integrations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(connectedServices?.identityProviders || []).map((svc: any) => (
                  <div key={svc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`service-${svc.id}`}>
                    <div className="flex items-center gap-3">
                      <Github className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{svc.name}</p>
                        {svc.username
                          ? <p className="text-xs text-muted-foreground">@{svc.username}</p>
                          : <p className="text-xs text-muted-foreground">{svc.connected ? 'Linked' : 'Not linked'}</p>
                        }
                      </div>
                    </div>
                    {svc.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectServiceMut.mutate(svc.id)}
                        disabled={disconnectServiceMut.isPending}
                        data-testid={`button-disconnect-${svc.id}`}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { window.location.href = `/auth/${svc.id}`; }}
                        data-testid={`button-connect-${svc.id}`}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
                {!connectedServices && (
                  <p className="text-sm text-muted-foreground">Loading connected services…</p>
                )}
                {connectedServices && (connectedServices.identityProviders || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No identity providers configured.</p>
                )}
              </CardContent>
            </Card>

            {/* Data export */}
            <Card data-testid="card-export-data">
              <CardHeader>
                <CardTitle>Export Account Data</CardTitle>
                <CardDescription>Download all your data including projects and settings as a JSON file.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild data-testid="button-export-data">
                  <a href="/api/user/export" download>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Delete account */}
            <Card className="border-destructive" data-testid="card-delete-account">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Account</CardTitle>
                <CardDescription>Permanently delete your account and all associated data. This cannot be undone.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    All your projects, settings, and data will be permanently and irreversibly deleted.
                  </AlertDescription>
                </Alert>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete-account">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* APPEARANCE TAB                                                    */}
          {/* ============================================================== */}
          <TabsContent value="appearance" className="space-y-6 mt-4" data-testid="content-appearance">
            <Card data-testid="card-theme">
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose your preferred colour theme. The selection is saved to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTheme(t); updatePrefsMut.mutate({ theme: t }); }}
                      className={`p-4 border rounded-lg text-center hover:bg-accent transition-colors ${theme === t ? 'border-primary bg-accent' : ''}`}
                      data-testid={`button-theme-${t}`}
                    >
                      {t === 'light'  && <Sun     className="h-8 w-8 mx-auto mb-2" />}
                      {t === 'dark'   && <Moon    className="h-8 w-8 mx-auto mb-2" />}
                      {t === 'system' && <Monitor className="h-8 w-8 mx-auto mb-2" />}
                      <p className="text-sm font-medium capitalize">{t}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-language">
              <CardHeader>
                <CardTitle>Language</CardTitle>
                <CardDescription>Choose the language used throughout the Replit interface.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Interface Language</p>
                    <p className="text-xs text-muted-foreground">Affects menus, tooltips, and UI labels</p>
                  </div>
                  <Select
                    value={language}
                    onValueChange={v => updatePrefsMut.mutate({ language: v })}
                  >
                    <SelectTrigger className="w-44" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'en',    label: 'English' },
                        { value: 'es',    label: 'Español' },
                        { value: 'fr',    label: 'Français' },
                        { value: 'de',    label: 'Deutsch' },
                        { value: 'pt',    label: 'Português' },
                        { value: 'zh-cn', label: '中文 (简体)' },
                        { value: 'zh-tw', label: '中文 (繁體)' },
                        { value: 'ja',    label: '日本語' },
                        { value: 'ko',    label: '한국어' },
                        { value: 'ar',    label: 'العربية' },
                      ].map(l => (
                        <SelectItem key={l.value} value={l.value} data-testid={`option-lang-${l.value}`}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-editor-preferences">
              <CardHeader>
                <CardTitle>Editor Preferences</CardTitle>
                <CardDescription>Customise your coding environment. Changes are saved and applied immediately.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Font size */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Font Size</p>
                    <p className="text-xs text-muted-foreground">Editor font size in pixels</p>
                  </div>
                  <Select
                    value={String(fontSize)}
                    onValueChange={v => updatePrefsMut.mutate({ fontSize: parseInt(v) })}
                  >
                    <SelectTrigger className="w-24" data-testid="select-font-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map(s => (
                        <SelectItem key={s} value={String(s)} data-testid={`option-font-${s}`}>{s}px</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Tab size */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Tab Size</p>
                    <p className="text-xs text-muted-foreground">Number of spaces per tab</p>
                  </div>
                  <Select
                    value={String(tabSize)}
                    onValueChange={v => updatePrefsMut.mutate({ indentationSize: parseInt(v), tabSize: parseInt(v) })}
                  >
                    <SelectTrigger className="w-24" data-testid="select-tab-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 8].map(s => (
                        <SelectItem key={s} value={String(s)} data-testid={`option-tab-${s}`}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Word wrap */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Word Wrap</p>
                    <p className="text-xs text-muted-foreground">Wrap long lines in the editor</p>
                  </div>
                  <Switch
                    checked={wordWrap}
                    onCheckedChange={v => updatePrefsMut.mutate({ wordWrap: v })}
                    data-testid="switch-word-wrap"
                  />
                </div>

                <Separator />

                {/* Minimap */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Code Minimap</p>
                    <p className="text-xs text-muted-foreground">Show the code minimap panel in the editor</p>
                  </div>
                  <Switch
                    checked={minimap}
                    onCheckedChange={v => updatePrefsMut.mutate({ minimap: v })}
                    data-testid="switch-minimap"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* NOTIFICATIONS TAB                                                 */}
          {/* ============================================================== */}
          <TabsContent value="notifications" className="space-y-6 mt-4" data-testid="content-notifications">
            <Card data-testid="card-email-notifications">
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Choose which emails you want to receive. Security alerts are always on.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <NotifRow label="Project Updates" description="Changes, comments, and activity in your projects"
                  field="projectUpdates" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-project-updates" />
                <NotifRow label="Deploy Status" description="Deployment success or failure notifications"
                  field="deployment" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-deployment" />
                <NotifRow label="Collaboration Invites" description="Team invites, membership changes, and shared project access"
                  field="team" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-team" />
                <NotifRow label="Comments & Mentions" description="When someone mentions you or comments on your work"
                  field="commentsMentions" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-comments-mentions" />
                <NotifRow label="Billing Alerts" description="Payment receipts, credit alerts, and subscription changes"
                  field="billing" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-billing" />
                <NotifRow label="Newsletter" description="Replit product news, tips, and community highlights"
                  field="newsletter" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-newsletter" />
                <NotifRow label="Security Alerts" description="Password changes, new login locations, and account security events"
                  field="security" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-security" />
              </CardContent>
            </Card>

            <Card data-testid="card-inapp-notifications">
              <CardHeader>
                <CardTitle>In-App Notifications</CardTitle>
                <CardDescription>Configure which in-app notifications you receive.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <NotifRow label="Agent Notifications" description="When your AI agent requests feedback or finishes a task"
                  field="agent" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-agent" />
                <NotifRow label="System Announcements" description="Important platform announcements and updates"
                  field="system" prefs={notifPrefs} onChange={handleNotifToggle} testId="switch-system" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* SECURITY TAB                                                      */}
          {/* ============================================================== */}
          <TabsContent value="security" className="space-y-6 mt-4" data-testid="content-security">
            {/* Password */}
            <Card data-testid="card-change-password">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password. Your session is kept active after the change.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(d => updatePasswordMut.mutate(d))} className="space-y-4">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl><Input {...field} type="password" autoComplete="current-password" data-testid="input-current-password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl><Input {...field} type="password" autoComplete="new-password" data-testid="input-new-password" /></FormControl>
                        <FormDescription>At least 8 characters</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl><Input {...field} type="password" autoComplete="new-password" data-testid="input-confirm-password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={updatePasswordMut.isPending} data-testid="button-update-password">
                      {updatePasswordMut.isPending ? 'Updating…' : 'Update Password'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card data-testid="card-two-factor">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security with a time-based one-time password (TOTP) app such as Google Authenticator or Authy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Status row */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Authenticator App (TOTP)</p>
                    <p className="text-xs text-muted-foreground">
                      {twoFAStatus?.enabled
                        ? 'Two-factor authentication is currently enabled.'
                        : 'Not configured — your account is protected by password only.'}
                    </p>
                  </div>
                  {twoFAStatus?.enabled
                    ? <Badge variant="default" data-testid="badge-2fa-enabled">Enabled</Badge>
                    : <Badge variant="outline" data-testid="badge-2fa-disabled">Disabled</Badge>}
                </div>

                {/* Step: idle — show action button */}
                {twoFAStep === 'idle' && (
                  <div className="flex gap-2">
                    {!twoFAStatus?.enabled ? (
                      <Button variant="outline" size="sm"
                        onClick={() => setup2FAMut.mutate()}
                        disabled={setup2FAMut.isPending}
                        data-testid="button-setup-2fa">
                        <Shield className="h-4 w-4 mr-1" />
                        {setup2FAMut.isPending ? 'Starting…' : 'Set up 2FA'}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm"
                        onClick={() => { setTwoFAStep('disable'); setTwoFAError(''); }}
                        data-testid="button-disable-2fa">
                        Disable 2FA
                      </Button>
                    )}
                  </div>
                )}

                {/* Step: setup — show QR code + secret */}
                {twoFAStep === 'setup' && twoFASetupData && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30" data-testid="section-2fa-setup">
                    <p className="text-sm font-medium">Scan this QR code with your authenticator app:</p>
                    <div className="flex justify-center">
                      <img
                        src={twoFASetupData.qrCodeUrl}
                        alt="2FA QR Code"
                        className="w-48 h-48 border rounded"
                        data-testid="img-2fa-qr"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Or enter this secret manually:</p>
                      <code className="block text-xs bg-background border rounded px-2 py-1 font-mono select-all" data-testid="text-2fa-secret">
                        {twoFASetupData.secret}
                      </code>
                    </div>
                    {twoFASetupData.backupCodes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Save these backup codes in a safe place:</p>
                        <div className="grid grid-cols-2 gap-1" data-testid="list-backup-codes">
                          {twoFASetupData.backupCodes.map((c, i) => (
                            <code key={i} className="text-xs bg-background border rounded px-2 py-0.5 font-mono">{c}</code>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium">Enter the 6-digit code from your app to confirm:</p>
                      <div className="flex gap-2">
                        <Input
                          value={twoFAToken}
                          onChange={e => { setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFAError(''); }}
                          placeholder="000000"
                          maxLength={6}
                          className="w-32 font-mono text-center tracking-widest"
                          data-testid="input-2fa-token"
                        />
                        <Button
                          onClick={() => confirm2FAMut.mutate(twoFAToken)}
                          disabled={twoFAToken.length !== 6 || confirm2FAMut.isPending}
                          data-testid="button-confirm-2fa">
                          {confirm2FAMut.isPending ? 'Verifying…' : 'Activate'}
                        </Button>
                        <Button variant="ghost" onClick={() => { setTwoFAStep('idle'); setTwoFASetupData(null); setTwoFAToken(''); setTwoFAError(''); }}
                          data-testid="button-cancel-2fa-setup">Cancel</Button>
                      </div>
                      {twoFAError && <p className="text-xs text-destructive" data-testid="text-2fa-error">{twoFAError}</p>}
                    </div>
                  </div>
                )}

                {/* Step: disable — confirm with password */}
                {twoFAStep === 'disable' && (
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30" data-testid="section-2fa-disable">
                    <p className="text-sm">Enter your current password to disable two-factor authentication:</p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={twoFAPassword}
                        onChange={e => { setTwoFAPassword(e.target.value); setTwoFAError(''); }}
                        placeholder="Current password"
                        autoComplete="current-password"
                        className="max-w-xs"
                        data-testid="input-2fa-disable-password"
                      />
                      <Button variant="destructive"
                        onClick={() => disable2FAMut.mutate(twoFAPassword)}
                        disabled={!twoFAPassword || disable2FAMut.isPending}
                        data-testid="button-confirm-disable-2fa">
                        {disable2FAMut.isPending ? 'Disabling…' : 'Disable 2FA'}
                      </Button>
                      <Button variant="ghost" onClick={() => { setTwoFAStep('idle'); setTwoFAPassword(''); setTwoFAError(''); }}
                        data-testid="button-cancel-2fa-disable">Cancel</Button>
                    </div>
                    {twoFAError && <p className="text-xs text-destructive" data-testid="text-2fa-disable-error">{twoFAError}</p>}
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Active sessions */}
            <Card data-testid="card-active-sessions">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage your active login sessions across devices and browsers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No session data available.</p>
                ) : (
                  sessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={s.isCurrent ? 'session-current' : `session-${s.id}`}>
                      <div className="flex items-center space-x-3 min-w-0">
                        <Monitor className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.userAgent || 'Unknown device'}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.isCurrent
                              ? 'Current session'
                              : `Last active: ${s.lastActive ? new Date(s.lastActive).toLocaleDateString() : 'Unknown'}`}
                            {s.ip ? ` · ${s.ip}` : ''}
                          </p>
                        </div>
                      </div>
                      {s.isCurrent
                        ? <Badge variant="secondary" data-testid="badge-current-session">Current</Badge>
                        : (
                          <Button variant="ghost" size="sm"
                            onClick={() => revokeSessionMut.mutate(s.id)}
                            disabled={revokeSessionMut.isPending}
                            data-testid={`button-revoke-session-${s.id}`}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full"
                  onClick={() => revokeOthersMut.mutate()}
                  disabled={revokeOthersMut.isPending}
                  data-testid="button-signout-all">
                  Sign out all other sessions
                </Button>
              </CardContent>
            </Card>

            {/* SSH Keys */}
            <Card data-testid="card-ssh-keys">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>SSH Keys</span>
                  <Button size="sm" variant="outline" onClick={() => setSshAddOpen(true)} data-testid="button-add-ssh-key">
                    <Plus className="h-4 w-4 mr-1" />Add Key
                  </Button>
                </CardTitle>
                <CardDescription>Public keys for git authentication via SSH.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sshKeys.length === 0
                  ? <p className="text-sm text-muted-foreground">No SSH keys added yet.</p>
                  : sshKeys.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`ssh-key-${k.id}`}>
                      <div className="flex items-center space-x-3 min-w-0">
                        <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{k.label}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{k.fingerprint}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm"
                        onClick={() => deleteSshKeyMut.mutate(k.id)}
                        disabled={deleteSshKeyMut.isPending}
                        data-testid={`button-delete-ssh-${k.id}`}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                }
              </CardContent>
            </Card>

            {/* Personal API Tokens */}
            <Card data-testid="card-api-tokens">
              <CardHeader>
                <CardTitle>Personal API Tokens</CardTitle>
                <CardDescription>
                  Tokens for programmatic API access. The full token value is shown once when created.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {newTokenSecret && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" data-testid="alert-new-token">
                    <AlertDescription>
                      <p className="font-medium text-sm mb-1">Copy your token now — it will not be shown again:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1" data-testid="text-new-token">
                          {newTokenSecret}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copy(newTokenSecret)} data-testid="button-copy-token">
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setNewTokenSecret(null)}>
                        Dismiss
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Create new token */}
                <div className="flex gap-2" data-testid="form-create-token">
                  <Input
                    placeholder="Token name (e.g. CI deploy key)"
                    value={tokenName}
                    onChange={e => setTokenName(e.target.value)}
                    data-testid="input-token-name"
                  />
                  <Button
                    onClick={() => tokenName.trim() && createTokenMut.mutate()}
                    disabled={!tokenName.trim() || createTokenMut.isPending}
                    data-testid="button-create-token"
                  >
                    <Plus className="h-4 w-4 mr-1" />Create
                  </Button>
                </div>

                {/* Token list */}
                {apiTokens.length === 0
                  ? <p className="text-sm text-muted-foreground">No personal API tokens yet.</p>
                  : (
                    <div className="space-y-2">
                      {apiTokens.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`api-token-${t.id}`}>
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {t.tokenPrefix}… · Created {new Date(t.createdAt).toLocaleDateString()}
                              {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm"
                            onClick={() => revokeTokenMut.mutate(t.id)}
                            disabled={revokeTokenMut.isPending}
                            data-testid={`button-revoke-token-${t.id}`}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                }
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ================================================================== */}
      {/* SSH Key Add Dialog                                                   */}
      {/* ================================================================== */}
      <Dialog open={sshAddOpen} onOpenChange={setSshAddOpen}>
        <DialogContent data-testid="dialog-add-ssh-key">
          <DialogHeader>
            <DialogTitle>Add SSH Key</DialogTitle>
            <DialogDescription>
              Paste your SSH public key below. It should start with <code>ssh-rsa</code>, <code>ssh-ed25519</code>, or similar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="ssh-label">Label</Label>
              <Input
                id="ssh-label"
                value={sshLabel}
                onChange={e => setSshLabel(e.target.value)}
                placeholder="My laptop"
                data-testid="input-ssh-label"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ssh-key">Public Key</Label>
              <Textarea
                id="ssh-key"
                value={sshKey}
                onChange={e => setSshKey(e.target.value)}
                placeholder="ssh-ed25519 AAAA..."
                rows={4}
                className="font-mono text-xs"
                data-testid="input-ssh-key"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSshAddOpen(false)} data-testid="button-cancel-ssh">Cancel</Button>
            <Button
              onClick={() => addSshKeyMut.mutate()}
              disabled={!sshLabel.trim() || !sshKey.trim() || addSshKeyMut.isPending}
              data-testid="button-confirm-add-ssh"
            >
              {addSshKeyMut.isPending ? 'Adding…' : 'Add Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Delete Account Dialog                                                */}
      {/* ================================================================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-account">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All projects, files, and data will be deleted immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>All data will be permanently deleted. There is no recovery option.</AlertDescription>
            </Alert>
            <div className="space-y-1">
              <Label htmlFor="delete-confirm">
                Type <strong>DELETE MY ACCOUNT</strong> to confirm:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}
              data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button variant="destructive"
              onClick={() => deleteAccountMut.mutate()}
              disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || deleteAccountMut.isPending}
              data-testid="button-confirm-delete">
              {deleteAccountMut.isPending ? 'Deleting…' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
