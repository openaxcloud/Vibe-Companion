import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Users, 
  Key, 
  Settings, 
  Building,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  UserCheck,
  FileText
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'ldap';
  domain: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
}

interface SCIMUser {
  id: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
    formatted: string;
  };
  emails: Array<{
    value: string;
    type: string;
    primary: boolean;
  }>;
  active: boolean;
  groups: string[];
  meta: {
    created: string;
    lastModified: string;
  };
}

interface SCIMGroup {
  id: string;
  displayName: string;
  members: Array<{
    value: string;
    display: string;
  }>;
  meta: {
    created: string;
    lastModified: string;
  };
}

export function EnterpriseSSO() {
  const [showCreateProvider, setShowCreateProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch SSO providers
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['/api/sso/providers'],
    staleTime: 30000
  });

  // Fetch SCIM users
  const { data: scimUsersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/scim/v2/Users'],
    staleTime: 30000
  });

  // Fetch SCIM groups
  const { data: scimGroupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['/api/scim/v2/Groups'],
    staleTime: 30000
  });

  // Fetch SSO audit logs
  interface AuditLogEntry {
    id: string;
    event: string;
    user: string;
    provider: string;
    time: string;
    status: 'success' | 'error' | 'info';
  }
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery<{ logs: AuditLogEntry[] }>({
    queryKey: ['/api/sso/audit-logs'],
    staleTime: 30000,
    refetchInterval: 60000
  });
  const auditLogs = auditLogsData?.logs || [];

  // Fetch SSO health stats
  interface SSOHealthStats {
    securityScore: number;
    uptime: number;
  }
  const { data: ssoHealthData } = useQuery<SSOHealthStats>({
    queryKey: ['/api/sso/health'],
    staleTime: 60000
  });

  // Create SSO provider mutation
  const createProviderMutation = useMutation({
    mutationFn: async (providerData: any) => {
      const response = await apiRequest('POST', '/api/sso/providers', providerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sso/providers'] });
      setShowCreateProvider(false);
      toast({
        title: "SSO Provider Created",
        description: "The SSO provider has been successfully configured.",
      });
    }
  });

  // Update SSO provider mutation
  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PUT', `/api/sso/providers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sso/providers'] });
      setEditingProvider(null);
      toast({
        title: "SSO Provider Updated",
        description: "The SSO provider settings have been updated.",
      });
    }
  });

  const providers = providersData?.providers || [];
  const scimUsers = scimUsersData?.Resources || [];
  const scimGroups = scimGroupsData?.Resources || [];

  const enterpriseStats = {
    totalProviders: providers.length,
    enabledProviders: providers.filter((p: SSOProvider) => p.enabled).length,
    totalUsers: scimUsers.length,
    activeUsers: scimUsers.filter((u: SCIMUser) => u.active).length,
    totalGroups: scimGroups.length
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'saml': return '🔐';
      case 'oidc': return '🔑';
      case 'ldap': return '📁';
      default: return '🔒';
    }
  };

  const getProviderStatusColor = (enabled: boolean) => {
    return enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const CreateProviderForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      type: 'saml' as 'saml' | 'oidc' | 'ldap',
      domain: '',
      config: {
        entryPoint: '',
        issuer: '',
        cert: '',
        clientId: '',
        clientSecret: '',
        tenantId: '',
        ldapUrl: '',
        baseDN: ''
      }
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createProviderMutation.mutate(formData);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Create SSO Provider</CardTitle>
          <CardDescription>
            Configure a new Single Sign-On provider for enterprise authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider-name">Provider Name</Label>
                <Input
                  id="provider-name"
                  placeholder="e.g., Okta, Azure AD"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="provider-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'saml' | 'oidc' | 'ldap') => 
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saml">SAML 2.0</SelectItem>
                    <SelectItem value="oidc">OpenID Connect</SelectItem>
                    <SelectItem value="ldap">LDAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="e.g., company.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                required
              />
            </div>

            {/* Type-specific configuration */}
            {formData.type === 'saml' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="saml-entry-point">Entry Point URL</Label>
                  <Input
                    id="saml-entry-point"
                    placeholder="https://company.okta.com/app/..."
                    value={formData.config.entryPoint}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, entryPoint: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="saml-issuer">Issuer</Label>
                  <Input
                    id="saml-issuer"
                    placeholder="http://www.okta.com/..."
                    value={formData.config.issuer}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, issuer: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="saml-cert">X.509 Certificate</Label>
                  <Textarea
                    id="saml-cert"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    value={formData.config.cert}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, cert: e.target.value }
                    })}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {formData.type === 'oidc' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="oidc-client-id">Client ID</Label>
                  <Input
                    id="oidc-client-id"
                    value={formData.config.clientId}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, clientId: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="oidc-client-secret">Client Secret</Label>
                  <Input
                    id="oidc-client-secret"
                    type="password"
                    value={formData.config.clientSecret}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, clientSecret: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="oidc-tenant-id">Tenant ID (Azure AD)</Label>
                  <Input
                    id="oidc-tenant-id"
                    placeholder="Optional for Azure AD"
                    value={formData.config.tenantId}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, tenantId: e.target.value }
                    })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateProvider(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProviderMutation.isPending}
              >
                {createProviderMutation.isPending ? 'Creating...' : 'Create Provider'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Enterprise SSO & SCIM</h1>
            <p className="text-muted-foreground">
              Manage Single Sign-On providers and user provisioning for enterprise security
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateProvider(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add SSO Provider
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">SSO Providers</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enterpriseStats.totalProviders}</div>
            <p className="text-[11px] text-muted-foreground">
              {enterpriseStats.enabledProviders} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">SCIM Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enterpriseStats.totalUsers}</div>
            <p className="text-[11px] text-muted-foreground">
              {enterpriseStats.activeUsers} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Groups</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enterpriseStats.totalGroups}</div>
            <p className="text-[11px] text-muted-foreground">
              Group-based access control
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Security Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ssoHealthData?.securityScore ?? '--'}%</div>
            <p className="text-[11px] text-muted-foreground">
              Enterprise security compliance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Uptime</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ssoHealthData?.uptime ?? '--'}%</div>
            <p className="text-[11px] text-muted-foreground">
              SSO service availability
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Provider Form */}
      {showCreateProvider && <CreateProviderForm />}

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">SSO Providers</TabsTrigger>
          <TabsTrigger value="users">SCIM Users</TabsTrigger>
          <TabsTrigger value="groups">SCIM Groups</TabsTrigger>
          <TabsTrigger value="security">Security Settings</TabsTrigger>
        </TabsList>

        {/* SSO Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single Sign-On Providers</CardTitle>
              <CardDescription>
                Configure and manage enterprise authentication providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {providersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider: SSOProvider) => (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">
                          {getProviderIcon(provider.type)}
                        </div>
                        <div>
                          <div className="font-medium flex items-center space-x-2">
                            <span>{provider.name}</span>
                            <Badge className={getProviderStatusColor(provider.enabled)}>
                              {provider.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {provider.type.toUpperCase()} • {provider.domain} • {provider.usersCount} users
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={(checked) => {
                            updateProviderMutation.mutate({
                              id: provider.id,
                              data: { enabled: checked }
                            });
                          }}
                        />
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCIM Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SCIM User Management</CardTitle>
              <CardDescription>
                Users provisioned through SCIM 2.0 integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {scimUsers.map((user: SCIMUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center space-x-2">
                            <span>{user.name.formatted || user.userName}</span>
                            <Badge variant={user.active ? 'default' : 'secondary'}>
                              {user.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {user.emails.find(e => e.primary)?.value || user.emails[0]?.value}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-medium">
                          {user.groups.length} groups
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Created: {new Date(user.meta.created).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCIM Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SCIM Group Management</CardTitle>
              <CardDescription>
                Groups and role-based access control via SCIM
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {scimGroups.map((group: SCIMGroup) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{group.displayName}</div>
                          <div className="text-[13px] text-muted-foreground">
                            {group.members.length} members
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">
                          Created: {new Date(group.meta.created).toLocaleDateString()}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Modified: {new Date(group.meta.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Security Configuration</CardTitle>
                <CardDescription>
                  Enterprise security settings and compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Force SAML Authentication</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Require all users to authenticate via SSO
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-provision Users</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Automatically create accounts for new SSO users
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Just-in-Time Provisioning</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Create user accounts during first login
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enforce Group Membership</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Restrict access based on SSO group membership
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* SCIM Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>SCIM Configuration</CardTitle>
                <CardDescription>
                  System for Cross-domain Identity Management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>SCIM Base URL</Label>
                  <Input
                    value="https://e-code.ai/scim/v2"
                    readOnly
                    className="font-mono text-[13px]"
                  />
                </div>

                <div>
                  <Label>Bearer Token</Label>
                  <div className="flex space-x-2">
                    <Input
                      type={showSecrets.scimToken ? 'text' : 'password'}
                      value="scim_token_1a2b3c4d5e6f7g8h9i0j"
                      readOnly
                      className="font-mono text-[13px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSecrets({
                        ...showSecrets,
                        scimToken: !showSecrets.scimToken
                      })}
                    >
                      {showSecrets.scimToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-[13px] font-medium mb-2">Supported Endpoints:</div>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div>• GET /scim/v2/Users</div>
                    <div>• POST /scim/v2/Users</div>
                    <div>• GET /scim/v2/Groups</div>
                    <div>• POST /scim/v2/Groups</div>
                    <div>• GET /scim/v2/ServiceProviderConfig</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle>Security Audit Log</CardTitle>
              <CardDescription>
                Recent SSO and SCIM security events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogsLoading ? (
                  <p className="text-[13px] text-muted-foreground text-center py-4">Loading audit logs...</p>
                ) : auditLogs && auditLogs.length > 0 ? (
                  auditLogs.slice(0, 5).map((log, index) => (
                    <div key={log.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`h-2 w-2 rounded-full ${
                          log.status === 'success' ? 'bg-green-500' :
                          log.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="text-[13px] font-medium">{log.event}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {log.user} via {log.provider}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.time}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted-foreground text-center py-4">No audit log entries</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}