import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  Key,
  Users,
  Globe,
  Smartphone,
  Lock,
  Clock,
  Palette,
  Settings2,
  Plus,
  Check,
  X,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { SiGoogle, SiGithub, SiApple } from 'react-icons/si';
import { Building2, KeyRound, ShieldCheck } from 'lucide-react';

// Icon aliases for providers that don't have SI icons
const SiMicrosoft = Building2;
const SiOkta = KeyRound;
const SiAuth0 = ShieldCheck;
import { useToast } from '@/hooks/use-toast';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'oauth2';
  status: 'active' | 'inactive' | 'pending';
  entityId?: string;
  ssoUrl?: string;
  lastSync?: Date;
  usersCount: number;
}

interface SocialProvider {
  id: string;
  name: string;
  icon: typeof SiGoogle;
  enabled: boolean;
  clientId?: string;
  configured: boolean;
}

interface MFAMethod {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  enforced: boolean;
  icon: typeof Smartphone;
}

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: Date;
  current: boolean;
}

export default function AuthenticationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('sso');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);

  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([
    {
      id: '1',
      name: 'Okta',
      type: 'saml',
      status: 'active',
      entityId: 'https://company.okta.com/app/ecode',
      ssoUrl: 'https://company.okta.com/app/ecode/sso',
      lastSync: new Date(Date.now() - 3600000),
      usersCount: 1247,
    },
    {
      id: '2',
      name: 'Azure AD',
      type: 'oidc',
      status: 'active',
      entityId: 'https://login.microsoftonline.com/tenant-id',
      lastSync: new Date(Date.now() - 7200000),
      usersCount: 856,
    },
    {
      id: '3',
      name: 'Google Workspace',
      type: 'oauth2',
      status: 'pending',
      usersCount: 0,
    },
  ]);

  const [socialProviders, setSocialProviders] = useState<SocialProvider[]>([
    { id: '1', name: 'Google', icon: SiGoogle, enabled: true, clientId: '***************', configured: true },
    { id: '2', name: 'GitHub', icon: SiGithub, enabled: true, clientId: '***************', configured: true },
    { id: '3', name: 'Apple', icon: SiApple, enabled: false, configured: false },
    { id: '4', name: 'Microsoft', icon: SiMicrosoft, enabled: false, configured: false },
  ]);

  const [mfaMethods, setMfaMethods] = useState<MFAMethod[]>([
    { id: '1', name: 'Authenticator App', description: 'Time-based one-time passwords (TOTP)', enabled: true, enforced: true, icon: Smartphone },
    { id: '2', name: 'SMS', description: 'One-time codes via text message', enabled: true, enforced: false, icon: Smartphone },
    { id: '3', name: 'Email', description: 'One-time codes via email', enabled: true, enforced: false, icon: Globe },
    { id: '4', name: 'Hardware Keys', description: 'FIDO2/WebAuthn security keys', enabled: false, enforced: false, icon: Key },
  ]);

  const [sessions] = useState<Session[]>([
    { id: '1', device: 'MacBook Pro', browser: 'Chrome 120', location: 'San Francisco, CA', ip: '192.168.1.***', lastActive: new Date(), current: true },
    { id: '2', device: 'iPhone 15', browser: 'Safari Mobile', location: 'San Francisco, CA', ip: '10.0.0.***', lastActive: new Date(Date.now() - 1800000), current: false },
    { id: '3', device: 'Windows PC', browser: 'Firefox 121', location: 'New York, NY', ip: '172.16.0.***', lastActive: new Date(Date.now() - 86400000), current: false },
  ]);

  const [passwordlessEnabled, setPasswordlessEnabled] = useState(true);
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(true);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);

  const [sessionTimeout, setSessionTimeout] = useState('24');
  const [rememberMeEnabled, setRememberMeEnabled] = useState(true);
  const [concurrentSessionsLimit, setConcurrentSessionsLimit] = useState('5');
  const [forceReauthEnabled, setForceReauthEnabled] = useState(true);

  const [brandingLogo, setBrandingLogo] = useState('');
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#F97316');
  const [brandingWelcomeText, setBrandingWelcomeText] = useState('Welcome to E-Code');
  const [brandingButtonText, setBrandingButtonText] = useState('Sign in with SSO');

  const [autoProvisioningEnabled, setAutoProvisioningEnabled] = useState(true);
  const [jitProvisioningEnabled, setJitProvisioningEnabled] = useState(true);
  const [deactivateOnRemoval, setDeactivateOnRemoval] = useState(true);
  const [defaultRole, setDefaultRole] = useState('developer');

  const handleSaveSettings = () => {
    setIsConfiguring(true);
    setTimeout(() => {
      setIsConfiguring(false);
      toast({
        title: 'Settings saved',
        description: 'Authentication settings have been updated successfully.',
      });
    }, 1000);
  };

  const handleToggleSocialProvider = (id: string) => {
    setSocialProviders(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
    toast({
      title: 'Provider updated',
      description: 'Social login provider settings have been updated.',
    });
  };

  const handleToggleMFA = (id: string, field: 'enabled' | 'enforced') => {
    setMfaMethods(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: !m[field] } : m))
    );
  };

  const handleRevokeSession = (id: string) => {
    toast({
      title: 'Session revoked',
      description: 'The session has been terminated.',
    });
  };

  const handleTestConnection = (provider: SSOProvider) => {
    toast({
      title: 'Testing connection',
      description: `Testing connection to ${provider.name}...`,
    });
  };

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";
  const switchClassName = "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted";

  const navItems = [
    { id: 'sso', label: 'SSO Configuration', icon: Shield },
    { id: 'social', label: 'Social Logins', icon: Globe },
    { id: 'passwordless', label: 'Passwordless', icon: Key },
    { id: 'mfa', label: 'MFA/2FA', icon: Smartphone },
    { id: 'sessions', label: 'Session Management', icon: Clock },
    { id: 'branding', label: 'Login Branding', icon: Palette },
    { id: 'lifecycle', label: 'User Lifecycle', icon: Users },
  ];

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        data-testid="page-authentication"
      >
        <PageHeader
          title="Authentication Hub"
          description="Configure enterprise authentication, SSO providers, MFA, and security policies."
          icon={Shield}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 border-border bg-card text-foreground hover:bg-muted"
                onClick={() => navigate('/settings')}
                data-testid="button-back-settings"
              >
                <Settings2 className="h-4 w-4" />
                Settings
              </Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSaveSettings}
                disabled={isConfiguring}
                data-testid="button-save-auth-settings"
              >
                {isConfiguring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isConfiguring ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="md:col-span-1">
            <nav
              className="space-y-1 p-2 rounded-xl border border-border bg-card"
              data-testid="nav-auth-sidebar"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 min-h-[44px] ${
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab(item.id)}
                    data-testid={`button-auth-tab-${item.id}`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="md:col-span-3 space-y-6">
            {activeTab === 'sso' && (
              <Card className={cardClassName} data-testid="card-sso-configuration">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">SSO Providers</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure SAML 2.0, OpenID Connect, and OAuth 2.0 identity providers
                      </CardDescription>
                    </div>
                    <Dialog open={showAddProviderDialog} onOpenChange={setShowAddProviderDialog}>
                      <DialogTrigger asChild>
                        <Button className="gap-2" data-testid="button-add-sso-provider">
                          <Plus className="h-4 w-4" />
                          Add Provider
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg" data-testid="dialog-add-sso-provider">
                        <DialogHeader>
                          <DialogTitle>Add SSO Provider</DialogTitle>
                          <DialogDescription>
                            Configure a new identity provider for single sign-on
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label>Provider Type</Label>
                            <Select data-testid="select-provider-type">
                              <SelectTrigger className={inputClassName}>
                                <SelectValue placeholder="Select provider type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="saml">SAML 2.0</SelectItem>
                                <SelectItem value="oidc">OpenID Connect</SelectItem>
                                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Provider Name</Label>
                            <Input
                              placeholder="e.g., Okta, Azure AD"
                              className={inputClassName}
                              data-testid="input-provider-name"
                            />
                          </div>
                          <div>
                            <Label>Entity ID / Issuer URL</Label>
                            <Input
                              placeholder="https://your-idp.com/saml"
                              className={inputClassName}
                              data-testid="input-entity-id"
                            />
                          </div>
                          <div>
                            <Label>SSO URL</Label>
                            <Input
                              placeholder="https://your-idp.com/sso"
                              className={inputClassName}
                              data-testid="input-sso-url"
                            />
                          </div>
                          <div>
                            <Label>X.509 Certificate</Label>
                            <Textarea
                              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                              className={`${inputClassName} font-mono text-[11px]`}
                              rows={4}
                              data-testid="textarea-certificate"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddProviderDialog(false)} data-testid="button-cancel-add-provider">
                            Cancel
                          </Button>
                          <Button onClick={() => { setShowAddProviderDialog(false); toast({ title: 'Provider added' }); }} data-testid="button-confirm-add-provider">
                            Add Provider
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ssoProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-all"
                        data-testid={`sso-provider-${provider.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            {provider.name === 'Okta' && <SiOkta className="h-5 w-5 text-primary" />}
                            {provider.name === 'Azure AD' && <SiMicrosoft className="h-5 w-5 text-primary" />}
                            {provider.name === 'Google Workspace' && <SiGoogle className="h-5 w-5 text-primary" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{provider.name}</span>
                              <Badge
                                variant={provider.status === 'active' ? 'default' : provider.status === 'pending' ? 'secondary' : 'outline'}
                                className={provider.status === 'active' ? 'bg-green-500/10 text-green-600' : ''}
                              >
                                {provider.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {provider.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {provider.status}
                              </Badge>
                              <Badge variant="outline">{provider.type.toUpperCase()}</Badge>
                            </div>
                            <div className="text-[13px] text-muted-foreground mt-1">
                              {provider.usersCount} users • {provider.lastSync ? `Last sync: ${provider.lastSync.toLocaleTimeString()}` : 'Not synced'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(provider)}
                            data-testid={`button-test-sso-${provider.id}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-edit-sso-${provider.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-sso-${provider.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Service Provider Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border border-border bg-muted/50">
                        <Label className="text-muted-foreground text-[11px] uppercase">ACS URL</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[13px] text-foreground flex-1 truncate">https://ecode.dev/auth/saml/acs</code>
                          <Button variant="ghost" size="sm" data-testid="button-copy-acs-url">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-muted/50">
                        <Label className="text-muted-foreground text-[11px] uppercase">Entity ID</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[13px] text-foreground flex-1 truncate">https://ecode.dev/auth/saml/metadata</code>
                          <Button variant="ghost" size="sm" data-testid="button-copy-entity-id">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'social' && (
              <Card className={cardClassName} data-testid="card-social-logins">
                <CardHeader>
                  <CardTitle className="text-foreground">Social Login Providers</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Enable social authentication for quick user sign-ups
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {socialProviders.map((provider) => {
                      const Icon = provider.icon;
                      return (
                        <div
                          key={provider.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-all"
                          data-testid={`social-provider-${provider.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{provider.name}</span>
                                {provider.configured && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Configured
                                  </Badge>
                                )}
                              </div>
                              {provider.clientId && (
                                <div className="text-[13px] text-muted-foreground mt-1">
                                  Client ID: {provider.clientId}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" data-testid={`button-configure-social-${provider.id}`}>
                              Configure
                            </Button>
                            <Switch
                              checked={provider.enabled}
                              onCheckedChange={() => handleToggleSocialProvider(provider.id)}
                              className={switchClassName}
                              data-testid={`switch-social-${provider.id}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'passwordless' && (
              <Card className={cardClassName} data-testid="card-passwordless">
                <CardHeader>
                  <CardTitle className="text-foreground">Passwordless Authentication</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Enable secure, password-free login methods
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="space-y-1">
                      <Label className="text-foreground">Magic Link</Label>
                      <p className="text-[13px] text-muted-foreground">
                        Send a secure login link to user's email
                      </p>
                    </div>
                    <Switch
                      checked={magicLinkEnabled}
                      onCheckedChange={setMagicLinkEnabled}
                      className={switchClassName}
                      data-testid="switch-magic-link"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-foreground">Passkeys / WebAuthn</Label>
                        <Badge variant="secondary">Beta</Badge>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        Allow users to sign in with biometrics or security keys
                      </p>
                    </div>
                    <Switch
                      checked={passkeyEnabled}
                      onCheckedChange={setPasskeyEnabled}
                      className={switchClassName}
                      data-testid="switch-passkey"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Magic Link Settings</h4>
                    <div>
                      <Label>Link Expiration (minutes)</Label>
                      <Select defaultValue="15">
                        <SelectTrigger className={inputClassName} data-testid="select-link-expiration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'mfa' && (
              <Card className={cardClassName} data-testid="card-mfa-configuration">
                <CardHeader>
                  <CardTitle className="text-foreground">Multi-Factor Authentication</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure available MFA methods and enforcement policies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mfaMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <div
                          key={method.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border"
                          data-testid={`mfa-method-${method.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{method.name}</span>
                                {method.enforced && (
                                  <Badge className="bg-orange-500/10 text-orange-600">Enforced</Badge>
                                )}
                              </div>
                              <p className="text-[13px] text-muted-foreground">{method.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-[13px] text-muted-foreground">Enforce</Label>
                              <Switch
                                checked={method.enforced}
                                onCheckedChange={() => handleToggleMFA(method.id, 'enforced')}
                                disabled={!method.enabled}
                                className={switchClassName}
                                data-testid={`switch-mfa-enforce-${method.id}`}
                              />
                            </div>
                            <Switch
                              checked={method.enabled}
                              onCheckedChange={() => handleToggleMFA(method.id, 'enabled')}
                              className={switchClassName}
                              data-testid={`switch-mfa-enable-${method.id}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Enforcement Policy</h4>
                    <div>
                      <Label>Require MFA for</Label>
                      <Select defaultValue="admins" data-testid="select-mfa-enforcement">
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All users</SelectItem>
                          <SelectItem value="admins">Admins and owners only</SelectItem>
                          <SelectItem value="optional">Optional (user choice)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'sessions' && (
              <Card className={cardClassName} data-testid="card-session-management">
                <CardHeader>
                  <CardTitle className="text-foreground">Session Management</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Control session policies and view active sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Session Timeout (hours)</Label>
                      <Select value={sessionTimeout} onValueChange={setSessionTimeout} data-testid="select-session-timeout">
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="168">7 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Max Concurrent Sessions</Label>
                      <Select value={concurrentSessionsLimit} onValueChange={setConcurrentSessionsLimit} data-testid="select-concurrent-sessions">
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 session</SelectItem>
                          <SelectItem value="3">3 sessions</SelectItem>
                          <SelectItem value="5">5 sessions</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label className="text-foreground">Remember Me</Label>
                        <p className="text-[13px] text-muted-foreground">Allow users to stay signed in</p>
                      </div>
                      <Switch
                        checked={rememberMeEnabled}
                        onCheckedChange={setRememberMeEnabled}
                        className={switchClassName}
                        data-testid="switch-remember-me"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label className="text-foreground">Force Re-authentication</Label>
                        <p className="text-[13px] text-muted-foreground">Require login for sensitive actions</p>
                      </div>
                      <Switch
                        checked={forceReauthEnabled}
                        onCheckedChange={setForceReauthEnabled}
                        className={switchClassName}
                        data-testid="switch-force-reauth"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground">Active Sessions</h4>
                      <Button variant="outline" size="sm" className="text-destructive" data-testid="button-revoke-all-sessions">
                        Revoke All Other Sessions
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border"
                          data-testid={`session-${session.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <Globe className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{session.device}</span>
                                {session.current && <Badge className="bg-green-500/10 text-green-600">Current</Badge>}
                              </div>
                              <div className="text-[13px] text-muted-foreground">
                                {session.browser} • {session.location} • {session.ip}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[13px] text-muted-foreground">
                              {session.current ? 'Now' : session.lastActive.toLocaleTimeString()}
                            </span>
                            {!session.current && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleRevokeSession(session.id)}
                                data-testid={`button-revoke-session-${session.id}`}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'branding' && (
              <Card className={cardClassName} data-testid="card-login-branding">
                <CardHeader>
                  <CardTitle className="text-foreground">Login Branding</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Customize the appearance of your login pages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label>Company Logo URL</Label>
                        <Input
                          value={brandingLogo}
                          onChange={(e) => setBrandingLogo(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className={inputClassName}
                          data-testid="input-branding-logo"
                        />
                      </div>
                      <div>
                        <Label>Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={brandingPrimaryColor}
                            onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                            data-testid="input-branding-color"
                          />
                          <Input
                            value={brandingPrimaryColor}
                            onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                            className={`${inputClassName} flex-1`}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Welcome Text</Label>
                        <Input
                          value={brandingWelcomeText}
                          onChange={(e) => setBrandingWelcomeText(e.target.value)}
                          className={inputClassName}
                          data-testid="input-branding-welcome"
                        />
                      </div>
                      <div>
                        <Label>SSO Button Text</Label>
                        <Input
                          value={brandingButtonText}
                          onChange={(e) => setBrandingButtonText(e.target.value)}
                          className={inputClassName}
                          data-testid="input-branding-button"
                        />
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border border-border bg-muted/50">
                      <div className="text-center space-y-4">
                        <div className="h-12 w-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                          <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-[15px] font-semibold">{brandingWelcomeText}</h3>
                        <Button
                          className="w-full"
                          style={{ backgroundColor: brandingPrimaryColor }}
                          data-testid="button-branding-preview"
                        >
                          {brandingButtonText}
                        </Button>
                        <p className="text-[13px] text-muted-foreground">Preview of your login page</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'lifecycle' && (
              <Card className={cardClassName} data-testid="card-user-lifecycle">
                <CardHeader>
                  <CardTitle className="text-foreground">User Lifecycle Settings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure automatic user provisioning and deprovisioning
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label className="text-foreground">SCIM Auto Provisioning</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Automatically create users from your identity provider
                        </p>
                      </div>
                      <Switch
                        checked={autoProvisioningEnabled}
                        onCheckedChange={setAutoProvisioningEnabled}
                        className={switchClassName}
                        data-testid="switch-auto-provisioning"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label className="text-foreground">Just-in-Time Provisioning</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Create user accounts on first SSO login
                        </p>
                      </div>
                      <Switch
                        checked={jitProvisioningEnabled}
                        onCheckedChange={setJitProvisioningEnabled}
                        className={switchClassName}
                        data-testid="switch-jit-provisioning"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label className="text-foreground">Deactivate on IdP Removal</Label>
                        <p className="text-[13px] text-muted-foreground">
                          Automatically deactivate users removed from your IdP
                        </p>
                      </div>
                      <Switch
                        checked={deactivateOnRemoval}
                        onCheckedChange={setDeactivateOnRemoval}
                        className={switchClassName}
                        data-testid="switch-deactivate-removal"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Default User Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Default Role</Label>
                        <Select value={defaultRole} onValueChange={setDefaultRole} data-testid="select-default-role">
                          <SelectTrigger className={inputClassName}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Default Team</Label>
                        <Select defaultValue="none" data-testid="select-default-team">
                          <SelectTrigger className={inputClassName}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No team</SelectItem>
                            <SelectItem value="engineering">Engineering</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="design">Design</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-foreground">SCIM Endpoint</h5>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          Use this endpoint to configure SCIM in your identity provider:
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-[13px] bg-background px-2 py-1 rounded">https://ecode.dev/scim/v2</code>
                          <Button variant="ghost" size="sm" data-testid="button-copy-scim-endpoint">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
