import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  GitPullRequest,
  UserPlus,
  Rocket,
  AlertCircle,
  Star,
  Settings,
  X,
  Heart,
  Code,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@shared/schema';

// Icon mapping for notification types
const notificationIcons: Record<string, any> = {
  comment: MessageSquare,
  follow: UserPlus,
  deploy: Rocket,
  star: Star,
  like: Heart,
  pr: GitPullRequest,
  collaboration: UserPlus,
  project_update: Code,
  bounty: DollarSign,
  system: AlertCircle,
  trending: TrendingUp,
  default: Bell,
};

// Color mapping for notification types
const notificationColors: Record<string, string> = {
  comment: 'text-blue-500',
  follow: 'text-green-500',
  deploy: 'text-purple-500',
  star: 'text-yellow-500',
  like: 'text-pink-500',
  pr: 'text-orange-500',
  collaboration: 'text-teal-500',
  project_update: 'text-indigo-500',
  bounty: 'text-emerald-500',
  system: 'text-red-500',
  trending: 'text-cyan-500',
  default: 'text-gray-500',
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch notifications from API
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 60000, // Refetch every minute
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/notifications/read-all', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Clear all notifications mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/notifications', {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'Success',
        description: 'All notifications cleared',
      });
    },
  });

  const unreadNotifications = notifications.filter((n: Notification) => !n.read);
  const unreadCount = unreadNotifications.length;

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    // Navigate to link if provided
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    return notificationIcons[type] || notificationIcons.default;
  };

  const getNotificationColor = (type: string) => {
    return notificationColors[type] || notificationColors.default;
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    navigate('/settings/notifications');
  };

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const clearAll = () => {
    clearAllMutation.mutate();
  };

  // Mock notifications data removed, now using real data from API
  const allNotifications = notifications;


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSettingsClick}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="unread" className="w-full">
          <TabsList className="w-full border-b">
            <TabsTrigger value="unread" className="flex-1">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="mt-0">
            {unreadNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>You're all caught up!</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[300px]">
                  <div className="divide-y">
                    {unreadNotifications.map((notification: Notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      const color = getNotificationColor(notification.type);
                      return (
                        <div
                          key={notification.id}
                          className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex gap-3">
                            <div className={`mt-0.5 ${color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="opacity-0 hover:opacity-100">
                              <Check className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="p-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-2"
                    onClick={markAllAsRead}
                    disabled={markAllAsReadMutation.isPending}
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark all as read
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {allNotifications.map((notification: Notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const color = getNotificationColor(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 ${color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {notification.read && (
                          <Check className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-3">
              <Button
                variant="ghost"
                className="w-full justify-center"
                onClick={clearAll}
                disabled={clearAllMutation.isPending}
              >
                Clear all notifications
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}