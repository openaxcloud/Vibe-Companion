import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Smartphone,
  Tablet,
  RefreshCw,
  AlertCircle,
  Clock,
  Lightbulb,
} from 'lucide-react';
import { SiApple, SiAndroid } from 'react-icons/si';
import { cn } from '@/lib/utils';

interface MobileSessionsPanelProps {
  className?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function PlatformIcon({ platform }: { platform: 'ios' | 'android' }) {
  if (platform === 'ios') {
    return <SiApple className="h-4 w-4" data-testid="icon-platform-ios" />;
  }
  return <SiAndroid className="h-4 w-4 text-green-500" data-testid="icon-platform-android" />;
}

export function MobileSessionsPanel({ className }: MobileSessionsPanelProps) {
  // Static demo data since backend has no mobile sessions API
  const demoSessions = [
    {
      id: 1,
      deviceId: 'device-ios-001',
      deviceName: 'My iPhone 15',
      platform: 'ios' as const,
      lastActiveAt: new Date(Date.now() - 5 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60000).toISOString(),
      isActive: true,
    },
    {
      id: 2,
      deviceId: 'device-android-001',
      deviceName: 'Samsung Galaxy',
      platform: 'android' as const,
      lastActiveAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60000).toISOString(),
      isActive: true,
    },
  ];

  const sessions = demoSessions;

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="panel-mobile-sessions">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          <h2 className="font-semibold" data-testid="text-sessions-title">Mobile Sessions</h2>
          <Badge variant="secondary" data-testid="badge-sessions-count">
            Demo
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">Demo Data</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-[13px] mt-1">
              This panel displays demo session data. Mobile session management requires backend implementation.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.deviceId}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
                data-testid={`session-card-${session.deviceId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                    <PlatformIcon platform={session.platform} />
                  </div>
                  <div>
                    <p className="font-medium" data-testid={`text-device-name-${session.deviceId}`}>
                      {session.deviceName || `${session.platform === 'ios' ? 'iPhone' : 'Android'} Device`}
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Badge variant="outline" className="text-[11px] capitalize" data-testid={`badge-platform-${session.deviceId}`}>
                        {session.platform}
                      </Badge>
                      <span className="flex items-center gap-1" data-testid={`text-last-active-${session.deviceId}`}>
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(session.lastActiveAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Alert variant="outline" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Read-Only View</AlertTitle>
            <AlertDescription className="text-[13px]">
              Session revocation and management features require the mobile sessions API to be implemented on the backend.
            </AlertDescription>
          </Alert>
        </div>
      </ScrollArea>
    </div>
  );
}

export default MobileSessionsPanel;
