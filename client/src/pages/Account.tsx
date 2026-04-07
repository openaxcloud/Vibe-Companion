import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  User, Mail, Key, Shield, CreditCard, Bell, 
  Globe, Download, Trash2, AlertTriangle, Check,
  Smartphone, Monitor, Lock, Link, Github, Twitter,
  Chrome, Apple, Zap, Crown, Database, Server, Loader2,
  Plus, Copy, Eye, EyeOff, Power, ExternalLink, Webhook
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ECodeSpinner } from '@/components/ECodeLoading';
import { TwoFactorSetup } from '@/components/security/TwoFactorSetup';

function DeveloperApiKeysCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/developer/api-keys'],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/developer/api-keys', { name });
      return res.json();
    },
    onSuccess: (data) => {
      setRevealedKey(data.key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['/api/developer/api-keys'] });
      toast({ title: 'API key created', description: 'Copy your key now — it won\'t be shown again.' });
    },
    onError: () => toast({ title: 'Failed to create API key', variant: 'destructive' }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest('DELETE', `/api/developer/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/api-keys'] });
      toast({ title: 'API key revoked' });
    },
    onError: () => toast({ title: 'Failed to revoke key', variant: 'destructive' }),
  });

  return (
    <Card data-testid="card-api-keys">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Manage your API keys for accessing E-Code programmatically</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setRevealedKey(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-generate-api-key"><Plus className="mr-2 h-4 w-4" /> New Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{revealedKey ? 'Your New API Key' : 'Generate API Key'}</DialogTitle>
                <DialogDescription>{revealedKey ? 'Copy this key now. It won\'t be shown again.' : 'Give your key a name to identify it later.'}</DialogDescription>
              </DialogHeader>
              {revealedKey ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all select-all" data-testid="text-revealed-key">{revealedKey}</div>
                  <Button className="w-full" onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: 'Copied!' }); }} data-testid="button-copy-key">
                    <Copy className="mr-2 h-4 w-4" /> Copy to clipboard
                  </Button>
                </div>
              ) : (
                <>
                  <Input placeholder="e.g. Production, CI/CD, Testing" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} data-testid="input-api-key-name" />
                  <DialogFooter>
                    <Button disabled={!newKeyName.trim() || createMutation.isPending} onClick={() => createMutation.mutate(newKeyName.trim())} data-testid="button-confirm-generate">
                      {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                      Generate
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No API keys yet. Create one to get started.</p>
        ) : (
          apiKeys.map((k: any) => (
            <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`api-key-item-${k.id}`}>
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">{k.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{k.keyPrefix}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never expires'}</Badge>
                {k.lastUsedAt && <span className="text-[10px] text-muted-foreground">Used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(k.id)} disabled={revokeMutation.isPending} data-testid={`button-revoke-${k.id}`}>
                  {revokeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revoke'}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DeveloperSshKeysCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [publicKey, setPublicKey] = useState('');

  const { data: sshKeys = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/developer/ssh-keys'],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { label: string; publicKey: string }) => {
      const res = await apiRequest('POST', '/api/developer/ssh-keys', data);
      return res.json();
    },
    onSuccess: () => {
      setShowDialog(false);
      setLabel('');
      setPublicKey('');
      queryClient.invalidateQueries({ queryKey: ['/api/developer/ssh-keys'] });
      toast({ title: 'SSH key added' });
    },
    onError: (err: any) => toast({ title: err.message || 'Failed to add SSH key', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest('DELETE', `/api/developer/ssh-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/ssh-keys'] });
      toast({ title: 'SSH key removed' });
    },
    onError: () => toast({ title: 'Failed to remove key', variant: 'destructive' }),
  });

  return (
    <Card data-testid="card-ssh-keys">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SSH Keys</CardTitle>
            <CardDescription>Add SSH keys to access your Repls via SSH</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-ssh-key"><Plus className="mr-2 h-4 w-4" /> Add Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add SSH Key</DialogTitle>
                <DialogDescription>Paste your public SSH key (e.g. from ~/.ssh/id_rsa.pub)</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Label</Label>
                  <Input placeholder="e.g. MacBook Pro" value={label} onChange={(e) => setLabel(e.target.value)} data-testid="input-ssh-label" />
                </div>
                <div>
                  <Label>Public Key</Label>
                  <Textarea placeholder="ssh-ed25519 AAAAC3..." value={publicKey} onChange={(e) => setPublicKey(e.target.value)} rows={4} className="font-mono text-xs" data-testid="input-ssh-public-key" />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!label.trim() || !publicKey.trim() || addMutation.isPending} onClick={() => addMutation.mutate({ label: label.trim(), publicKey: publicKey.trim() })} data-testid="button-confirm-add-ssh">
                  {addMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Add Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sshKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No SSH keys added yet.</p>
        ) : (
          sshKeys.map((k: any) => (
            <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`ssh-key-item-${k.id}`}>
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">{k.label}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{k.fingerprint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Added {new Date(k.createdAt).toLocaleDateString()}</span>
                <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(k.id)} disabled={removeMutation.isPending} data-testid={`button-remove-ssh-${k.id}`}>
                  {removeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DeveloperWebhooksCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const availableEvents = [
    'project.created', 'project.updated', 'project.deleted',
    'deployment.started', 'deployment.succeeded', 'deployment.failed',
    'file.created', 'file.updated', 'file.deleted',
    'push', 'pull_request',
  ];

  const { data: hooks = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/developer/webhooks'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { url: string; events: string[] }) => {
      const res = await apiRequest('POST', '/api/developer/webhooks', data);
      return res.json();
    },
    onSuccess: () => {
      setShowDialog(false);
      setUrl('');
      setSelectedEvents([]);
      queryClient.invalidateQueries({ queryKey: ['/api/developer/webhooks'] });
      toast({ title: 'Webhook created' });
    },
    onError: (err: any) => toast({ title: err.message || 'Failed to create webhook', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiRequest('PATCH', `/api/developer/webhooks/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/webhooks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/developer/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/webhooks'] });
      toast({ title: 'Webhook deleted' });
    },
    onError: () => toast({ title: 'Failed to delete webhook', variant: 'destructive' }),
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  return (
    <Card data-testid="card-webhooks">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Configure webhooks to receive events from your Repls</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-configure-webhooks"><Plus className="mr-2 h-4 w-4" /> New Webhook</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Webhook</DialogTitle>
                <DialogDescription>We'll send POST requests with event payloads to this URL.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Payload URL</Label>
                  <Input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="input-webhook-url" />
                </div>
                <div>
                  <Label className="mb-2 block">Events</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {availableEvents.map(event => (
                      <label key={event} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted">
                        <input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => toggleEvent(event)} className="rounded" />
                        <code>{event}</code>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!url.trim() || selectedEvents.length === 0 || createMutation.isPending} onClick={() => createMutation.mutate({ url: url.trim(), events: selectedEvents })} data-testid="button-confirm-webhook">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Webhook className="mr-2 h-4 w-4" />}
                  Create Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No webhooks configured yet.</p>
        ) : (
          hooks.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`webhook-item-${h.id}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Webhook className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium font-mono truncate">{h.url}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {(h.events || []).slice(0, 3).map((e: string) => (
                      <Badge key={e} variant="outline" className="text-[9px] px-1">{e}</Badge>
                    ))}
                    {(h.events || []).length > 3 && <span className="text-[9px] text-muted-foreground">+{h.events.length - 3} more</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={h.active} onCheckedChange={(active) => toggleMutation.mutate({ id: h.id, active })} data-testid={`switch-webhook-${h.id}`} />
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(h.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-webhook-${h.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  const [profile, setProfile] = useState({
    username: user?.username || '',
    email: user?.email || '',
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    website: user?.website || ''
  });

  const [emailPreferences, setEmailPreferences] = useState({
    marketing: true,
    updates: true,
    tips: true,
    community: false
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessions: []
  });

  // Fetch billing data from real API
  const { data: billingData, isLoading: isBillingLoading } = useQuery<{
    plan: string;
    monthlyCost: number;
    nextBillingDate: string;
    usage: {
      compute: { used: number; limit: number };
      storage: { used: number; limit: number };
      privateRepls: { used: number; limit: string };
    };
    paymentMethod: {
      last4: string;
      expiryMonth: number;
      expiryYear: number;
    } | null;
  }>({
    queryKey: ['/api/user/billing-summary'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/user/billing-summary');
    },
    enabled: !!user
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username || '',
        email: user.email || '',
        displayName: user.displayName || '',
        bio: user.bio || '',
        website: user.website || ''
      });
      
      // Set 2FA status if available
      if (user.twoFactorEnabled !== undefined) {
        setSecurity(prev => ({ ...prev, twoFactor: user.twoFactorEnabled }));
      }
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      await apiRequest('PATCH', '/api/user/profile', {
        displayName: profile.displayName,
        bio: profile.bio,
        website: profile.website
      });
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const currentPassword = prompt("Enter your current password:");
    const newPassword = prompt("Enter your new password:");
    
    if (!currentPassword || !newPassword) {
      return;
    }
    
    try {
      await apiRequest('POST', '/api/user/change-password', {
        currentPassword,
        newPassword
      });
      
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password. Please check your current password.",
        variant: "destructive"
      });
    }
  };

  const handleEnable2FA = async () => {
    try {
      const response = await apiRequest('POST', '/api/user/2fa', {
        enabled: !security.twoFactor
      });
      
      setSecurity({ ...security, twoFactor: !security.twoFactor });
      
      toast({
        title: security.twoFactor ? "Two-factor authentication disabled" : "Two-factor authentication enabled",
        description: security.twoFactor ? "2FA has been disabled." : "Your account is now more secure."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update 2FA settings.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateEmail = async () => {
    try {
      await apiRequest('PATCH', '/api/user/email', {
        email: profile.email
      });
      
      toast({
        title: "Email updated",
        description: "Your email address has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm("Are you sure you want to delete your account? This action cannot be undone.");
    
    if (!confirmed) {
      return;
    }
    
    try {
      await apiRequest('DELETE', '/api/user/account');
      
      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted.",
        variant: "destructive"
      });
      
      // Redirect to homepage after deletion
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Account settings"
        description="Manage your profile, security, billing, and notification preferences."
        icon={User}
        actions={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2" onClick={handleSaveProfile} data-testid="button-save-changes">
              <Check className="h-4 w-4" />
              Save changes
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/settings')} data-testid="button-security-center">
              <Shield className="h-4 w-4" />
              Security center
            </Button>
          </div>
        )}
      />
      <div className="space-y-6" data-testid="account-page">

      <Tabs defaultValue="profile" className="space-y-4" data-testid="account-tabs">
        <div className="overflow-x-auto max-w-full">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full md:w-full">
            <TabsTrigger value="profile" className="whitespace-nowrap" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="account" className="whitespace-nowrap" data-testid="tab-account">Account</TabsTrigger>
            <TabsTrigger value="security" className="whitespace-nowrap" data-testid="tab-security">Security</TabsTrigger>
            <TabsTrigger value="billing" className="whitespace-nowrap" data-testid="tab-billing">Billing</TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap" data-testid="tab-notifications">Notifications</TabsTrigger>
            <TabsTrigger value="developer" className="whitespace-nowrap" data-testid="tab-developer">Developer</TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4" data-testid="content-profile">
          <Card data-testid="card-public-profile">
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>
                This information will be displayed on your public profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={profile.username}
                      onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                      disabled
                      data-testid="input-username"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Your username cannot be changed
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={profile.displayName}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                      placeholder="John Doe"
                      data-testid="input-display-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    className="w-full min-h-[100px] px-3 py-2 text-[13px] rounded-md border bg-background"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    data-testid="input-bio"
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-[13px] font-medium">Website</h3>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://yourwebsite.com"
                      value={profile.website}
                      onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                      data-testid="input-website"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={isLoading} data-testid="button-save-profile">
                  {isLoading && <ECodeSpinner className="mr-2" size={16} />}
                  {isLoading ? "Saving" : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4" data-testid="content-account">
          <Card data-testid="card-account-info">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="flex-1"
                    data-testid="input-email"
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleUpdateEmail}
                    disabled={profile.email === user?.email}
                    data-testid="button-update-email"
                  >
                    Update Email
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  We'll send important notifications to this email
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-[13px] font-medium">Password</h3>
                <Button variant="outline" onClick={handleChangePassword} data-testid="button-change-password">
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-[13px] font-medium text-destructive">Danger Zone</h3>
                <Button variant="destructive" onClick={handleDeleteAccount} data-testid="button-delete-account">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4" data-testid="content-security">
          <TwoFactorSetup />
          
          <Card data-testid="card-security-settings">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Keep your account secure with these settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-4">
                <h3 className="text-[13px] font-medium">Active Sessions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="session-current">
                    <div className="flex items-center gap-3">
                      <Chrome className="h-5 w-5" />
                      <div>
                        <p className="text-[13px] font-medium">Chrome on Windows</p>
                        <p className="text-[11px] text-muted-foreground">Current session</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="session-iphone">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5" />
                      <div>
                        <p className="text-[13px] font-medium">iPhone</p>
                        <p className="text-[11px] text-muted-foreground">Last active 2 hours ago</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" data-testid="button-revoke-session">Revoke</Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-[13px] font-medium">Connected Apps</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="app-github">
                    <div className="flex items-center gap-3">
                      <Github className="h-5 w-5" />
                      <div>
                        <p className="text-[13px] font-medium">GitHub</p>
                        <p className="text-[11px] text-muted-foreground">Read access to repos</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" data-testid="button-disconnect-github">Disconnect</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4" data-testid="content-billing">
          <Card data-testid="card-billing">
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              <CardDescription>
                Manage your subscription and billing details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBillingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="p-4 border rounded-lg bg-muted/50" data-testid="current-plan">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-600" />
                        <h3 className="font-semibold">{billingData?.plan || user?.subscriptionTier || 'Free'} Plan</h3>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[13px]">
                      <div>
                        <p className="text-muted-foreground">Monthly Cost</p>
                        <p className="font-medium" data-testid="text-monthly-cost">
                          ${billingData?.monthlyCost?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next Billing</p>
                        <p className="font-medium" data-testid="text-next-billing">
                          {billingData?.nextBillingDate 
                            ? new Date(billingData.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Button className="w-full mt-4" variant="outline" data-testid="button-manage-subscription">
                      Manage Subscription
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-[13px] font-medium">Usage This Month</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px]">Compute Hours</span>
                          <span className="text-[13px] font-medium">
                            {billingData?.usage?.compute?.used ?? 0} / {billingData?.usage?.compute?.limit ?? 0}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${billingData?.usage?.compute ? Math.min(100, (billingData.usage.compute.used / billingData.usage.compute.limit) * 100) : 0}%` }} 
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px]">Storage</span>
                          <span className="text-[13px] font-medium">
                            {billingData?.usage?.storage?.used?.toFixed(1) ?? 0}GB / {billingData?.usage?.storage?.limit ?? 0}GB
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${billingData?.usage?.storage ? Math.min(100, (billingData.usage.storage.used / billingData.usage.storage.limit) * 100) : 0}%` }} 
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px]">Private Repls</span>
                          <span className="text-[13px] font-medium">
                            {billingData?.usage?.privateRepls?.used ?? 0} / {billingData?.usage?.privateRepls?.limit ?? 'Unlimited'}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-green-600" style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-[13px] font-medium">Payment Method</h3>
                    {billingData?.paymentMethod ? (
                      <div className="flex items-center justify-between p-3 border rounded-lg" data-testid="payment-method">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5" />
                          <div>
                            <p className="text-[13px] font-medium" data-testid="text-card-number">•••• •••• •••• {billingData.paymentMethod.last4}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Expires {billingData.paymentMethod.expiryMonth}/{billingData.paymentMethod.expiryYear}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" data-testid="button-update-payment">Update</Button>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No payment method on file</p>
                        <Button variant="outline" size="sm" className="mt-2">Add Payment Method</Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4" data-testid="content-notifications">
          <Card data-testid="card-email-notifications">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what emails you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marketing emails</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Receive emails about new features and updates
                    </p>
                  </div>
                  <Switch
                    checked={emailPreferences.marketing}
                    onCheckedChange={(checked) => 
                      setEmailPreferences({ ...emailPreferences, marketing: checked })
                    }
                    data-testid="switch-marketing"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Product updates</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Get notified about important product changes
                    </p>
                  </div>
                  <Switch
                    checked={emailPreferences.updates}
                    onCheckedChange={(checked) => 
                      setEmailPreferences({ ...emailPreferences, updates: checked })
                    }
                    data-testid="switch-updates"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tips & tutorials</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Receive helpful tips to get the most out of E-Code
                    </p>
                  </div>
                  <Switch
                    checked={emailPreferences.tips}
                    onCheckedChange={(checked) => 
                      setEmailPreferences({ ...emailPreferences, tips: checked })
                    }
                    data-testid="switch-tips"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Community digest</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Weekly summary of popular projects and discussions
                    </p>
                  </div>
                  <Switch
                    checked={emailPreferences.community}
                    onCheckedChange={(checked) => 
                      setEmailPreferences({ ...emailPreferences, community: checked })
                    }
                    data-testid="switch-community"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-inapp-notifications">
            <CardHeader>
              <CardTitle>In-App Notifications</CardTitle>
              <CardDescription>
                Control what notifications you see in E-Code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Comments & mentions</Label>
                    <p className="text-[13px] text-muted-foreground">
                      When someone comments on your Repl or mentions you
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-comments" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Follows</Label>
                    <p className="text-[13px] text-muted-foreground">
                      When someone follows you
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-follows" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Repl activity</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Updates about your Repls (forks, likes, etc.)
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-repl-activity" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Developer Tab */}
        <TabsContent value="developer" className="space-y-4" data-testid="content-developer">
          <DeveloperApiKeysCard />
          <DeveloperSshKeysCard />
          <DeveloperWebhooksCard />
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}