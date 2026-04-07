// @ts-nocheck
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Shield, Key, Globe, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';

export function SSOConfiguration() {
  const { toast } = useToast();
  const [testingProvider, setTestingProvider] = useState<number | null>(null);

  // Fetch existing SSO providers
  const { data: providers, isLoading } = useQuery({
    queryKey: ['/api/organizations/sso-providers'],
    queryFn: async () => {
      // In real implementation, would fetch from actual endpoint
      return []; // Placeholder for now
    }
  });

  // Configure SSO mutation
  const configureMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sso/configure', data);
    },
    onSuccess: () => {
      toast({
        title: "SSO Configured",
        description: "Single Sign-On provider has been configured successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Configuration Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Test SSO connection
  const testMutation = useMutation({
    mutationFn: async (providerId: number) => {
      return apiRequest('GET', `/api/sso/test/${providerId}`);
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.success ? "SSO provider is properly configured." : data.error,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleTest = (providerId: number) => {
    setTestingProvider(providerId);
    testMutation.mutate(providerId);
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Single Sign-On Configuration
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure enterprise SSO providers for secure authentication
        </p>
      </div>

      <Tabs defaultValue="configure" className="space-y-4" data-testid="tabs-sso-config">
        <TabsList>
          <TabsTrigger value="configure" data-testid="tab-configure">Configure SSO</TabsTrigger>
          <TabsTrigger value="providers" data-testid="tab-providers">Active Providers</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">SSO Users</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="configure">
          <Card>
            <CardHeader>
              <CardTitle>Add SSO Provider</CardTitle>
              <CardDescription>
                Configure SAML 2.0, OpenID Connect, or OAuth 2.0 providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                configureMutation.mutate({
                  organizationId: 1, // Would come from context
                  providerType: formData.get('providerType'),
                  providerName: formData.get('providerName'),
                  entityId: formData.get('entityId'),
                  ssoUrl: formData.get('ssoUrl'),
                  certificateData: formData.get('certificateData'),
                  metadata: {
                    clientId: formData.get('clientId'),
                    clientSecret: formData.get('clientSecret'),
                    discoveryUrl: formData.get('discoveryUrl')
                  }
                });
              }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="providerType">Provider Type</Label>
                    <Select name="providerType" required>
                      <SelectTrigger data-testid="select-provider-type">
                        <SelectValue placeholder="Select provider type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saml">SAML 2.0</SelectItem>
                        <SelectItem value="oidc">OpenID Connect</SelectItem>
                        <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="providerName">Provider Name</Label>
                    <Input
                      id="providerName"
                      name="providerName"
                      placeholder="e.g., Okta, Azure AD, Google"
                      required
                      data-testid="input-provider-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entityId">Entity ID / Issuer</Label>
                  <Input
                    id="entityId"
                    name="entityId"
                    placeholder="https://your-idp.com/saml"
                    data-testid="input-entity-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssoUrl">SSO URL</Label>
                  <Input
                    id="ssoUrl"
                    name="ssoUrl"
                    placeholder="https://your-idp.com/sso/saml"
                    data-testid="input-sso-url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certificateData">X.509 Certificate (SAML only)</Label>
                  <Textarea
                    id="certificateData"
                    name="certificateData"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    className="font-mono text-[11px]"
                    rows={6}
                    data-testid="textarea-certificate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID (OIDC/OAuth)</Label>
                    <Input
                      id="clientId"
                      name="clientId"
                      placeholder="your-client-id"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret (OIDC/OAuth)</Label>
                    <Input
                      id="clientSecret"
                      name="clientSecret"
                      type="password"
                      placeholder="your-client-secret"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discoveryUrl">Discovery URL (OIDC only)</Label>
                  <Input
                    id="discoveryUrl"
                    name="discoveryUrl"
                    placeholder="https://your-idp.com/.well-known/openid-configuration"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={configureMutation.isPending} data-testid="button-configure-provider">
                    {configureMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Configure Provider
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle>Active SSO Providers</CardTitle>
              <CardDescription>
                Manage your configured single sign-on providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : providers && providers.length > 0 ? (
                <div className="space-y-4">
                  {providers.map((provider: any) => (
                    <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {provider.providerType === 'saml' ? (
                            <Key className="h-5 w-5" />
                          ) : (
                            <Globe className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{provider.providerName}</h3>
                          <p className="text-[13px] text-muted-foreground">
                            {provider.providerType.toUpperCase()} • {provider.entityId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={provider.isActive ? "default" : "secondary"}>
                          {provider.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(provider.id)}
                          disabled={testingProvider === provider.id && testMutation.isPending}
                        >
                          {testingProvider === provider.id && testMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Test Connection"
                          )}
                        </Button>
                        <Button variant="ghost" size="sm">Configure</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No SSO providers configured yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>SSO Users</CardTitle>
              <CardDescription>
                Users who have authenticated via single sign-on
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">SSO user management coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>SSO Settings</CardTitle>
              <CardDescription>
                Configure global SSO behavior and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enforce SSO</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Require all users to authenticate via SSO
                  </p>
                </div>
                <Switch data-testid="switch-enforce-sso" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-provision Users</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Automatically create user accounts on first SSO login
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-auto-provision" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Update User Attributes</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Update user profile from SSO attributes on each login
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-update-attributes" />
              </div>

              <div className="pt-4">
                <Button data-testid="button-save-sso-settings">Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SSOConfiguration;