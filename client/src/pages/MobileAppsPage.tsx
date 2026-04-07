// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Download, Bell, RefreshCw, Code, Play, Settings, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface MobileApp {
  id: number;
  name: string;
  platform: 'ios' | 'android' | 'both';
  status: 'development' | 'testing' | 'published' | 'archived';
  version: string;
  downloads: number;
  rating: number;
  lastUpdated: string;
  notifications: {
    push: boolean;
    updates: boolean;
    mentions: boolean;
  };
}

interface MobileFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'available' | 'beta' | 'coming-soon';
  platforms: string[];
}

export default function MobileAppsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  // Fetch mobile apps
  const { data: apps, isLoading: appsLoading } = useQuery({
    queryKey: ["/api/mobile/apps"],
    queryFn: () => apiRequest('GET', "/api/mobile/apps")
  });

  // Fetch mobile settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/mobile/settings"],
    queryFn: () => apiRequest('GET', "/api/mobile/settings")
  });

  // Fetch mobile statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/mobile/stats"],
    queryFn: () => apiRequest('GET', "/api/mobile/stats")
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: { setting: string; value: any }) =>
      apiRequest('PATCH', "/api/mobile/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your mobile app settings have been updated."
      });
    }
  });

  // Send push notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: (data: { title: string; message: string; recipients?: string[] }) =>
      apiRequest('POST', "/api/mobile/notifications/send", data),
    onSuccess: () => {
      toast({
        title: "Notification Sent",
        description: "Push notification has been sent successfully."
      });
    }
  });

  const mobileFeatures: MobileFeature[] = [
    {
      id: 'code-editor',
      name: 'Mobile Code Editor',
      description: 'Edit code on the go with syntax highlighting and IntelliSense',
      icon: Code,
      status: 'available',
      platforms: ['iOS', 'Android']
    },
    {
      id: 'project-sync',
      name: 'Project Sync',
      description: 'Real-time synchronization between desktop and mobile',
      icon: RefreshCw,
      status: 'available',
      platforms: ['iOS', 'Android']
    },
    {
      id: 'push-notifications',
      name: 'Push Notifications',
      description: 'Get notified about project updates and collaboration',
      icon: Bell,
      status: 'available',
      platforms: ['iOS', 'Android']
    },
    {
      id: 'mobile-preview',
      name: 'Mobile Preview',
      description: 'Preview your applications directly on mobile devices',
      icon: Play,
      status: 'beta',
      platforms: ['iOS', 'Android']
    },
    {
      id: 'offline-mode',
      name: 'Offline Mode',
      description: 'Work on projects without internet connection',
      icon: Download,
      status: 'coming-soon',
      platforms: ['iOS', 'Android']
    },
    {
      id: 'team-chat',
      name: 'Team Chat',
      description: 'Communicate with your team on mobile',
      icon: Users,
      status: 'available',
      platforms: ['iOS', 'Android']
    }
  ];

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'ios':
        return '🍎';
      case 'android':
        return '🤖';
      case 'both':
        return '📱';
      default:
        return '📱';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'development':
        return 'bg-blue-100 text-blue-800';
      case 'testing':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getFeatureStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'beta':
        return 'bg-blue-100 text-blue-800';
      case 'coming-soon':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (appsLoading || settingsLoading) {
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
            <h1 className="text-3xl font-bold">Mobile Apps</h1>
            <p className="text-muted-foreground mt-2">
              Manage your mobile applications and stay connected on the go
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" data-testid="button-download-ios">
              <Download className="h-4 w-4 mr-2" />
              Download iOS App
            </Button>
            <Button variant="outline" data-testid="button-download-android">
              <Download className="h-4 w-4 mr-2" />
              Download Android App
            </Button>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Total Downloads</p>
                    <p className="text-2xl font-bold">{stats.totalDownloads || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold">{stats.activeUsers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Notifications Sent</p>
                    <p className="text-2xl font-bold">{stats.notificationsSent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-[13px] text-muted-foreground">Sync Rate</p>
                    <p className="text-2xl font-bold">{stats.syncRate || 99}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6" data-testid="tabs-mobile-apps">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="apps" data-testid="tab-apps">My Apps</TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Get Started
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl">📱</div>
                      <div>
                        <p className="font-medium">Download the App</p>
                        <p className="text-[13px] text-muted-foreground">Available for iOS and Android</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl">🔐</div>
                      <div>
                        <p className="font-medium">Sign In</p>
                        <p className="text-[13px] text-muted-foreground">Use your E-Code credentials</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl">🚀</div>
                      <div>
                        <p className="font-medium">Start Coding</p>
                        <p className="text-[13px] text-muted-foreground">Access all your projects on mobile</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>App Store Ratings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍎</span>
                      <span>iOS App Store</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <span key={i} className="text-yellow-400">⭐</span>
                        ))}
                      </div>
                      <span className="font-semibold">4.8</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🤖</span>
                      <span>Google Play Store</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <span key={i} className="text-yellow-400">⭐</span>
                        ))}
                      </div>
                      <span className="font-semibold">4.7</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="apps" className="space-y-6">
            <div className="space-y-4">
              {apps?.map((app: MobileApp) => (
                <Card key={app.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{getPlatformIcon(app.platform)}</div>
                        <div>
                          <h3 className="font-semibold text-[15px]">{app.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-[13px] text-muted-foreground">
                            <span>Version {app.version}</span>
                            <span>{app.downloads.toLocaleString()} downloads</span>
                            <span>★ {app.rating}/5.0</span>
                            <span>Updated {new Date(app.lastUpdated).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(app.status)}>
                          {app.status}
                        </Badge>
                        <Button variant="outline" size="sm" data-testid={`button-manage-app-${app.id}`}>
                          <Settings className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!apps?.length && (
                <div className="text-center py-12">
                  <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-[15px] font-medium text-foreground mb-2">No mobile apps found</h3>
                  <p className="text-muted-foreground mb-4">
                    Download the E-Code mobile app to get started.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      iOS App
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Android App
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mobileFeatures.map(feature => {
                const IconComponent = feature.icon;
                return (
                  <Card key={feature.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{feature.name}</h3>
                          <Badge className={getFeatureStatusColor(feature.status)} variant="secondary">
                            {feature.status.replace('-', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[13px] text-muted-foreground mb-4">{feature.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {feature.platforms.map(platform => (
                          <Badge key={platform} variant="outline" className="text-[11px]">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-[13px] text-muted-foreground">Receive notifications on your mobile device</p>
                    </div>
                    <Switch 
                      checked={settings?.notifications?.push || false}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'notifications.push', value: checked })
                      }
                      data-testid="switch-push-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Project Updates</p>
                      <p className="text-[13px] text-muted-foreground">Get notified when projects are updated</p>
                    </div>
                    <Switch 
                      checked={settings?.notifications?.updates || false}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'notifications.updates', value: checked })
                      }
                      data-testid="switch-project-updates"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mentions & Comments</p>
                      <p className="text-[13px] text-muted-foreground">Get notified when someone mentions you</p>
                    </div>
                    <Switch 
                      checked={settings?.notifications?.mentions || false}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'notifications.mentions', value: checked })
                      }
                      data-testid="switch-mentions"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h4 className="font-medium mb-4">Send Test Notification</h4>
                  <Button 
                    onClick={() => sendNotificationMutation.mutate({
                      title: "Test Notification",
                      message: "This is a test notification from E-Code mobile app."
                    })}
                    disabled={sendNotificationMutation.isPending}
                    data-testid="button-send-test-notification"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {sendNotificationMutation.isPending ? "Sending..." : "Send Test Notification"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mobile App Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto Sync</p>
                      <p className="text-[13px] text-muted-foreground">Automatically sync projects across devices</p>
                    </div>
                    <Switch 
                      checked={settings?.autoSync || true}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'autoSync', value: checked })
                      }
                      data-testid="switch-auto-sync"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Offline Mode</p>
                      <p className="text-[13px] text-muted-foreground">Enable offline editing capabilities</p>
                    </div>
                    <Switch 
                      checked={settings?.offlineMode || false}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'offlineMode', value: checked })
                      }
                      data-testid="switch-offline-mode"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mobile Data Sync</p>
                      <p className="text-[13px] text-muted-foreground">Allow syncing over mobile data</p>
                    </div>
                    <Switch 
                      checked={settings?.mobileDataSync || false}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ setting: 'mobileDataSync', value: checked })
                      }
                      data-testid="switch-mobile-data-sync"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h4 className="font-medium mb-4">Storage Usage</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[13px]">
                      <span>App Cache</span>
                      <span>250 MB / 1 GB</span>
                    </div>
                    <Progress value={25} className="h-2" />
                    <Button variant="outline" size="sm" data-testid="button-clear-cache">
                      Clear Cache
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}