// @ts-nocheck
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  Settings, 
  Check, 
  X, 
  Mail, 
  Heart, 
  MessageSquare, 
  Users, 
  GitBranch,
  Shield,
  AlertTriangle,
  Info,
  Zap,
  Calendar,
  Archive,
  MoreHorizontal
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ReplitLayout } from '@/components/layout/ReplitLayout';

interface Notification {
  id: number;
  type: 'comment' | 'like' | 'follow' | 'mention' | 'team_invite' | 'deployment' | 'security' | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  actionUrl?: string;
  user?: {
    username: string;
    avatar: string;
  };
  metadata?: Record<string, any>;
}

interface NotificationSettings {
  email: {
    comments: boolean;
    likes: boolean;
    follows: boolean;
    mentions: boolean;
    teamUpdates: boolean;
    deployments: boolean;
    security: boolean;
    marketing: boolean;
  };
  push: {
    comments: boolean;
    likes: boolean;
    follows: boolean;
    mentions: boolean;
    teamUpdates: boolean;
    deployments: boolean;
    security: boolean;
  };
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
}

export default function Notifications() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/notifications');
        return Array.isArray(res) ? res : [];
      } catch (err) {
        console.error('Notifications fetch error:', err);
        return [];
      }
    },
  });

  // Fetch notification settings
  const { data: settings, isLoading: settingsLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/notifications/preferences'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/notifications/preferences');
      } catch (err) {
        console.error('Notification preferences fetch error:', err);
        return {
          email: {
            comments: true,
            likes: true,
            follows: true,
            mentions: true,
            teamUpdates: true,
            deployments: true,
            security: true,
            marketing: false,
          },
          push: {
            comments: true,
            likes: true,
            follows: true,
            mentions: true,
            teamUpdates: true,
            deployments: true,
            security: true,
          },
          frequency: 'instant' as const
        };
      }
    }
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest('PATCH', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been cleared.",
      });
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', '/api/notifications/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
    }
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'like': return <Heart className="h-4 w-4 text-red-500" />;
      case 'follow': return <Users className="h-4 w-4 text-green-500" />;
      case 'mention': return <Mail className="h-4 w-4 text-purple-500" />;
      case 'team_invite': return <Users className="h-4 w-4 text-orange-500" />;
      case 'deployment': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'security': return <Shield className="h-4 w-4 text-red-600" />;
      case 'system': return <Info className="h-4 w-4 text-muted-foreground" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'security': return 'border-l-red-500';
      case 'deployment': return 'border-l-yellow-500';
      case 'team_invite': return 'border-l-orange-500';
      case 'comment': return 'border-l-blue-500';
      case 'like': return 'border-l-red-500';
      case 'follow': return 'border-l-green-500';
      case 'mention': return 'border-l-purple-500';
      default: return 'border-l-border';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'unread') return !notification.read;
    return notification.type === selectedTab;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const handleUpdateSettings = (section: string, setting: string, value: boolean) => {
    if (!settings) return;
    
    const updatedSettings = {
      ...settings,
      [section]: {
        ...settings[section as keyof typeof settings],
        [setting]: value
      }
    };
    
    updateSettingsMutation.mutate(updatedSettings);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Notification Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure how and when you receive notifications
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowSettings(false)}
          >
            Back to Notifications
          </Button>
        </div>

        {settingsLoading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Email Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive via email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings?.email || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <p className="text-[13px] text-muted-foreground">
                        Get notified about {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </p>
                    </div>
                    <Switch
                      checked={value as boolean}
                      onCheckedChange={(checked) => handleUpdateSettings('email', key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Push Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Push Notifications
                </CardTitle>
                <CardDescription>
                  Receive instant notifications in your browser
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings?.push || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <p className="text-[13px] text-muted-foreground">
                        Get push notifications for {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </p>
                    </div>
                    <Switch
                      checked={value as boolean}
                      onCheckedChange={(checked) => handleUpdateSettings('push', key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Frequency Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Notification Frequency
                </CardTitle>
                <CardDescription>
                  Control how often you receive notification summaries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['instant', 'hourly', 'daily', 'weekly'].map((freq) => (
                    <Button
                      key={freq}
                      variant={settings?.frequency === freq ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdateSettings('', 'frequency', freq)}
                      className="mr-2 capitalize"
                    >
                      {freq}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <ReplitLayout showSidebar={false}>
      <div className="container mx-auto max-w-4xl py-8 px-6">
        <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-3">
              <Bell className="h-8 w-8" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-2">
              Stay updated with your latest activity and team updates
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2"
              data-testid="button-notification-settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            {unreadCount > 0 && (
              <Button 
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-2"
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4" data-testid="tabs-notifications">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex items-center gap-2" data-testid="tab-unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comment" data-testid="tab-comments">Comments</TabsTrigger>
          <TabsTrigger value="team_invite" data-testid="tab-teams">Teams</TabsTrigger>
          <TabsTrigger value="deployment" data-testid="tab-deployments">Deployments</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-medium mb-2">No notifications</h3>
                <p className="text-muted-foreground">
                  {selectedTab === 'unread' 
                    ? "You're all caught up! No unread notifications." 
                    : "You don't have any notifications in this category."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`transition-all hover:shadow-sm cursor-pointer border-l-4 ${getNotificationColor(notification.type)} ${
                    !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {notification.user ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={notification.user?.avatar} />
                            <AvatarFallback>
                              {(notification?.user?.username || "?")?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            {getNotificationIcon(notification.type)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className={`font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                              {notification.title}
                            </h4>
                            <p className="text-[13px] text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[11px] text-muted-foreground">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              {!notification.read && (
                                <Badge variant="secondary" className="text-[11px]">
                                  New
                                </Badge>
                              )}
                              {notification.actionUrl && (
                                <Button variant="link" size="sm" className="text-[11px] p-0 h-auto">
                                  View →
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </ReplitLayout>
  );
}