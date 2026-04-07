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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(5);

  // Mock notifications data
  const notifications = [
    {
      id: 1,
      type: 'comment',
      title: 'New comment on your Repl',
      message: 'alex_dev commented on "ChatGPT Clone"',
      time: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      read: false,
      icon: MessageSquare,
      color: 'text-blue-500',
    },
    {
      id: 2,
      type: 'follow',
      title: 'New follower',
      message: 'sarah_coder started following you',
      time: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      icon: UserPlus,
      color: 'text-green-500',
    },
    {
      id: 3,
      type: 'deploy',
      title: 'Deployment successful',
      message: 'Your app "E-commerce Platform" is now live',
      time: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      read: false,
      icon: Rocket,
      color: 'text-purple-500',
    },
    {
      id: 4,
      type: 'star',
      title: 'Your Repl was starred',
      message: 'dev_mike starred "Real-time Chat App"',
      time: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: true,
      icon: Star,
      color: 'text-yellow-500',
    },
    {
      id: 5,
      type: 'pr',
      title: 'Pull request merged',
      message: 'PR #23 was merged into main branch',
      time: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: true,
      icon: GitPullRequest,
      color: 'text-orange-500',
    },
  ];

  const markAllAsRead = () => {
    setUnreadCount(0);
    // In real app, update backend
  };

  const clearAll = () => {
    // In real app, clear notifications
  };

  const unreadNotifications = notifications.filter(n => !n.read);
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
              onClick={() => setIsOpen(false)}
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
                    {unreadNotifications.map((notification) => {
                      const Icon = notification.icon;
                      return (
                        <div
                          key={notification.id}
                          className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <div className="flex gap-3">
                            <div className={`mt-0.5 ${notification.color}`}>
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
                                {formatDistanceToNow(notification.time, { addSuffix: true })}
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
                {allNotifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 ${notification.color}`}>
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
                            {formatDistanceToNow(notification.time, { addSuffix: true })}
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