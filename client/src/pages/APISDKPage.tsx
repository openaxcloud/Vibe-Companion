// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Eye, EyeOff, Plus, Trash2, BarChart3, Code, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface APIKey {
  id: number;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

interface SDKExample {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  category: string;
}

export default function APISDKPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);

  // Fetch API keys
  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/sdk/keys"],
    queryFn: () => apiRequest('GET', "/api/sdk/keys")
  });

  // Fetch SDK examples
  const { data: examples, isLoading: examplesLoading } = useQuery({
    queryKey: ["/api/sdk/examples"],
    queryFn: () => apiRequest('GET', "/api/sdk/examples")
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ["/api/sdk/analytics"],
    queryFn: () => apiRequest('GET', "/api/sdk/analytics")
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: (data: { name: string; permissions: string[] }) =>
      apiRequest('POST', "/api/sdk/keys", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sdk/keys"] });
      setNewKeyName("");
      setNewKeyPermissions([]);
      toast({
        title: "API Key Created",
        description: "Your new API key has been generated successfully."
      });
    }
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: number) =>
      apiRequest('DELETE', `/api/sdk/keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sdk/keys"] });
      toast({
        title: "API Key Deleted",
        description: "The API key has been revoked and deleted."
      });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "API key has been copied to your clipboard."
    });
  };

  const toggleKeyVisibility = (keyId: number) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handlePermissionToggle = (permission: string) => {
    setNewKeyPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const maskApiKey = (key: string) => {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  const availablePermissions = [
    'projects:read',
    'projects:write',
    'files:read',
    'files:write',
    'deployments:read',
    'deployments:write',
    'ai:access',
    'analytics:read'
  ];

  if (keysLoading || examplesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API & SDK</h1>
            <p className="text-muted-foreground mt-2">
              Integrate E-Code into your applications with our powerful API and SDKs
            </p>
          </div>
          <Button>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Documentation
          </Button>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Key className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Active Keys</p>
                    <p className="text-2xl font-bold">{analytics.activeKeys || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">API Calls (30d)</p>
                    <p className="text-2xl font-bold">{analytics.apiCalls || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Code className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">{analytics.successRate || 99}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Rate Limit</p>
                    <p className="text-2xl font-bold">{analytics.rateLimit || 1000}/hr</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="keys" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
            <TabsTrigger value="sdks">SDKs</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-6">
            {/* Create New API Key */}
            <Card>
              <CardHeader>
                <CardTitle>Create New API Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="My API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {availablePermissions.map(permission => (
                        <div key={permission} className="flex items-center gap-2">
                          <Switch
                            checked={newKeyPermissions.includes(permission)}
                            onCheckedChange={() => handlePermissionToggle(permission)}
                          />
                          <span className="text-[13px]">{permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => createKeyMutation.mutate({ name: newKeyName, permissions: newKeyPermissions })}
                  disabled={!newKeyName || newKeyPermissions.length === 0 || createKeyMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createKeyMutation.isPending ? "Creating..." : "Create API Key"}
                </Button>
              </CardContent>
            </Card>

            {/* API Keys List */}
            <div className="space-y-4">
              {apiKeys?.map((key: APIKey) => (
                <Card key={key.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-[15px]">{key.name}</h3>
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[13px]">
                          <span>
                            {showKeys[key.id] ? key.key : maskApiKey(key.key)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.map(permission => (
                            <Badge key={permission} variant="outline" className="text-[11px]">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          Created: {formatDate(key.createdAt)}
                          {key.lastUsed && ` • Last used: ${formatDate(key.lastUsed)}`}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteKeyMutation.mutate(key.id)}
                        disabled={deleteKeyMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!apiKeys?.length && (
                <div className="text-center py-12">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-[15px] font-medium text-foreground mb-2">No API keys found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first API key to start using the E-Code API.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {examples?.map((example: SDKExample) => (
                <Card key={example.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{example.title}</span>
                      <Badge variant="outline">{example.language}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-[13px] text-muted-foreground">{example.description}</p>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-[13px] overflow-x-auto">
                        <code>{example.code}</code>
                      </pre>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Code
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sdks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['JavaScript', 'Python', 'Go', 'Java', 'Ruby', 'PHP'].map(language => (
                <Card key={language}>
                  <CardContent className="p-6 text-center">
                    <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Code className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="font-semibold mb-2">{language} SDK</h3>
                    <p className="text-[13px] text-muted-foreground mb-4">
                      Official E-Code SDK for {language} applications
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Documentation
                      </Button>
                      <Button size="sm" className="flex-1">
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-app.com/webhooks/e-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['project.created', 'project.updated', 'deployment.success', 'deployment.failed'].map(event => (
                        <div key={event} className="flex items-center gap-2">
                          <Switch />
                          <span className="text-[13px]">{event}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Webhook Secret</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      placeholder="Optional signing secret"
                    />
                  </div>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}